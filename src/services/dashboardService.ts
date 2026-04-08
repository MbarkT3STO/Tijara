/**
 * Dashboard aggregation service.
 * Computes KPIs and summary statistics from all data sources.
 */

import { repository } from '@data/excelRepository';
import { inventoryService } from './inventoryService';
import type { DashboardStats } from '@core/types';

export const dashboardService = {
  /** Compute dashboard statistics */
  getStats(): DashboardStats {
    const sales = repository.getAll('sales');
    const customers = repository.getAll('customers');
    const products = repository.getAll('products');

    const activeSales = sales.filter((s) => s.status !== 'cancelled');
    const totalRevenue = activeSales.reduce((sum, s) => sum + s.total, 0);

    // Growth: compare this month vs last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthRevenue = activeSales
      .filter((s) => new Date(s.createdAt) >= thisMonthStart)
      .reduce((sum, s) => sum + s.total, 0);

    const lastMonthRevenue = activeSales
      .filter((s) => {
        const d = new Date(s.createdAt);
        return d >= lastMonthStart && d < thisMonthStart;
      })
      .reduce((sum, s) => sum + s.total, 0);

    const revenueGrowth =
      lastMonthRevenue === 0
        ? 100
        : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;

    const thisMonthOrders = activeSales.filter(
      (s) => new Date(s.createdAt) >= thisMonthStart
    ).length;
    const lastMonthOrders = activeSales.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= lastMonthStart && d < thisMonthStart;
    }).length;

    const ordersGrowth =
      lastMonthOrders === 0
        ? 100
        : ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100;

    // Recent sales (last 5)
    const recentSales = [...activeSales]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    // Top products by revenue
    const productRevenue: Record<string, { name: string; revenue: number; quantity: number }> = {};
    activeSales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (!productRevenue[item.productId]) {
          productRevenue[item.productId] = {
            name: item.productName,
            revenue: 0,
            quantity: 0,
          };
        }
        productRevenue[item.productId].revenue += item.total;
        productRevenue[item.productId].quantity += item.quantity;
      });
    });

    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue,
      totalOrders: activeSales.length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      revenueGrowth,
      ordersGrowth,
      lowStockCount: inventoryService.getLowStockProducts().length,
      recentSales,
      topProducts,
    };
  },
};
