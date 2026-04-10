/**
 * Accounting Integration Service.
 * Auto-posts journal entries for business events (sales, purchases, payments, returns).
 * All calls are silent — no toasts. Errors are logged to console only.
 */

import { journalService } from './journalService';
import { accountService } from './accountService';
import { fiscalPeriodService } from './fiscalPeriodService';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';
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

      const ar = this.getAccountByCode('1100');
      const revenue = this.getAccountByCode('4000');
      const taxPayable = this.getAccountByCode('2200');
      if (!ar || !revenue) return;

      const lines = [
        this.makeLine(ar.id, ar.code, ar.name, sale.total, 0),
        this.makeLine(revenue.id, revenue.code, revenue.name, 0, sale.subtotal - sale.discount),
      ];
      if (taxPayable && sale.taxAmount > 0) {
        lines.push(this.makeLine(taxPayable.id, taxPayable.code, taxPayable.name, 0, sale.taxAmount));
      }

      await journalService.createEntry({
        date: getCurrentISODate(),
        description: `Sale: ${sale.orderNumber}`,
        reference: sale.orderNumber,
        sourceType: 'sale',
        sourceId: sale.id,
        lines,
        totalDebit: sale.total,
        totalCredit: sale.total,
        status: 'posted',
        fiscalPeriodId: periodId,
      });
    } catch (err) {
      console.error('[AccountingIntegration] postSaleEntry failed:', err);
    }
  }

  async postInvoicePaymentEntry(invoice: Invoice, amountPaid: number, _paymentMethod: string): Promise<void> {
    try {
      const periodId = this.getCurrentPeriodId();
      if (!periodId) return;

      const cash = this.getAccountByCode('1000');
      const ar = this.getAccountByCode('1100');
      if (!cash || !ar) return;

      await journalService.createEntry({
        date: getCurrentISODate(),
        description: `Payment received: ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        sourceType: 'invoice_payment',
        sourceId: invoice.id,
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

      const inventory = this.getAccountByCode('1200');
      const ap = this.getAccountByCode('2000');
      if (!inventory || !ap) return;

      const lines = [
        this.makeLine(inventory.id, inventory.code, inventory.name, purchase.subtotal, 0),
      ];
      if (purchase.taxAmount > 0) {
        // Tax on purchases is an asset (tax receivable) — use prepaid expenses account
        const prepaid = this.getAccountByCode('1300');
        if (prepaid) lines.push(this.makeLine(prepaid.id, prepaid.code, prepaid.name, purchase.taxAmount, 0));
      }
      lines.push(this.makeLine(ap.id, ap.code, ap.name, 0, purchase.total));

      await journalService.createEntry({
        date: getCurrentISODate(),
        description: `Purchase received: ${purchase.poNumber}`,
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

      const ap = this.getAccountByCode('2000');
      const cash = this.getAccountByCode('1000');
      if (!ap || !cash) return;

      await journalService.createEntry({
        date: getCurrentISODate(),
        description: `Purchase payment: ${purchase.poNumber}`,
        reference: purchase.poNumber,
        sourceType: 'purchase_payment',
        sourceId: purchase.id,
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

      const revenue = this.getAccountByCode('4000');
      const ar = this.getAccountByCode('1100');
      const cash = this.getAccountByCode('1000');
      if (!revenue) return;

      const refundAccount = returnRecord.refundMethod === 'cash' ? cash : ar;
      if (!refundAccount) return;

      const lines = [
        this.makeLine(revenue.id, revenue.code, revenue.name, returnRecord.refundAmount, 0),
        this.makeLine(refundAccount.id, refundAccount.code, refundAccount.name, 0, returnRecord.refundAmount),
      ];

      if (returnRecord.restockItems) {
        const inventory = this.getAccountByCode('1200');
        const cogs = this.getAccountByCode('5000');
        if (inventory && cogs) {
          const costValue = returnRecord.items.reduce((s, i) => s + i.unitPrice * i.quantity * 0.65, 0);
          if (costValue > 0) {
            lines.push(this.makeLine(inventory.id, inventory.code, inventory.name, costValue, 0));
            lines.push(this.makeLine(cogs.id, cogs.code, cogs.name, 0, costValue));
          }
        }
      }

      const total = returnRecord.refundAmount;
      await journalService.createEntry({
        date: getCurrentISODate(),
        description: `Return refund: ${returnRecord.returnNumber}`,
        reference: returnRecord.returnNumber,
        sourceType: 'return_refund',
        sourceId: returnRecord.id,
        lines,
        totalDebit: total,
        totalCredit: total,
        status: 'posted',
        fiscalPeriodId: periodId,
      });
    } catch (err) {
      console.error('[AccountingIntegration] postReturnEntry failed:', err);
    }
  }

  async reverseEntryForSource(sourceType: JournalEntrySource, sourceId: string): Promise<void> {
    try {
      const entry = journalService.getBySource(sourceType, sourceId);
      if (!entry || entry.status !== 'posted') return;
      await journalService.reverseEntry(entry.id, getCurrentISODate(), `REV:${entry.entryNumber}`);
    } catch (err) {
      console.error('[AccountingIntegration] reverseEntryForSource failed:', err);
    }
  }
}

export const accountingIntegrationService = new AccountingIntegrationService();
