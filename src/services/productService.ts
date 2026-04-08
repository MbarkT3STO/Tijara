/**
 * Product business logic service.
 */

import { repository } from '@data/excelRepository';
import type { Product } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

export const productService = {
  /** Get all products */
  getAll(): Product[] {
    return repository.getAll('products');
  },

  /** Get product by ID */
  getById(id: string): Product | undefined {
    return repository.getById('products', id);
  },

  /** Get all unique categories */
  getCategories(): string[] {
    const cats = repository.getAll('products').map((p) => p.category);
    return [...new Set(cats)].sort();
  },

  /** Create a new product */
  create(data: Omit<Product, 'id' | 'createdAt'>): Product {
    const product: Product = {
      ...data,
      id: generateId(),
      createdAt: getCurrentISODate(),
    };
    repository.insert('products', product);
    return product;
  },

  /** Update an existing product */
  update(id: string, data: Partial<Omit<Product, 'id' | 'createdAt'>>): boolean {
    return repository.update('products', id, data);
  },

  /** Delete a product */
  delete(id: string): boolean {
    return repository.delete('products', id);
  },

  /** Adjust stock level */
  adjustStock(id: string, delta: number): boolean {
    const product = repository.getById('products', id);
    if (!product) return false;
    return repository.update('products', id, { stock: Math.max(0, product.stock + delta) });
  },

  /** Search products */
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
