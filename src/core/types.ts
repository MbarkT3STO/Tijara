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

/** Dashboard stats */
export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  revenueGrowth: number;
  ordersGrowth: number;
  recentSales: Sale[];
  topProducts: { name: string; revenue: number; quantity: number }[];
}
