/**
 * Accounting settings sub-module: CGNC chart seeding, fiscal periods, tax rates.
 */

import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';
import { notifications } from '@core/notifications';
import { accountService } from '@services/accountService';
import type { AccountType, AccountCategory } from '@core/types';

interface MoroccanAccount {
  code: string; name: string; nameAr: string; nameFr: string;
  type: AccountType; category: AccountCategory;
  normalBalance: 'debit' | 'credit'; isSystem: boolean; isActive: boolean;
}

const MOROCCAN_ACCOUNTS: MoroccanAccount[] = [
  { code:'1111',name:'Capital social',nameAr:'رأس المال الاجتماعي',nameFr:'Capital social',type:'equity',category:'owners_equity',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1119',name:'Actionnaires, capital souscrit non appelé',nameAr:'المساهمون، رأس المال المكتتب غير المطلوب',nameFr:'Actionnaires, capital souscrit non appelé',type:'equity',category:'owners_equity',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'1121',name:'Réserve légale',nameAr:'الاحتياطي القانوني',nameFr:'Réserve légale',type:'equity',category:'retained_earnings',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1131',name:'Réserves statutaires ou contractuelles',nameAr:'الاحتياطيات النظامية أو التعاقدية',nameFr:'Réserves statutaires ou contractuelles',type:'equity',category:'retained_earnings',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1141',name:'Réserves facultatives',nameAr:'الاحتياطيات الاختيارية',nameFr:'Réserves facultatives',type:'equity',category:'retained_earnings',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1151',name:'Report à nouveau (solde créditeur)',nameAr:'الأرباح المرحلة (رصيد دائن)',nameFr:'Report à nouveau (solde créditeur)',type:'equity',category:'retained_earnings',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1161',name:'Report à nouveau (solde débiteur)',nameAr:'الخسائر المرحلة (رصيد مدين)',nameFr:'Report à nouveau (solde débiteur)',type:'equity',category:'retained_earnings',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'1181',name:"Résultat net en instance d'affectation",nameAr:'صافي النتيجة في انتظار التخصيص',nameFr:"Résultat net en instance d'affectation",type:'equity',category:'retained_earnings',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1311',name:"Subventions d'investissement reçues",nameAr:'الإعانات الاستثمارية المستلمة',nameFr:"Subventions d'investissement reçues",type:'equity',category:'owners_equity',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1411',name:'Emprunts obligataires',nameAr:'قروض سندية',nameFr:'Emprunts obligataires',type:'liability',category:'long_term_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1481',name:'Emprunts auprès des établissements de crédit',nameAr:'قروض لدى مؤسسات الائتمان',nameFr:'Emprunts auprès des établissements de crédit',type:'liability',category:'long_term_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'1491',name:'Dettes de financement diverses',nameAr:'ديون تمويل متنوعة',nameFr:'Dettes de financement diverses',type:'liability',category:'long_term_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'2110',name:'Terrains',nameAr:'الأراضي',nameFr:'Terrains',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2121',name:'Constructions — Bâtiments',nameAr:'المنشآت — المباني',nameFr:'Constructions — Bâtiments',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2130',name:'Installations techniques, matériel et outillage industriels',nameAr:'التجهيزات التقنية والمعدات الصناعية',nameFr:'Installations techniques, matériel et outillage industriels',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2140',name:'Matériel de transport',nameAr:'وسائل النقل',nameFr:'Matériel de transport',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2155',name:'Mobilier, matériel de bureau et aménagements divers',nameAr:'الأثاث ومعدات المكتب والتهيئات',nameFr:'Mobilier, matériel de bureau et aménagements divers',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2161',name:'Matériel informatique',nameAr:'المعدات المعلوماتية',nameFr:'Matériel informatique',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2210',name:'Immobilisations incorporelles — Brevets, marques',nameAr:'الأصول غير المادية — البراءات والعلامات',nameFr:'Immobilisations incorporelles — Brevets, marques',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2221',name:'Fonds commercial',nameAr:'الأصول التجارية',nameFr:'Fonds commercial',type:'asset',category:'fixed_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2320',name:'Titres de participation',nameAr:'سندات المساهمة',nameFr:'Titres de participation',type:'asset',category:'other_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'2810',name:'Amortissements des immobilisations corporelles',nameAr:'استهلاكات الأصول المادية',nameFr:'Amortissements des immobilisations corporelles',type:'asset',category:'fixed_asset',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'2820',name:'Amortissements des immobilisations incorporelles',nameAr:'استهلاكات الأصول غير المادية',nameFr:'Amortissements des immobilisations incorporelles',type:'asset',category:'fixed_asset',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'3111',name:'Marchandises',nameAr:'البضائع',nameFr:'Marchandises',type:'asset',category:'current_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'3121',name:'Matières premières',nameAr:'المواد الأولية',nameFr:'Matières premières',type:'asset',category:'current_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'3411',name:'Clients — Exercice courant',nameAr:'الزبناء — السنة الجارية',nameFr:'Clients — Exercice courant',type:'asset',category:'current_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'3451',name:'État — créances fiscales',nameAr:'الدولة — ديون ضريبية',nameFr:'État — créances fiscales',type:'asset',category:'current_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'3455',name:'État — TVA récupérable',nameAr:'الدولة — TVA القابلة للاسترداد',nameFr:'État — TVA récupérable',type:'asset',category:'current_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'5141',name:'Banques — comptes courants',nameAr:'البنوك — الحسابات الجارية',nameFr:'Banques — comptes courants',type:'asset',category:'current_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'5161',name:'Caisse principale',nameAr:'الصندوق الرئيسي',nameFr:'Caisse principale',type:'asset',category:'current_asset',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'4411',name:'Fournisseurs — exercice courant',nameAr:'الموردون — السنة الجارية',nameFr:'Fournisseurs — exercice courant',type:'liability',category:'current_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'4421',name:'Personnel — rémunérations dues',nameAr:'الأجور والمرتبات المستحقة',nameFr:'Personnel — rémunérations dues',type:'liability',category:'current_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'4441',name:'État — impôt sur les sociétés',nameAr:'الدولة — ضريبة الشركات (IS)',nameFr:'État — impôt sur les sociétés',type:'liability',category:'current_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'4443',name:'État — taxe sur la valeur ajoutée facturée',nameAr:'الدولة — TVA المحصلة',nameFr:'État — taxe sur la valeur ajoutée facturée',type:'liability',category:'current_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'4445',name:'État — TVA à décaisser',nameAr:'الدولة — TVA واجبة الأداء',nameFr:'État — TVA à décaisser',type:'liability',category:'current_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'4491',name:'Autres créanciers',nameAr:'دائنون آخرون',nameFr:'Autres créanciers',type:'liability',category:'current_liability',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'6111',name:"Achats de marchandises revendus en l'état",nameAr:'مشتريات البضائع المعاد بيعها',nameFr:"Achats de marchandises revendus en l'état",type:'expense',category:'cost_of_goods_sold',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'6122',name:'Locations et charges locatives',nameAr:'الإيجارات والأعباء الإيجارية',nameFr:'Locations et charges locatives',type:'expense',category:'operating_expense',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'6171',name:'Rémunérations du personnel',nameAr:'مرتبات الأفراد',nameFr:'Rémunérations du personnel',type:'expense',category:'operating_expense',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'6311',name:'Intérêts des emprunts et dettes',nameAr:'فوائد القروض والديون',nameFr:'Intérêts des emprunts et dettes',type:'expense',category:'other_expense',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'6701',name:'Impôts sur les bénéfices (IS)',nameAr:'ضريبة على الشركات',nameFr:'Impôts sur les bénéfices (IS)',type:'expense',category:'tax_expense',normalBalance:'debit',isSystem:false,isActive:true },
  { code:'7111',name:"Ventes de marchandises en l'état",nameAr:'مبيعات البضائع في حالتها',nameFr:"Ventes de marchandises en l'état",type:'revenue',category:'operating_revenue',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'7121',name:'Ventes de produits finis',nameAr:'مبيعات المنتجات التامة',nameFr:'Ventes de produits finis',type:'revenue',category:'operating_revenue',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'7125',name:'Ventes de services',nameAr:'مبيعات الخدمات',nameFr:'Ventes de services',type:'revenue',category:'operating_revenue',normalBalance:'credit',isSystem:false,isActive:true },
  { code:'7321',name:'Gains de change',nameAr:'مكاسب الصرف',nameFr:'Gains de change',type:'revenue',category:'other_revenue',normalBalance:'credit',isSystem:false,isActive:true },
];

function getAccountsByClass(classNum: number): MoroccanAccount[] {
  return MOROCCAN_ACCOUNTS.filter((a) => a.code.startsWith(String(classNum)));
}

interface WizardState {
  expanded: boolean;
  selected: Set<string>;
  classExpanded: Record<number, boolean>;
}

export const wizardState: WizardState = {
  expanded: false,
  selected: new Set(MOROCCAN_ACCOUNTS.map((a) => a.code)),
  classExpanded: { 1:false, 2:false, 3:false, 4:false, 5:false, 6:false, 7:false },
};

export function buildAccountingSetupHTML(): string {
  const existingCount = accountService.getAll().length;
  const total = MOROCCAN_ACCOUNTS.length;
  const selectedCount = wizardState.selected.size;

  const warningBanner = existingCount > 0
    ? `<div class="setup-warning">${Icons.alertTriangle(16)}<span>${i18n.t('settings.accountingSetup.existingWarning' as any, { count: existingCount })}</span></div>`
    : '';

  const classesHTML = [1,2,3,4,5,6,7].map((classNum) => {
    const accounts = getAccountsByClass(classNum);
    const label = i18n.t(`settings.accountingSetup.classLabels.${classNum}` as any);
    const isOpen = wizardState.classExpanded[classNum];
    const selectedInClass = accounts.filter((a) => wizardState.selected.has(a.code)).length;
    const accountRows = accounts.map((a) => `
      <label class="setup-account-row">
        <input type="checkbox" data-code="${a.code}" ${wizardState.selected.has(a.code) ? 'checked' : ''} />
        <span class="setup-account-code">${a.code}</span>
        <span class="setup-account-name">${a.name}</span>
        <span class="setup-account-name-ar">${a.nameAr}</span>
      </label>`).join('');
    return `
      <div class="setup-class" data-class="${classNum}">
        <div class="setup-class-header" data-toggle-class="${classNum}">
          <input type="checkbox" data-class-check="${classNum}" ${selectedInClass === accounts.length ? 'checked' : ''} style="flex-shrink:0;" />
          <span class="setup-class-code">CLASS ${classNum}</span>
          <span class="setup-class-name">${label}</span>
          <span class="setup-class-count">(${accounts.length})</span>
          <span class="setup-class-chevron" style="transform:${isOpen ? 'rotate(0deg)' : 'rotate(-90deg)'};">▼</span>
        </div>
        <div class="setup-class-body" id="setup-class-body-${classNum}" style="display:${isOpen ? 'block' : 'none'};">${accountRows}</div>
      </div>`;
  }).join('');

  return `
    <div class="card overflow-hidden" id="accounting-setup-section">
      <div class="card-header" style="background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border-subtle);cursor:pointer;" id="accounting-setup-toggle">
        <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;">
          <div style="color:var(--color-primary);">${Icons.accounting(20)}</div>
          <div>
            <h3 class="card-title">${i18n.t('settings.accountingSetup.title' as any)}</h3>
            <p style="font-size:var(--font-size-xs);color:var(--color-text-secondary);margin:0;">${i18n.t('settings.accountingSetup.subtitle' as any)}</p>
          </div>
        </div>
        <span id="accounting-setup-chevron" style="color:var(--color-text-tertiary);transition:transform var(--transition-fast);transform:${wizardState.expanded ? 'rotate(0deg)' : 'rotate(-90deg)'};">▼</span>
      </div>
      <div id="accounting-setup-body" style="display:${wizardState.expanded ? 'block' : 'none'};">
        <div class="card-body">
          <p style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin:0 0 var(--space-4);">${i18n.t('settings.accountingSetup.description' as any)}</p>
          ${warningBanner}
          <div class="setup-controls">
            <label class="setup-select-all">
              <input type="checkbox" id="setup-select-all" ${selectedCount === total ? 'checked' : ''} />
              ${selectedCount === total ? i18n.t('settings.accountingSetup.deselectAll' as any) : i18n.t('settings.accountingSetup.selectAll' as any)} (${total})
            </label>
            <span class="setup-counter" id="setup-counter">${selectedCount} ${i18n.t('settings.accountingSetup.accountsSelected' as any)}</span>
          </div>
          ${classesHTML}
          <div class="setup-footer">
            <span id="setup-selected-count" style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${selectedCount} ${i18n.t('settings.accountingSetup.accountsSelected' as any)}</span>
            <div class="setup-actions">
              <button class="btn btn-ghost btn-sm" id="setup-skip">${i18n.t('settings.accountingSetup.skipBtn' as any)}</button>
              <button class="btn btn-primary" id="setup-import" ${selectedCount === 0 ? 'disabled' : ''}>
                ${Icons.chartOfAccounts(16)} ${i18n.t('settings.accountingSetup.importBtn' as any)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateWizardCounter(container: HTMLElement): void {
  const count = wizardState.selected.size;
  container.querySelectorAll<HTMLElement>('#setup-counter, #setup-selected-count').forEach((el) => {
    el.textContent = `${count} ${i18n.t('settings.accountingSetup.accountsSelected' as any)}`;
  });
  const importBtn = container.querySelector<HTMLButtonElement>('#setup-import');
  if (importBtn) importBtn.disabled = count === 0;
  const allCb = container.querySelector<HTMLInputElement>('#setup-select-all');
  if (allCb) {
    allCb.indeterminate = count > 0 && count < MOROCCAN_ACCOUNTS.length;
    allCb.checked = count === MOROCCAN_ACCOUNTS.length;
  }
}

function updateClassCheckState(container: HTMLElement, classNum: number): void {
  const codes = getAccountsByClass(classNum).map((a) => a.code);
  const cb = container.querySelector<HTMLInputElement>(`[data-class-check="${classNum}"]`);
  if (!cb) return;
  const sel = codes.filter((c) => wizardState.selected.has(c)).length;
  cb.indeterminate = sel > 0 && sel < codes.length;
  cb.checked = sel === codes.length;
}

export function attachAccountingEvents(page: HTMLElement, rerender: () => void): void {
  page.querySelector('#accounting-setup-toggle')?.addEventListener('click', () => {
    wizardState.expanded = !wizardState.expanded;
    const body = page.querySelector<HTMLElement>('#accounting-setup-body');
    const chevron = page.querySelector<HTMLElement>('#accounting-setup-chevron');
    if (body) body.style.display = wizardState.expanded ? 'block' : 'none';
    if (chevron) chevron.style.transform = wizardState.expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
  });

  const allCheck = page.querySelector<HTMLInputElement>('#setup-select-all');
  allCheck?.addEventListener('change', () => {
    if (allCheck.checked) MOROCCAN_ACCOUNTS.forEach((a) => wizardState.selected.add(a.code));
    else wizardState.selected.clear();
    page.querySelectorAll<HTMLInputElement>('[data-code]').forEach((cb) => { cb.checked = wizardState.selected.has(cb.dataset.code!); });
    [1,2,3,4,5,6,7].forEach((n) => updateClassCheckState(page, n));
    updateWizardCounter(page);
  });

  page.querySelectorAll<HTMLInputElement>('[data-code]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) wizardState.selected.add(cb.dataset.code!);
      else wizardState.selected.delete(cb.dataset.code!);
      const classNum = parseInt(cb.closest<HTMLElement>('[data-class]')!.dataset.class!);
      updateClassCheckState(page, classNum);
      updateWizardCounter(page);
    });
  });

  page.querySelectorAll<HTMLInputElement>('[data-class-check]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const classNum = parseInt(cb.dataset.classCheck!);
      const codes = getAccountsByClass(classNum).map((a) => a.code);
      if (cb.checked) codes.forEach((c) => wizardState.selected.add(c));
      else codes.forEach((c) => wizardState.selected.delete(c));
      page.querySelectorAll<HTMLInputElement>('[data-code]').forEach((acb) => {
        if (codes.includes(acb.dataset.code!)) acb.checked = cb.checked;
      });
      updateWizardCounter(page);
    });
  });

  page.querySelectorAll<HTMLElement>('[data-toggle-class]').forEach((header) => {
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const classNum = parseInt(header.dataset.toggleClass!);
      wizardState.classExpanded[classNum] = !wizardState.classExpanded[classNum];
      const body = page.querySelector<HTMLElement>(`#setup-class-body-${classNum}`);
      const chevron = header.querySelector<HTMLElement>('.setup-class-chevron');
      if (body) body.style.display = wizardState.classExpanded[classNum] ? 'block' : 'none';
      if (chevron) chevron.style.transform = wizardState.classExpanded[classNum] ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  });

  page.querySelector('#setup-skip')?.addEventListener('click', () => {
    wizardState.expanded = false;
    const body = page.querySelector<HTMLElement>('#accounting-setup-body');
    const chevron = page.querySelector<HTMLElement>('#accounting-setup-chevron');
    if (body) body.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
  });

  page.querySelector('#setup-import')?.addEventListener('click', async () => {
    const toImport = MOROCCAN_ACCOUNTS.filter((a) => wizardState.selected.has(a.code));
    const newAccounts = toImport.filter((a) => accountService.isCodeUnique(a.code));
    if (newAccounts.length === 0) { notifications.info(i18n.t('settings.accountingSetup.allExist' as any)); return; }
    const btn = page.querySelector<HTMLButtonElement>('#setup-import')!;
    btn.disabled = true;
    btn.textContent = i18n.t('common.loading' as any);
    for (const acc of newAccounts) {
      await accountService.create({ code:acc.code, name:acc.name, nameAr:acc.nameAr, nameFr:acc.nameFr, type:acc.type, category:acc.category, normalBalance:acc.normalBalance, isSystem:false, isActive:true });
    }
    notifications.success(i18n.t('settings.accountingSetup.importSuccess' as any, { count: newAccounts.length }));
    wizardState.expanded = false;
    rerender();
  });
}
