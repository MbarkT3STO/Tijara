/**
 * Core domain types for the Tijara application.
 * All entities use string UUIDs as identifiers.
 */

/** Supported application routes */
export type Route =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'sales'
  | 'invoices'
  | 'inventory'
  | 'suppliers'
  | 'purchases'
  | 'returns'
  | 'reports'
  | 'users'
  | 'settings';

/** Application theme */
export type Theme = 'light' | 'dark';

/** Customer entity */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  createdAt: string; // ISO date string
  notes?: string;
}

/** Product entity */
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  description?: string;
  reorderPoint: number;   // alert when stock falls at or below this
  reorderQuantity: number; // suggested restock quantity
  createdAt: string;
}

/** Stock movement type */
export type StockMovementType = 'purchase' | 'sale' | 'adjustment' | 'return' | 'initial';

/** Stock movement record – every change to a product's stock level */
export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;      // positive = stock in, negative = stock out
  stockBefore: number;
  stockAfter: number;
  reference?: string;    // e.g. order number, PO number
  notes?: string;
  createdAt: string;
}

/** Order line item */
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number; // percentage 0-100
  total: number;
}

/** Sale / Order entity */
export interface Sale {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Invoice entity */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  saleId: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  notes?: string;
  createdAt: string;
}

/** User role */
export type UserRole = 'admin' | 'manager' | 'sales' | 'viewer';

/** User entity */
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  lastLogin?: string;
  createdAt: string;
}

/** Generic paginated result */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Generic sort config */
export interface SortConfig<T> {
  field: keyof T;
  direction: SortDirection;
}

/** App notification */
export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

/** Enterprise profile for invoice branding */
export interface EnterpriseProfile {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  website: string;
  taxId: string;
  logo: string;           // base64 data URL or empty string
  defaultTaxRate: number; // default tax % applied to new orders (0–100)
  currency: string;       // ISO 4217 currency code, e.g. "USD", "EUR"
  defaultPdfLanguage: string; // e.g. "en", "fr", "ar"
}

/** Purchase order line item */
export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
}

/** Purchase / restocking order */
export interface Purchase {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingCost: number;
  total: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  expectedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Return / refund line item */
export interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Return reason */
export type ReturnReason =
  | 'defective'
  | 'wrong_item'
  | 'not_as_described'
  | 'damaged_shipping'
  | 'customer_changed_mind'
  | 'other';

/** Customer return / refund */
export interface Return {
  id: string;
  returnNumber: string;
  saleId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  items: ReturnItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  refundAmount: number;
  reason: ReturnReason;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  refundMethod: 'cash' | 'card' | 'transfer' | 'store_credit' | 'other';
  restockItems: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Supplier entity */
export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  contactPerson: string;
  taxId?: string;
  website?: string;
  notes?: string;
  createdAt: string;
}

/** Dashboard stats */
export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  revenueGrowth: number;
  ordersGrowth: number;
  lowStockCount: number;
  recentSales: Sale[];
  topProducts: { name: string; revenue: number; quantity: number }[];
}
