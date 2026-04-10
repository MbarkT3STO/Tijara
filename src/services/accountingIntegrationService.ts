/**
 * Accounting Integration Service.
 * Auto-posts journal entries for business events (sales, purchases, payments, returns).
 * All calls are silent — no toasts. Errors are logged to console only.
 */

import { journalService } from './journalService';
import { accountService } from './accountService';
import { fiscalPeriodService } from './fiscalPeriodService';
import { productService } from './productService';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { Sale, Invoice, Purchase, Return, Account, JournalEntrySource } from '@core/types';

class AccountingIntegrationService {

  private getCurrentPeriodId(): string {
    const period = fiscalPeriodService.getCurrent() ?? fiscalPeriodService.getOpen()[0];
    return period?.id ?? '';
  }

  private getAccountByCode(code: string): Account | undefined {
    return accountService.getByCode(code);
  }

  private makeLine(accountId: string, accountCode: string, accountName: string, debit: number, credit: number) {
    return { id: generateId(), accountId, accountCode, accountName, debit, credit };
  }

  async postSaleEntry(sale: Sale): Promise<void> {
    try {
      const periodId = this.getCurrentPeriodId();
      if (!periodId) return;

      // Duplicate guard
      const existing = journalService.getBySource('sale', sale.id);
      if (existing && existing.status !== 'reversed') return;

      const ar         = this.getAccountByCode('3411') ?? this.getAccountByCode('1100');
      const revenue    = this.getAccountByCode('7111') ?? this.getAccountByCode('4000');
      const taxPayable = this.getAccountByCode('4443') ?? this.getAccountByCode('2200');
      if (!ar || !revenue) return;

      // ── Entry 1: Revenue recognition ──────────────────────────────────────
      const revenueLines = [
        this.makeLine(ar.id, ar.code, ar.name, sale.total, 0),
        this.makeLine(revenue.id, revenue.code, revenue.name, 0, sale.subtotal - sale.discount),
      ];
      if (taxPayable && sale.taxAmount > 0) {
        revenueLines.push(
          this.makeLine(taxPayable.id, taxPayable.code, taxPayable.name, 0, sale.taxAmount)
        );
      }

      await journalService.createEntry({
        date: sale.createdAt.split('T')[0],
        description: `${i18n.t('accounting.integration.saleRevenue' as any)}: ${sale.orderNumber}`,
        reference: sale.orderNumber,
        sourceType: 'sale',
        sourceId: sale.id,
        lines: revenueLines,
        totalDebit: sale.total,
        totalCredit: sale.total,
        status: 'posted',
        fiscalPeriodId: periodId,
      });

      // ── Entry 2: COGS recognition ──────────────────────────────────────────
      const inventory = this.getAccountByCode('3111') ?? this.getAccountByCode('1200');
      const cogs      = this.getAccountByCode('6111') ?? this.getAccountByCode('5000');
      if (inventory && cogs) {
        const totalCost = sale.items.reduce((sum, item) => {
          const product = productService.getById(item.productId);
          return sum + item.quantity * (product?.cost ?? 0);
        }, 0);

        if (totalCost > 0) {
          // Duplicate guard for COGS entry
          const existingCogs = journalService.getBySource('sale', `${sale.id}_cogs`);
          if (!existingCogs || existingCogs.status === 'reversed') {
            await journalService.createEntry({
              date: sale.createdAt.split('T')[0],
              description: `${i18n.t('accounting.integration.saleCogs' as any)}: ${sale.orderNumber}`,
              reference: sale.orderNumber,
              sourceType: 'sale',
              sourceId: `${sale.id}_cogs`,
              lines: [
                this.makeLine(cogs.id, cogs.code, cogs.name, totalCost, 0),
                this.makeLine(inventory.id, inventory.code, inventory.name, 0, totalCost),
              ],
              totalDebit: totalCost,
              totalCredit: totalCost,
              status: 'posted',
              fiscalPeriodId: periodId,
            });
          }
        }
      }
    } catch (err) {
      console.error('[AccountingIntegration] postSaleEntry failed:', err);
    }
  }

  async postInvoicePaymentEntry(invoice: Invoice, amountPaid: number, _paymentMethod: string): Promise<void> {
    try {
      if (amountPaid <= 0) return;
      const periodId = this.getCurrentPeriodId();
      if (!periodId) return;

      // For partial payments: use a unique sourceId per payment installment
      const existingPayments = journalService.getAll().filter(
        (e) => e.sourceType === 'invoice_payment' &&
               e.sourceId?.startsWith(invoice.id) &&
               e.status !== 'reversed'
      );
      const paymentIndex = existingPayments.length + 1;
      const paymentSourceId = existingPayments.length === 0
        ? invoice.id                       // first payment keeps simple id
        : `${invoice.id}_p${paymentIndex}`; // subsequent payments get suffix

      const cash = this.getAccountByCode('5161') ?? this.getAccountByCode('5141') ?? this.getAccountByCode('1000');
      const ar   = this.getAccountByCode('3411') ?? this.getAccountByCode('1100');
      if (!cash || !ar) return;

      const description = existingPayments.length === 0
        ? `${i18n.t('accounting.integration.invoicePayment' as any)}: ${invoice.invoiceNumber}`
        : `${i18n.t('accounting.integration.invoicePartialPayment' as any)} #${paymentIndex}: ${invoice.invoiceNumber}`;

      await journalService.createEntry({
        date: getCurrentISODate(),
        description,
        reference: invoice.invoiceNumber,
        sourceType: 'invoice_payment',
        sourceId: paymentSourceId,
        lines: [
          this.makeLine(cash.id, cash.code, cash.name, amountPaid, 0),
          this.makeLine(ar.id, ar.code, ar.name, 0, amountPaid),
        ],
        totalDebit: amountPaid,
        totalCredit: amountPaid,
        status: 'posted',
        fiscalPeriodId: periodId,
      });
    } catch (err) {
      console.error('[AccountingIntegration] postInvoicePaymentEntry failed:', err);
    }
  }

  async postPurchaseEntry(purchase: Purchase): Promise<void> {
    try {
      const periodId = this.getCurrentPeriodId();
      if (!periodId) return;

      // Duplicate guard
      const existing = journalService.getBySource('purchase', purchase.id);
      if (existing && existing.status !== 'reversed') return;

      const inventory = this.getAccountByCode('1200');
      const ap = this.getAccountByCode('2000');
      if (!inventory || !ap) return;

      const lines = [
        this.makeLine(inventory.id, inventory.code, inventory.name, purchase.subtotal, 0),
      ];
      if (purchase.taxAmount > 0) {
        // Try TVA récupérable (CGNC 3455) first, fall back to 1300
        const tvaRecuperable = this.getAccountByCode('3455') ?? this.getAccountByCode('1300');
        if (tvaRecuperable) {
          lines.push(this.makeLine(tvaRecuperable.id, tvaRecuperable.code, tvaRecuperable.name, purchase.taxAmount, 0));
        }
      }
      lines.push(this.makeLine(ap.id, ap.code, ap.name, 0, purchase.total));

      await journalService.createEntry({
        date: getCurrentISODate(),
        description: `${i18n.t('accounting.integration.purchaseReceived' as any)}: ${purchase.poNumber}`,
        reference: purchase.poNumber,
        sourceType: 'purchase',
        sourceId: purchase.id,
        lines,
        totalDebit: purchase.total,
        totalCredit: purchase.total,
        status: 'posted',
        fiscalPeriodId: periodId,
      });
    } catch (err) {
      console.error('[AccountingIntegration] postPurchaseEntry failed:', err);
    }
  }

  async postPurchasePaymentEntry(purchase: Purchase, amountPaid: number): Promise<void> {
    try {
      const periodId = this.getCurrentPeriodId();
      if (!periodId) return;
      if (amountPaid <= 0) return;

      // Allow multiple partial payment entries (mirrors invoice payment logic)
      const existingPayments = journalService.getAll().filter(
        (e) => e.sourceType === 'purchase_payment' &&
               e.sourceId?.startsWith(purchase.id) &&
               e.status !== 'reversed'
      );
      const paymentIndex = existingPayments.length + 1;
      const paymentSourceId = existingPayments.length === 0
        ? purchase.id
        : `${purchase.id}_p${paymentIndex}`;

      const ap = this.getAccountByCode('4411') ?? this.getAccountByCode('2000');
      const cash = this.getAccountByCode('5161') ?? this.getAccountByCode('5141') ?? this.getAccountByCode('1000');
      if (!ap || !cash) return;

      const description = existingPayments.length === 0
        ? `${i18n.t('accounting.integration.purchasePayment' as any)}: ${purchase.poNumber}`
        : `${i18n.t('accounting.integration.purchasePayment' as any)} #${paymentIndex}: ${purchase.poNumber}`;

      await journalService.createEntry({
        date: getCurrentISODate(),
        description,
        reference: purchase.poNumber,
        sourceType: 'purchase_payment',
        sourceId: paymentSourceId,
        lines: [
          this.makeLine(ap.id, ap.code, ap.name, amountPaid, 0),
          this.makeLine(cash.id, cash.code, cash.name, 0, amountPaid),
        ],
        totalDebit: amountPaid,
        totalCredit: amountPaid,
        status: 'posted',
        fiscalPeriodId: periodId,
      });
    } catch (err) {
      console.error('[AccountingIntegration] postPurchasePaymentEntry failed:', err);
    }
  }

  async postReturnEntry(returnRecord: Return): Promise<void> {
    try {
      const periodId = this.getCurrentPeriodId();
      if (!periodId) return;

      // Duplicate guard
      const existing = journalService.getBySource('return_refund', returnRecord.id);
      if (existing && existing.status !== 'reversed') return;

      const revenue = this.getAccountByCode('7111') ?? this.getAccountByCode('4000');
      const ar      = this.getAccountByCode('3411') ?? this.getAccountByCode('1100');
      const cash    = this.getAccountByCode('5161') ?? this.getAccountByCode('5141') ?? this.getAccountByCode('1000');
      if (!revenue) return;

      const refundAccount = returnRecord.refundMethod === 'cash' ? cash : ar;
      if (!refundAccount) return;

      const lines = [
        this.makeLine(revenue.id, revenue.code, revenue.name, returnRecord.refundAmount, 0),
        this.makeLine(refundAccount.id, refundAccount.code, refundAccount.name, 0, returnRecord.refundAmount),
      ];

      let cogsReversal = 0;

      if (returnRecord.restockItems) {
        const inventory = this.getAccountByCode('3111') ?? this.getAccountByCode('1200');
        const cogs      = this.getAccountByCode('6111') ?? this.getAccountByCode('5000');
        if (inventory && cogs) {
          // Use actual product cost, not a magic ratio
          const costValue = returnRecord.items.reduce((s, item) => {
            const product = productService.getById(item.productId);
            return s + item.quantity * (product?.cost ?? 0);
          }, 0);
          if (costValue > 0) {
            lines.push(this.makeLine(inventory.id, inventory.code, inventory.name, costValue, 0));
            lines.push(this.makeLine(cogs.id, cogs.code, cogs.name, 0, costValue));
            cogsReversal = costValue;
          }
        }
      }

      // totalDebit and totalCredit must include ALL lines
      const totalDebit = returnRecord.refundAmount + cogsReversal;
      const totalCredit = returnRecord.refundAmount + cogsReversal;

      await journalService.createEntry({
        date: returnRecord.createdAt.split('T')[0],
        description: `${i18n.t('accounting.integration.returnRefund' as any)}: ${returnRecord.returnNumber}`,
        reference: returnRecord.returnNumber,
        sourceType: 'return_refund',
        sourceId: returnRecord.id,
        lines,
        totalDebit,
        totalCredit,
        status: 'posted',
        fiscalPeriodId: periodId,
      });
    } catch (err) {
      console.error('[AccountingIntegration] postReturnEntry failed:', err);
    }
  }

  /**
   * Called when a manual stock adjustment is made (positive = stock in, negative = stock out).
   * Dr/Cr Inventory vs Stock Adjustment Expense (positive qty) or Inventory Loss (negative qty).
   */
  async postInventoryAdjustmentEntry(
    productId: string,
    productName: string,
    qtyChange: number,
    notes?: string
  ): Promise<void> {
    try {
      if (qtyChange === 0) return;
      const periodId = this.getCurrentPeriodId();
      if (!periodId) return;

      const product = productService.getById(productId);
      if (!product || product.cost <= 0) return;

      const costValue = Math.abs(qtyChange) * product.cost;
      const inventory = this.getAccountByCode('3111') ?? this.getAccountByCode('1200');

      // Try CGNC account 6395 for losses, fall back to general expense account
      const adjustmentAccount = qtyChange < 0
        ? (this.getAccountByCode('6395') ?? this.getAccountByCode('6000'))  // expense
        : (this.getAccountByCode('7171') ?? this.getAccountByCode('4100')); // income/reversal

      if (!inventory || !adjustmentAccount) return;

      const description = notes
        ? `${i18n.t('accounting.integration.inventoryAdjust' as any)}: ${productName} — ${notes}`
        : `${i18n.t('accounting.integration.inventoryAdjust' as any)}: ${productName}`;

      const lines = qtyChange < 0
        ? [
            // Stock write-down: Dr Expense / Cr Inventory
            this.makeLine(adjustmentAccount.id, adjustmentAccount.code, adjustmentAccount.name, costValue, 0),
            this.makeLine(inventory.id, inventory.code, inventory.name, 0, costValue),
          ]
        : [
            // Stock addition: Dr Inventory / Cr Adjustment Income
            this.makeLine(inventory.id, inventory.code, inventory.name, costValue, 0),
            this.makeLine(adjustmentAccount.id, adjustmentAccount.code, adjustmentAccount.name, 0, costValue),
          ];

      await journalService.createEntry({
        date: getCurrentISODate(),
        description,
        reference: undefined,
        sourceType: 'inventory_adjustment',
        sourceId: `inv_adj_${productId}_${Date.now()}`,
        lines,
        totalDebit: costValue,
        totalCredit: costValue,
        status: 'posted',
        fiscalPeriodId: periodId,
      });
    } catch (err) {
      console.error('[AccountingIntegration] postInventoryAdjustmentEntry failed:', err);
    }
  }

  async reverseEntryForSource(sourceType: JournalEntrySource, sourceId: string): Promise<void> {
    try {
      // Reverse the main entry
      const entry = journalService.getBySource(sourceType, sourceId);
      if (entry && entry.status === 'posted') {
        await journalService.reverseEntry(
          entry.id,
          getCurrentISODate(),
          `REV: ${entry.entryNumber}`
        );
      }

      // For sales: also reverse the COGS entry if it exists
      if (sourceType === 'sale') {
        const cogsEntry = journalService.getBySource(sourceType, `${sourceId}_cogs`);
        if (cogsEntry && cogsEntry.status === 'posted') {
          await journalService.reverseEntry(
            cogsEntry.id,
            getCurrentISODate(),
            `REV COGS: ${cogsEntry.entryNumber}`
          );
        }
      }

      // For invoice_payment: also reverse any partial payment entries (_p2, _p3, ...)
      if (sourceType === 'invoice_payment') {
        let i = 2;
        while (true) {
          const partialEntry = journalService.getBySource(sourceType, `${sourceId}_p${i}`);
          if (!partialEntry) break;
          if (partialEntry.status === 'posted') {
            await journalService.reverseEntry(
              partialEntry.id,
              getCurrentISODate(),
              `REV: ${partialEntry.entryNumber}`
            );
          }
          i++;
          if (i > 50) break;
        }
      }

      // For purchase_payment: also reverse any partial payment entries (_p2, _p3, ...)
      if (sourceType === 'purchase_payment') {
        let i = 2;
        while (true) {
          const partialEntry = journalService.getBySource(sourceType, `${sourceId}_p${i}`);
          if (!partialEntry) break;
          if (partialEntry.status === 'posted') {
            await journalService.reverseEntry(
              partialEntry.id,
              getCurrentISODate(),
              `REV: ${partialEntry.entryNumber}`
            );
          }
          i++;
          if (i > 50) break;
        }
      }
    } catch (err) {
      console.error('[AccountingIntegration] reverseEntryForSource failed:', err);
    }
  }
}

export const accountingIntegrationService = new AccountingIntegrationService();
