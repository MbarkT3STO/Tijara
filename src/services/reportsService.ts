/**
 * Reports & Analytics aggregation service.
 */

import { repository } from '@data/excelRepository';

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
  profit: number;
  purchaseCost: number;
}

export interface CategorySales {
  category: string;
  revenue: number;
  quantity: number;
  percentage: number;
}

export interface CustomerStat {
  customerId: string;
  customerName: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string;
}

export interface ProductStat {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  revenue: number;
  quantity: number;
  profit: number;
}

export interface ReportSummary {
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  avgOrderValue: number;
  totalCustomers: number;
  newCustomers: number;
  totalPurchaseSpend: number;
}

export const reportsService = {
  /** Revenue by month for the last N months */
  getMonthlyRevenue(months = 12): MonthlyRevenue[] {
    const sales = repository.getAll('sales').filter((s) => s.status !== 'cancelled');
    const purchases = repository.getAll('purchases').filter((p) => p.status === 'received');
    const products = repository.getAll('products');
    const productCostMap = new Map(products.map((p) => [p.id, p.cost]));

    const result: MonthlyRevenue[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const monthSales = sales.filter((s) => {
        const sd = new Date(s.createdAt);
        return sd >= start && sd <= end;
      });

      const revenue = monthSales.reduce((sum, s) => sum + s.total, 0);
      // COGS: use product cost map as estimate (actual purchase costs tracked separately)
      const cogs = monthSales.reduce((sum, s) =>
        sum + s.items.reduce((is, item) => {
          const unitCost = productCostMap.get(item.productId) ?? 0;
          return is + unitCost * item.quantity;
        }, 0), 0);

      // Actual purchase spend in this month
      const purchaseCost = purchases
        .filter((p) => {
          const pd = new Date(p.createdAt);
          return pd >= start && pd <= end;
        })
        .reduce((sum, p) => sum + p.total, 0);

      result.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue,
        orders: monthSales.length,
        profit: revenue - cogs,
        purchaseCost,
      });
    }

    return result;
  },

  /** Sales breakdown by product category */
  getCategorySales(): CategorySales[] {
    const sales = repository.getAll('sales').filter((s) => s.status !== 'cancelled');
    const products = repository.getAll('products');
    const productCategoryMap = new Map(products.map((p) => [p.id, p.category]));

    const map = new Map<string, { revenue: number; quantity: number }>();
    let totalRevenue = 0;

    sales.forEach((s) => {
      s.items.forEach((item) => {
        const cat = productCategoryMap.get(item.productId) ?? 'Uncategorized';
        const existing = map.get(cat) ?? { revenue: 0, quantity: 0 };
        map.set(cat, {
          revenue: existing.revenue + item.total,
          quantity: existing.quantity + item.quantity,
        });
        totalRevenue += item.total;
      });
    });

    return Array.from(map.entries())
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        quantity: data.quantity,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  },

  /** Top customers by total spend */
  getTopCustomers(limit = 10): CustomerStat[] {
    const sales = repository.getAll('sales').filter((s) => s.status !== 'cancelled');
    const map = new Map<string, CustomerStat>();

    sales.forEach((s) => {
      const existing = map.get(s.customerId);
      if (!existing) {
        map.set(s.customerId, {
          customerId: s.customerId,
          customerName: s.customerName,
          totalSpent: s.total,
          orderCount: 1,
          lastOrderDate: s.createdAt,
        });
      } else {
        existing.totalSpent += s.total;
        existing.orderCount += 1;
        if (s.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = s.createdAt;
        }
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  },

  /** Top products by revenue */
  getTopProducts(limit = 10): ProductStat[] {
    const sales = repository.getAll('sales').filter((s) => s.status !== 'cancelled');
    const products = repository.getAll('products');
    const productMap = new Map(products.map((p) => [p.id, p]));

    const map = new Map<string, ProductStat>();

    sales.forEach((s) => {
      s.items.forEach((item) => {
        const product = productMap.get(item.productId);
        const unitCost = product?.cost ?? 0;
        const existing = map.get(item.productId);
        if (!existing) {
          map.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            sku: product?.sku ?? '',
            category: product?.category ?? '',
            revenue: item.total,
            quantity: item.quantity,
            profit: item.total - unitCost * item.quantity,
          });
        } else {
          existing.revenue += item.total;
          existing.quantity += item.quantity;
          existing.profit += item.total - unitCost * item.quantity;
        }
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },

  /** Summary stats for a date range (null = all time) */
  getSummary(from?: Date, to?: Date): ReportSummary {
    const allSales = repository.getAll('sales').filter((s) => s.status !== 'cancelled');
    const products = repository.getAll('products');
    const productCostMap = new Map(products.map((p) => [p.id, p.cost]));

    const sales = from && to
      ? allSales.filter((s) => {
          const d = new Date(s.createdAt);
          return d >= from && d <= to;
        })
      : allSales;

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalCost = sales.reduce((sum, s) =>
      sum + s.items.reduce((is, item) => {
        const unitCost = productCostMap.get(item.productId) ?? 0;
        return is + unitCost * item.quantity;
      }, 0), 0);

    const allPurchases = repository.getAll('purchases').filter((p) => p.status === 'received');
    const filteredPurchases = from && to
      ? allPurchases.filter((p) => {
          const d = new Date(p.createdAt);
          return d >= from && d <= to;
        })
      : allPurchases;
    const totalPurchaseSpend = filteredPurchases.reduce((sum, p) => sum + p.total, 0);

    const customers = repository.getAll('customers');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const newCustomers = customers.filter((c) => new Date(c.createdAt) >= thirtyDaysAgo).length;

    return {
      totalRevenue,
      totalProfit: totalRevenue - totalCost,
      totalOrders: sales.length,
      avgOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
      totalCustomers: customers.length,
      newCustomers,
      totalPurchaseSpend,
    };
  },
};
