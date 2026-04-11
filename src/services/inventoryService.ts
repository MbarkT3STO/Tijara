/**
 * Inventory service.
 * Manages stock movements, reorder alerts, and stock-level adjustments.
 * Every stock change is recorded as a StockMovement for full audit trail.
 */

import { repository } from '@data/repository';
import type { StockMovement, StockMovementType, Product } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

export const inventoryService = {
  // ── Movements ─────────────────────────────────────────────────────────────

  /** Get all stock movements, newest first */
  getAllMovements(): StockMovement[] {
    return repository
      .getAll('stockMovements')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /** Get movements for a specific product */
  getMovementsByProduct(productId: string): StockMovement[] {
    return repository
      .getAll('stockMovements')
      .filter((m) => m.productId === productId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Record a stock movement and update the product's stock level.
   * @param productId - Product to adjust
   * @param type - Movement type
   * @param quantity - Positive = stock in, negative = stock out
   * @param reference - Optional reference (order number, PO, etc.)
   * @param notes - Optional notes
   */
  recordMovement(
    productId: string,
    type: StockMovementType,
    quantity: number,
    reference?: string,
    notes?: string
  ): StockMovement | null {
    const product = repository.getById('products', productId);
    if (!product) return null;

    const stockBefore = product.stock;
    const stockAfter = Math.max(0, stockBefore + quantity);

    const movement: StockMovement = {
      id: generateId(),
      productId,
      productName: product.name,
      type,
      quantity,
      stockBefore,
      stockAfter,
      reference,
      notes,
      createdAt: getCurrentISODate(),
    };

    repository.insert('stockMovements', movement);
    repository.update('products', productId, { stock: stockAfter });
    return movement;
  },

  // ── Adjustments ───────────────────────────────────────────────────────────

  /** Manual stock adjustment (positive or negative) */
  adjust(productId: string, quantity: number, notes?: string): StockMovement | null {
    return this.recordMovement(productId, 'adjustment', quantity, undefined, notes);
  },

  /** Record a purchase / restock */
  restock(productId: string, quantity: number, reference?: string, notes?: string): StockMovement | null {
    return this.recordMovement(productId, 'purchase', Math.abs(quantity), reference, notes);
  },

  /** Record a return (stock comes back in) */
  recordReturn(productId: string, quantity: number, reference?: string, notes?: string): StockMovement | null {
    return this.recordMovement(productId, 'return', Math.abs(quantity), reference, notes);
  },

  // ── Low stock ─────────────────────────────────────────────────────────────

  /** Get all products at or below their reorder point */
  getLowStockProducts(): Product[] {
    return repository
      .getAll('products')
      .filter((p) => p.stock <= (p.reorderPoint ?? 0));
  },

  /** Get all out-of-stock products */
  getOutOfStockProducts(): Product[] {
    return repository.getAll('products').filter((p) => p.stock === 0);
  },

  // ── Stats ─────────────────────────────────────────────────────────────────

  /** Total inventory value (stock × cost) */
  getTotalStockValue(): number {
    return repository
      .getAll('products')
      .reduce((sum, p) => sum + p.stock * p.cost, 0);
  },

  /** Total retail value (stock × price) */
  getTotalRetailValue(): number {
    return repository
      .getAll('products')
      .reduce((sum, p) => sum + p.stock * p.price, 0);
  },

  /** Count of movements in the last N days */
  getRecentMovementCount(days = 30): number {
    const since = new Date(Date.now() - days * 86400000);
    return repository
      .getAll('stockMovements')
      .filter((m) => new Date(m.createdAt) >= since).length;
  },

  // ── Reorder settings ──────────────────────────────────────────────────────

  /** Update reorder point and quantity for a product */
  updateReorderSettings(
    productId: string,
    reorderPoint: number,
    reorderQuantity: number
  ): boolean {
    return repository.update('products', productId, { reorderPoint, reorderQuantity });
  },
};
