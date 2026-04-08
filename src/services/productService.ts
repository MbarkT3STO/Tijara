/**
 * Product business logic service.
 */

import { repository } from '@data/excelRepository';
import { inventoryService } from './inventoryService';
import type { Product } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

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
      reorderPoint: 0,
      reorderQuantity: 0,
      ...data,
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
        'Initial stock on product creation'
      );
    }

    return product;
  },

  update(id: string, data: Partial<Omit<Product, 'id' | 'createdAt'>>): boolean {
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
