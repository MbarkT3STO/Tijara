/**
 * Journal Service — core double-entry accounting engine.
 * Handles journal entries, account balances, and financial statement computation.
 */

import { repository } from '@data/excelRepository';
import { accountService } from './accountService';
import { fiscalPeriodService } from './fiscalPeriodService';
import type {
  JournalEntry, JournalEntrySource, LedgerEntry,
  TrialBalance, IncomeStatement, BalanceSheet,
  CashFlowStatement, TaxReport, AccountingStats,
  AccountType,
} from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';

class JournalService {
  getAll(): JournalEntry[] {
    return repository.getAll('journalEntries');
  }

  getById(id: string): JournalEntry | undefined {
    return repository.getById('journalEntries', id);
  }

  getByPeriod(periodId: string): JournalEntry[] {
    return this.getAll().filter((e) => e.fiscalPeriodId === periodId);
  }

  getBySource(sourceType: JournalEntrySource, sourceId: string): JournalEntry | undefined {
    return this.getAll().find((e) => e.sourceType === sourceType && e.sourceId === sourceId);
  }

  getPosted(): JournalEntry[] {
    return this.getAll().filter((e) => e.status === 'posted');
  }

  nextEntryNumber(): string {
    const year = new Date().getFullYear();
    const entries = this.getAll();
    const yearEntries = entries.filter((e) => e.entryNumber.startsWith(`JE-${year}-`));
    const maxNum = yearEntries.reduce((max, e) => {
      const num = parseInt(e.entryNumber.split('-')[2] ?? '0', 10);
      return num > max ? num : max;
    }, 0);
    return `JE-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  async createEntry(data: Omit<JournalEntry, 'id' | 'entryNumber' | 'createdAt' | 'updatedAt'>): Promise<JournalEntry> {
    // Validation
    if (data.lines.length < 2) throw new Error('ERR_MIN_TWO_LINES');

    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('ERR_MUST_BALANCE');
    }

    for (const line of data.lines) {
      if (line.debit > 0 && line.credit > 0) throw new Error('ERR_INVALID_LINE');
      if (line.debit === 0 && line.credit === 0) throw new Error('ERR_LINE_NON_ZERO');
      const acc = accountService.getById(line.accountId);
      if (!acc) throw new Error('ERR_ACCOUNT_NOT_FOUND');
      if (!acc.isActive) throw new Error(`ERR_ACCOUNT_INACTIVE:${acc.code}`);
    }

    if (data.status === 'posted') {
      const period = fiscalPeriodService.getById(data.fiscalPeriodId);
      if (!period || period.status !== 'open') throw new Error('ERR_PERIOD_CLOSED');
    }

    const now = getCurrentISODate();
    const entry: JournalEntry = {
      ...data,
      id: generateId(),
      entryNumber: this.nextEntryNumber(),
      totalDebit,
      totalCredit,
      createdAt: now,
      updatedAt: now,
      postedAt: data.status === 'posted' ? now : undefined,
    };
    repository.insert('journalEntries', entry);
    return entry;
  }

  async postEntry(id: string): Promise<JournalEntry> {
    const entry = this.getById(id);
    if (!entry) throw new Error('ERR_ENTRY_NOT_FOUND');
    if (entry.status !== 'draft') throw new Error('ERR_ONLY_DRAFT_CAN_BE_POSTED');

    const period = fiscalPeriodService.getById(entry.fiscalPeriodId);
    if (!period || period.status !== 'open') throw new Error('ERR_PERIOD_CLOSED');

    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error('ERR_ENTRY_NOT_BALANCED');

    const now = getCurrentISODate();
    repository.update('journalEntries', id, { status: 'posted', postedAt: now, updatedAt: now });
    return this.getById(id)!;
  }

  async reverseEntry(id: string, date: string, description: string): Promise<JournalEntry> {
    const original = this.getById(id);
    if (!original) throw new Error('ERR_ENTRY_NOT_FOUND');
    if (original.status !== 'posted') throw new Error('ERR_ONLY_POSTED_CAN_BE_REVERSED');

    // Find open period for the reversal date
    const periods = fiscalPeriodService.getOpen();
    const period = periods.find((p) => p.startDate <= date && p.endDate >= date) ?? periods[0];
    if (!period) throw new Error('ERR_NO_OPEN_PERIOD');

    const reversalLines = original.lines.map((l) => ({
      ...l,
      id: generateId(),
      debit: l.credit,
      credit: l.debit,
    }));

    const reversal = await this.createEntry({
      date,
      description,
      reference: original.entryNumber,
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      lines: reversalLines,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      status: 'posted',
      fiscalPeriodId: period.id,
    });

    repository.update('journalEntries', id, {
      status: 'reversed',
      reversalEntryId: reversal.id,
      updatedAt: getCurrentISODate(),
    });

    return reversal;
  }

  async deleteDraft(id: string): Promise<void> {
    const entry = this.getById(id);
    if (!entry) throw new Error('ERR_ENTRY_NOT_FOUND');
    if (entry.status !== 'draft') throw new Error('ERR_ONLY_DRAFT_CAN_BE_DELETED');
    repository.delete('journalEntries', id);
  }

  // ── Account Balance Methods ───────────────────────────────────────────────

  getTotalDebits(accountId: string, startDate?: string, endDate?: string): number {
    return this.getPosted()
      .filter((e) => !startDate || e.date >= startDate)
      .filter((e) => !endDate || e.date <= endDate)
      .flatMap((e) => e.lines)
      .filter((l) => l.accountId === accountId)
      .reduce((s, l) => s + l.debit, 0);
  }

  getTotalCredits(accountId: string, startDate?: string, endDate?: string): number {
    return this.getPosted()
      .filter((e) => !startDate || e.date >= startDate)
      .filter((e) => !endDate || e.date <= endDate)
      .flatMap((e) => e.lines)
      .filter((l) => l.accountId === accountId)
      .reduce((s, l) => s + l.credit, 0);
  }

  getAccountBalance(accountId: string, asOf?: string): number {
    const account = accountService.getById(accountId);
    if (!account) return 0;
    const debits = this.getTotalDebits(accountId, undefined, asOf);
    const credits = this.getTotalCredits(accountId, undefined, asOf);
    // Normal balance logic: asset/expense = debit-normal, liability/equity/revenue = credit-normal
    if (account.normalBalance === 'debit') {
      return debits - credits;
    } else {
      return credits - debits;
    }
  }

  getLedgerEntries(accountId: string, startDate?: string, endDate?: string): LedgerEntry[] {
    const account = accountService.getById(accountId);
    if (!account) return [];

    // Opening balance = balance before startDate
    let runningBalance = startDate ? this.getAccountBalance(accountId, startDate) : 0;

    const entries = this.getPosted()
      .filter((e) => !startDate || e.date >= startDate)
      .filter((e) => !endDate || e.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    const result: LedgerEntry[] = [];
    for (const entry of entries) {
      for (const line of entry.lines.filter((l) => l.accountId === accountId)) {
        if (account.normalBalance === 'debit') {
          runningBalance += line.debit - line.credit;
        } else {
          runningBalance += line.credit - line.debit;
        }
        result.push({
          date: entry.date,
          entryNumber: entry.entryNumber,
          description: entry.description,
          reference: entry.reference,
          debit: line.debit,
          credit: line.credit,
          balance: runningBalance,
          journalEntryId: entry.id,
        });
      }
    }
    return result;
  }

  // ── Financial Statement Computations ─────────────────────────────────────

  computeTrialBalance(periodId: string): TrialBalance {
    const period = fiscalPeriodService.getById(periodId);
    const asOfDate = period?.endDate ?? getCurrentISODate();
    const accounts = accountService.getAll();

    // FIXED: use ALL posted entries up to the period's end date (cumulative)
    const postedEntries = this.getPosted().filter(
      (e) => e.date <= asOfDate.split('T')[0]
    );

    // PRE-AGGREGATE: build balance map once
    const balanceMap = new Map<string, { debits: number; credits: number }>();
    for (const entry of postedEntries) {
      for (const line of entry.lines) {
        const cur = balanceMap.get(line.accountId) ?? { debits: 0, credits: 0 };
        balanceMap.set(line.accountId, {
          debits: cur.debits + line.debit,
          credits: cur.credits + line.credit,
        });
      }
    }

    // Collect all account IDs that have at least one posted line
    const activeAccountIds = new Set(balanceMap.keys());

    const rows = accounts
      .filter((a) => activeAccountIds.has(a.id))
      .map((a) => {
        const { debits = 0, credits = 0 } = balanceMap.get(a.id) ?? {};
        const balance = a.normalBalance === 'debit' ? debits - credits : credits - debits;
        return {
          accountCode: a.code,
          accountName: a.name,
          accountType: a.type,
          debitBalance: a.normalBalance === 'debit' ? Math.max(0, balance) : 0,
          creditBalance: a.normalBalance === 'credit' ? Math.max(0, balance) : 0,
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebits = rows.reduce((s, r) => s + r.debitBalance, 0);
    const totalCredits = rows.reduce((s, r) => s + r.creditBalance, 0);

    return {
      periodId,
      asOf: asOfDate,
      rows,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  }

  computeIncomeStatement(startDate: string, endDate: string): IncomeStatement {
    const accounts = accountService.getAll();
    const start = startDate.split('T')[0];
    const end = endDate.split('T')[0];
    const postedEntries = this.getPosted().filter((e) => e.date >= start && e.date <= end);

    // PRE-AGGREGATE: build balance map once
    const balanceMap = new Map<string, { debits: number; credits: number }>();
    for (const entry of postedEntries) {
      for (const line of entry.lines) {
        const cur = balanceMap.get(line.accountId) ?? { debits: 0, credits: 0 };
        balanceMap.set(line.accountId, {
          debits: cur.debits + line.debit,
          credits: cur.credits + line.credit,
        });
      }
    }

    const getBalance = (accountId: string): number => {
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) return 0;
      const { debits = 0, credits = 0 } = balanceMap.get(accountId) ?? {};
      return acc.normalBalance === 'debit' ? debits - credits : credits - debits;
    };

    const buildRows = (type: AccountType, categories: string[]) =>
      accounts
        .filter((a) => a.type === type && categories.includes(a.category))
        .map((a) => ({ accountCode: a.code, accountName: a.name, amount: getBalance(a.id) }))
        .filter((r) => r.amount !== 0);

    const revenue = buildRows('revenue', ['operating_revenue']);
    const otherIncome = buildRows('revenue', ['other_revenue']);
    const cogs = buildRows('expense', ['cost_of_goods_sold']);
    const opEx = buildRows('expense', ['operating_expense']);
    const otherExpenses = buildRows('expense', ['other_expense']);
    const taxExpenseRows = buildRows('expense', ['tax_expense']);

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalCogs = cogs.reduce((s, r) => s + r.amount, 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalOpEx = opEx.reduce((s, r) => s + r.amount, 0);
    const operatingIncome = grossProfit - totalOpEx;
    const totalOtherIncome = otherIncome.reduce((s, r) => s + r.amount, 0);
    const totalOtherExpenses = otherExpenses.reduce((s, r) => s + r.amount, 0);
    const incomeBeforeTax = operatingIncome + totalOtherIncome - totalOtherExpenses;
    const taxExpense = taxExpenseRows.reduce((s, r) => s + r.amount, 0);
    const netIncome = incomeBeforeTax - taxExpense;

    // Add percentage of revenue
    const withPct = (rows: typeof revenue) => rows.map((r) => ({
      ...r,
      percentage: totalRevenue > 0 ? (r.amount / totalRevenue) * 100 : 0,
    }));

    // Resolve the matching fiscal period
    const matchingPeriod = fiscalPeriodService.getAll().find(
      (p) => p.startDate <= startDate && p.endDate >= endDate
    );

    return {
      periodId: matchingPeriod?.id ?? '',
      startDate,
      endDate,
      revenue: withPct(revenue),
      costOfGoodsSold: withPct(cogs),
      grossProfit,
      grossProfitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      operatingExpenses: withPct(opEx),
      operatingIncome,
      otherIncome: withPct(otherIncome),
      otherExpenses: withPct(otherExpenses),
      incomeBeforeTax,
      taxExpense,
      netIncome,
      netProfitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    };
  }

  computeBalanceSheet(asOf: string): BalanceSheet {
    const accounts = accountService.getAll();
    const asOfDate = asOf.split('T')[0];

    // PRE-AGGREGATE: build balance map once instead of re-scanning per account
    const allEntries = this.getPosted().filter((e) => e.date <= asOfDate);
    const balanceMap = new Map<string, { debits: number; credits: number }>();
    for (const entry of allEntries) {
      for (const line of entry.lines) {
        const cur = balanceMap.get(line.accountId) ?? { debits: 0, credits: 0 };
        balanceMap.set(line.accountId, {
          debits: cur.debits + line.debit,
          credits: cur.credits + line.credit,
        });
      }
    }

    const getBalance = (accountId: string): number => {
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) return 0;
      const { debits = 0, credits = 0 } = balanceMap.get(accountId) ?? {};
      return acc.normalBalance === 'debit' ? debits - credits : credits - debits;
    };

    const buildSection = (categories: string[]) =>
      accounts
        .filter((a) => categories.includes(a.category))
        .map((a) => ({ accountCode: a.code, accountName: a.name, amount: getBalance(a.id) }))
        .filter((r) => r.amount !== 0);

    const currentAssets = buildSection(['current_asset']);
    const fixedAssets = buildSection(['fixed_asset']);
    const otherAssets = buildSection(['other_asset']);
    const currentLiabilities = buildSection(['current_liability']);
    const longTermLiabilities = buildSection(['long_term_liability']);
    const equity = buildSection(['owners_equity', 'retained_earnings']);

    // Add current net income to equity
    const today = asOf;
    const yearStart = today.slice(0, 4) + '-01-01';
    const is = this.computeIncomeStatement(yearStart, today);
    if (is.netIncome !== 0) {
      equity.push({ accountCode: 'NET', accountName: i18n.t('accounting.balanceSheet.currentNetIncome' as any), amount: is.netIncome });
    }

    const totalCurrentAssets = currentAssets.reduce((s, r) => s + r.amount, 0);
    const totalFixedAssets = fixedAssets.reduce((s, r) => s + r.amount, 0);
    const totalOtherAssets = otherAssets.reduce((s, r) => s + r.amount, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets;
    const totalCurrentLiabilities = currentLiabilities.reduce((s, r) => s + r.amount, 0);
    const totalLongTermLiabilities = longTermLiabilities.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
    const totalEquity = equity.reduce((s, r) => s + r.amount, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      asOf,
      currentAssets,
      totalCurrentAssets,
      fixedAssets,
      totalFixedAssets,
      otherAssets,
      totalAssets,
      currentLiabilities,
      totalCurrentLiabilities,
      longTermLiabilities,
      totalLiabilities,
      equity,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    };
  }

  computeCashFlowStatement(startDate: string, endDate: string): CashFlowStatement {
    // Collect cash accounts by name/code pattern (supports both seed and CGNC accounts)
    const cashAccountIds = accountService.getAll()
      .filter((a) => {
        if (a.category !== 'current_asset') return false;
        const n = a.name.toLowerCase();
        return n.includes('cash') || n.includes('caisse') ||
               n.includes('bank') || n.includes('banque') ||
               n.includes('trésorerie') || a.code.startsWith('5');
      })
      .map((a) => a.id);

    const postedEntries = this.getPosted().filter((e) => e.date >= startDate && e.date <= endDate);

    // Simple indirect method: categorize by account type
    const operatingActivities: import('@core/types').CashFlowItem[] = [];
    const investingActivities: import('@core/types').CashFlowItem[] = [];
    const financingActivities: import('@core/types').CashFlowItem[] = [];

    // Net income from operations
    const is = this.computeIncomeStatement(startDate, endDate);
    operatingActivities.push({ description: i18n.t('accounting.cashFlow.netIncome' as any), amount: is.netIncome });

    // Changes in working capital — use code-based lookup (CGNC + seed fallback)
    const arChange = this._getNetChangeByCode('3411', postedEntries) + this._getNetChangeByCode('1100', postedEntries);
    if (arChange !== 0) operatingActivities.push({ description: i18n.t('accounting.cashFlow.changeAR' as any), amount: -arChange });
    const invChange = this._getNetChangeByCode('3111', postedEntries) + this._getNetChangeByCode('1200', postedEntries);
    if (invChange !== 0) operatingActivities.push({ description: i18n.t('accounting.cashFlow.changeInventory' as any), amount: -invChange });
    const apChange = this._getNetChangeByCode('4411', postedEntries) + this._getNetChangeByCode('2000', postedEntries);
    if (apChange !== 0) operatingActivities.push({ description: i18n.t('accounting.cashFlow.changeAP' as any), amount: apChange });

    // Fixed asset changes → investing
    const fixedChange = this._getNetChangeByCode('2300', postedEntries) + this._getNetChangeByCode('1500', postedEntries);
    if (fixedChange !== 0) investingActivities.push({ description: i18n.t('accounting.cashFlow.capEx' as any), amount: -fixedChange });

    // Long-term debt changes → financing
    const debtChange = this._getNetChangeByCode('1410', postedEntries) + this._getNetChangeByCode('2500', postedEntries);
    if (debtChange !== 0) financingActivities.push({ description: i18n.t('accounting.cashFlow.longTermDebt' as any), amount: debtChange });

    const netOperating = operatingActivities.reduce((s, i) => s + i.amount, 0);
    const netInvesting = investingActivities.reduce((s, i) => s + i.amount, 0);
    const netFinancing = financingActivities.reduce((s, i) => s + i.amount, 0);
    const netChange = netOperating + netInvesting + netFinancing;

    // Opening cash = balance before startDate
    const openingCash = cashAccountIds.reduce((s, id) => s + this.getAccountBalance(id, startDate), 0);
    const closingCash = openingCash + netChange;

    return {
      startDate, endDate,
      operatingActivities, netOperatingCashFlow: netOperating,
      investingActivities, netInvestingCashFlow: netInvesting,
      financingActivities, netFinancingCashFlow: netFinancing,
      netChangeInCash: netChange,
      openingCash,
      closingCash,
    };
  }

  private _getAccountNetChange(accountId: string, entries: JournalEntry[]): number {
    const acc = accountService.getById(accountId);
    if (!acc) return 0;
    const debits = entries.flatMap((e) => e.lines).filter((l) => l.accountId === accountId).reduce((s, l) => s + l.debit, 0);
    const credits = entries.flatMap((e) => e.lines).filter((l) => l.accountId === accountId).reduce((s, l) => s + l.credit, 0);
    return acc.normalBalance === 'debit' ? debits - credits : credits - debits;
  }

  /** Get account balance by account code (supports both seed and CGNC codes) */
  private getBalanceByCode(code: string, asOf?: string): number {
    const account = accountService.getByCode(code);
    if (!account) return 0;
    return this.getAccountBalance(account.id, asOf);
  }

  /** Get net change for an account by code within a set of entries */
  private _getNetChangeByCode(code: string, entries: JournalEntry[]): number {
    const account = accountService.getByCode(code);
    if (!account) return 0;
    return this._getAccountNetChange(account.id, entries);
  }

  computeTaxReport(startDate: string, endDate: string): TaxReport {
    const taxRates = repository.getAll('taxRates');
    const postedEntries = this.getPosted().filter((e) => e.date >= startDate && e.date <= endDate);

    const lines = taxRates.filter((t) => t.isActive).map((t) => {
      const taxAmount = postedEntries
        .flatMap((e) => e.lines)
        .filter((l) => l.accountId === t.accountId)
        .reduce((s, l) => s + l.credit - l.debit, 0);
      const taxableAmount = t.rate > 0 ? (taxAmount / t.rate) * 100 : 0;
      return {
        taxCode: t.code,
        taxName: t.name,
        taxRate: t.rate,
        taxableAmount,
        taxAmount,
        accountId: t.accountId,
      };
    }).filter((l) => l.taxAmount !== 0);

    return {
      startDate, endDate,
      lines,
      totalTaxableAmount: lines.reduce((s, l) => s + l.taxableAmount, 0),
      totalTaxAmount: lines.reduce((s, l) => s + l.taxAmount, 0),
    };
  }

  computeAccountingStats(): AccountingStats {
    const today = getCurrentISODate();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const prevM = now.getMonth() === 0 ? '12' : String(now.getMonth()).padStart(2, '0');
    const prevY = now.getMonth() === 0 ? y - 1 : y;

    // Date-only strings — no toISOString() to avoid UTC timezone issues
    const monthStart = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const monthEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    const prevLastDay = new Date(prevY, now.getMonth() === 0 ? 0 : now.getMonth(), 0).getDate();
    const prevMonthStart = `${prevY}-${prevM}-01`;
    const prevMonthEnd = `${prevY}-${prevM}-${String(prevLastDay).padStart(2, '0')}`;

    const bs = this.computeBalanceSheet(today);
    const is = this.computeIncomeStatement(monthStart, monthEnd);
    const prevIs = this.computeIncomeStatement(prevMonthStart, prevMonthEnd);

    // Use code-based lookup: try CGNC codes first, fall back to seed codes
    const cashBalance = this.getBalanceByCode('5161', today)    // Caisse principale (CGNC)
                      + this.getBalanceByCode('5141', today)    // Banques (CGNC)
                      + this.getBalanceByCode('1000', today);   // Seed fallback

    const ar = this.getBalanceByCode('3411', today)             // Clients CGNC
             + this.getBalanceByCode('1100', today);            // Seed fallback

    const ap = this.getBalanceByCode('4411', today)             // Fournisseurs CGNC
             + this.getBalanceByCode('2000', today);            // Seed fallback

    const currentRevenue = is.revenue.reduce((s, r) => s + r.amount, 0);
    const currentExpenses = [...is.costOfGoodsSold, ...is.operatingExpenses, ...is.otherExpenses].reduce((s, r) => s + r.amount, 0);
    const prevRevenue = prevIs.revenue.reduce((s, r) => s + r.amount, 0);
    const prevExpenses = [...prevIs.costOfGoodsSold, ...prevIs.operatingExpenses, ...prevIs.otherExpenses].reduce((s, r) => s + r.amount, 0);

    return {
      totalAssets: bs.totalAssets,
      totalLiabilities: bs.totalLiabilities,
      totalEquity: bs.totalEquity,
      currentMonthRevenue: currentRevenue,
      currentMonthExpenses: currentExpenses,
      currentMonthNetIncome: is.netIncome,
      accountsReceivable: ar,
      accountsPayable: ap,
      cashBalance,
      revenueGrowth: prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0,
      expenseGrowth: prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0,
    };
  }
}

export const journalService = new JournalService();
