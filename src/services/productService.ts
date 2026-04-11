/**
 * Product business logic service.
 */

import { repository } from '@data/excelRepository';
import { inventoryService } from './inventoryService';
import { authService } from './authService';
import type { Product, ProductCostHistory } from '@core/types';
import { generateId, getCurrentISODate, autoNote } from '@shared/utils/helpers';

export const productService = {
  getAll(): Product[] {
    return repository.getAll('products');
  },

  getById(id: string): Product | undefined {
    return repository.getById('products', id);
  },

  getCategories(): string[] {
    const cats = repository.getAll('products').map((p) => p.category);
    return [...new Set(cats)].sort();
  },

  /** Create a new product and record an initial stock movement if stock > 0 */
  create(data: Omit<Product, 'id' | 'createdAt'>): Product {
    const product: Product = {
      ...data,
      reorderPoint: data.reorderPoint ?? 0,
      reorderQuantity: data.reorderQuantity ?? 0,
      id: generateId(),
      createdAt: getCurrentISODate(),
    };
    repository.insert('products', product);

    // Record initial stock as a movement
    if (product.stock > 0) {
      inventoryService.recordMovement(
        product.id,
        'initial',
        product.stock,
        undefined,
        autoNote('initialStock', '')
      );
    }

    return product;
  },

  update(id: string, data: Partial<Omit<Product, 'id' | 'createdAt'>>): boolean {
    // If cost is changing, record the history
    if (data.cost !== undefined) {
      const existing = repository.getById('products', id);
      if (existing && existing.cost !== data.cost) {
        const history: ProductCostHistory = {
          id: generateId(),
          productId: id,
          productName: existing.name,
          oldCost: existing.cost,
          newCost: data.cost,
          changedAt: getCurrentISODate(),
          changedBy: authService.getUser()?.name,
        };
        repository.insert('productCostHistory', history);
      }
    }
    return repository.update('products', id, data);
  },

  delete(id: string): boolean {
    return repository.delete('products', id);
  },

  /** Adjust stock and record a movement */
  adjustStock(id: string, delta: number, notes?: string): boolean {
    return !!inventoryService.adjust(id, delta, notes);
  },

  search(query: string): Product[] {
    const q = query.toLowerCase();
    return repository
      .getAll('products')
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
  },
};
