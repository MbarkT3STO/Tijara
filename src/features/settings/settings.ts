/**
 * Settings page – theme, data management, app info.
 * Detects Electron environment and uses native dialogs when available.
 */

import { themeManager } from '@core/theme';
import { notifications } from '@core/notifications';
import { Icons } from '@shared/components/icons';
import { profileService } from '@services/profileService';
import { i18n } from '@core/i18n';
import { createLanguageSwitcher } from '@shared/components/languageSwitcher';
import { repository } from '@data/excelRepository';
import { layoutService } from '@core/layout';
import { sidebarThemeService } from '@core/sidebarTheme';
import { accountService } from '@services/accountService';
import { router } from '@core/router';
import type { AccountType, AccountCategory } from '@core/types';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

const isElectron = !!getElectron();

/** Common world currency codes for the selector */
const CURRENCIES: string[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'CHF', 'HKD',
  'SGD', 'SEK', 'NOK', 'DKK', 'NZD', 'MXN', 'BRL', 'ZAR', 'AED', 'SAR',
  'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'EGP', 'MAD', 'TND', 'DZD', 'LYD',
  'TRY', 'RUB', 'KRW', 'IDR', 'MYR', 'THB', 'PHP', 'PKR', 'BDT', 'NGN',
  'GHS', 'KES', 'ETB', 'TZS', 'UGX', 'XOF', 'XAF', 'ILS', 'CZK', 'PLN',
  'HUF', 'RON', 'HRK', 'BGN', 'CLP', 'COP', 'PEN', 'ARS',
];

// ── Moroccan CGNC Account List ────────────────────────────────────────────

interface MoroccanAccount {
  code: string;
  name: string;
  nameAr: string;
  nameFr: string;
  type: AccountType;
  category: AccountCategory;
  normalBalance: 'debit' | 'credit';
  isSystem: boolean;
  isActive: boolean;
}

const MOROCCAN_ACCOUNTS: MoroccanAccount[] = [
  // CLASS 1 — Financement Permanent
  { code: '1111', name: 'Capital social', nameAr: 'رأس المال الاجتماعي', nameFr: 'Capital social', type: 'equity', category: 'owners_equity', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1119', name: 'Actionnaires, capital souscrit non appelé', nameAr: 'المساهمون، رأس المال المكتتب غير المطلوب', nameFr: 'Actionnaires, capital souscrit non appelé', type: 'equity', category: 'owners_equity', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '1121', name: 'Réserve légale', nameAr: 'الاحتياطي القانوني', nameFr: 'Réserve légale', type: 'equity', category: 'retained_earnings', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1131', name: 'Réserves statutaires ou contractuelles', nameAr: 'الاحتياطيات النظامية أو التعاقدية', nameFr: 'Réserves statutaires ou contractuelles', type: 'equity', category: 'retained_earnings', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1141', name: 'Réserves facultatives', nameAr: 'الاحتياطيات الاختيارية', nameFr: 'Réserves facultatives', type: 'equity', category: 'retained_earnings', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1151', name: 'Report à nouveau (solde créditeur)', nameAr: 'الأرباح المرحلة (رصيد دائن)', nameFr: 'Report à nouveau (solde créditeur)', type: 'equity', category: 'retained_earnings', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1161', name: 'Report à nouveau (solde débiteur)', nameAr: 'الخسائر المرحلة (رصيد مدين)', nameFr: 'Report à nouveau (solde débiteur)', type: 'equity', category: 'retained_earnings', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '1181', name: 'Résultat net en instance d\'affectation', nameAr: 'صافي النتيجة في انتظار التخصيص', nameFr: 'Résultat net en instance d\'affectation', type: 'equity', category: 'retained_earnings', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1311', name: 'Subventions d\'investissement reçues', nameAr: 'الإعانات الاستثمارية المستلمة', nameFr: 'Subventions d\'investissement reçues', type: 'equity', category: 'owners_equity', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1411', name: 'Emprunts obligataires', nameAr: 'قروض سندية', nameFr: 'Emprunts obligataires', type: 'liability', category: 'long_term_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1481', name: 'Emprunts auprès des établissements de crédit', nameAr: 'قروض لدى مؤسسات الائتمان', nameFr: 'Emprunts auprès des établissements de crédit', type: 'liability', category: 'long_term_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '1491', name: 'Dettes de financement diverses', nameAr: 'ديون تمويل متنوعة', nameFr: 'Dettes de financement diverses', type: 'liability', category: 'long_term_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  // CLASS 2 — Actif Immobilisé
  { code: '2110', name: 'Terrains', nameAr: 'الأراضي', nameFr: 'Terrains', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2121', name: 'Constructions — Bâtiments', nameAr: 'المنشآت — المباني', nameFr: 'Constructions — Bâtiments', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2130', name: 'Installations techniques, matériel et outillage industriels', nameAr: 'التجهيزات التقنية والمعدات الصناعية', nameFr: 'Installations techniques, matériel et outillage industriels', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2140', name: 'Matériel de transport', nameAr: 'وسائل النقل', nameFr: 'Matériel de transport', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2155', name: 'Mobilier, matériel de bureau et aménagements divers', nameAr: 'الأثاث ومعدات المكتب والتهيئات', nameFr: 'Mobilier, matériel de bureau et aménagements divers', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2161', name: 'Matériel informatique', nameAr: 'المعدات المعلوماتية', nameFr: 'Matériel informatique', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2210', name: 'Immobilisations incorporelles — Brevets, marques', nameAr: 'الأصول غير المادية — البراءات والعلامات', nameFr: 'Immobilisations incorporelles — Brevets, marques', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2221', name: 'Fonds commercial', nameAr: 'الأصول التجارية', nameFr: 'Fonds commercial', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2320', name: 'Titres de participation', nameAr: 'سندات المساهمة', nameFr: 'Titres de participation', type: 'asset', category: 'other_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '2810', name: 'Amortissements des immobilisations corporelles', nameAr: 'استهلاكات الأصول المادية', nameFr: 'Amortissements des immobilisations corporelles', type: 'asset', category: 'fixed_asset', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '2820', name: 'Amortissements des immobilisations incorporelles', nameAr: 'استهلاكات الأصول غير المادية', nameFr: 'Amortissements des immobilisations incorporelles', type: 'asset', category: 'fixed_asset', normalBalance: 'credit', isSystem: false, isActive: true },
  // CLASS 3 — Actif Circulant
  { code: '3111', name: 'Marchandises', nameAr: 'البضائع', nameFr: 'Marchandises', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3121', name: 'Matières premières', nameAr: 'المواد الأولية', nameFr: 'Matières premières', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3131', name: 'Produits en cours', nameAr: 'منتجات قيد التصنيع', nameFr: 'Produits en cours', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3141', name: 'Produits intermédiaires et produits résiduels', nameAr: 'المنتجات الوسيطة والمتبقية', nameFr: 'Produits intermédiaires et produits résiduels', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3151', name: 'Produits finis', nameAr: 'المنتجات التامة', nameFr: 'Produits finis', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3411', name: 'Clients — Exercice courant', nameAr: 'الزبناء — السنة الجارية', nameFr: 'Clients — Exercice courant', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3421', name: 'Clients — Retenues de garantie', nameAr: 'الزبناء — احتجازات الضمان', nameFr: 'Clients — Retenues de garantie', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3431', name: 'Clients — Effets à recevoir', nameAr: 'الزبناء — أوراق قبض', nameFr: 'Clients — Effets à recevoir', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3441', name: 'Personnel — débiteur', nameAr: 'الأفراد المدينون', nameFr: 'Personnel — débiteur', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3451', name: 'État — créances fiscales', nameAr: 'الدولة — ديون ضريبية', nameFr: 'État — créances fiscales', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3455', name: 'État — TVA récupérable', nameAr: 'الدولة — TVA القابلة للاسترداد', nameFr: 'État — TVA récupérable', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3461', name: 'Associés — débiteurs divers', nameAr: 'الشركاء — المدينون المتنوعون', nameFr: 'Associés — débiteurs divers', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '3491', name: 'Provisions pour dépréciation des créances', nameAr: 'مؤونات انخفاض قيمة الديون', nameFr: 'Provisions pour dépréciation des créances', type: 'asset', category: 'current_asset', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '3511', name: 'Titres et valeurs de placement', nameAr: 'الأوراق المالية وسندات القيمة', nameFr: 'Titres et valeurs de placement', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  // CLASS 4 — Passif Circulant
  { code: '4411', name: 'Fournisseurs — exercice courant', nameAr: 'الموردون — السنة الجارية', nameFr: 'Fournisseurs — exercice courant', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4415', name: 'Fournisseurs — effets à payer', nameAr: 'الموردون — أوراق دفع', nameFr: 'Fournisseurs — effets à payer', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4421', name: 'Personnel — rémunérations dues', nameAr: 'الأجور والمرتبات المستحقة', nameFr: 'Personnel — rémunérations dues', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4432', name: 'Organismes sociaux — CNSS', nameAr: 'المنظمات الاجتماعية — الصندوق الوطني', nameFr: 'Organismes sociaux — CNSS', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4441', name: 'État — impôt sur les sociétés', nameAr: 'الدولة — ضريبة الشركات (IS)', nameFr: 'État — impôt sur les sociétés', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4443', name: 'État — taxe sur la valeur ajoutée facturée', nameAr: 'الدولة — TVA المحصلة', nameFr: 'État — taxe sur la valeur ajoutée facturée', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4445', name: 'État — TVA à décaisser', nameAr: 'الدولة — TVA واجبة الأداء', nameFr: 'État — TVA à décaisser', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4446', name: 'État — IR retenu à la source', nameAr: 'الدولة — الضريبة على الدخل المقتطعة', nameFr: 'État — IR retenu à la source', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4448', name: 'État — autres taxes et impôts', nameAr: 'الدولة — ضرائب ورسوم أخرى', nameFr: 'État — autres taxes et impôts', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4451', name: 'Associés — opérations sur capital', nameAr: 'الشركاء — عمليات على رأس المال', nameFr: 'Associés — opérations sur capital', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4491', name: 'Autres créanciers', nameAr: 'دائنون آخرون', nameFr: 'Autres créanciers', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '4495', name: 'Comptes de régularisation passif', nameAr: 'حسابات تسوية الخصوم', nameFr: 'Comptes de régularisation passif', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: false, isActive: true },
  // CLASS 5 — Trésorerie
  { code: '5111', name: 'Chèques et valeurs à encaisser', nameAr: 'الشيكات والقيم المراد تحصيلها', nameFr: 'Chèques et valeurs à encaisser', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '5141', name: 'Banques — comptes courants', nameAr: 'البنوك — الحسابات الجارية', nameFr: 'Banques — comptes courants', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '5142', name: 'Banques — comptes à terme', nameAr: 'البنوك — الحسابات لأجل', nameFr: 'Banques — comptes à terme', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '5143', name: 'Comptes sur carnets d\'épargne', nameAr: 'حسابات دفاتر التوفير', nameFr: 'Comptes sur carnets d\'épargne', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '5161', name: 'Caisse principale', nameAr: 'الصندوق الرئيسي', nameFr: 'Caisse principale', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '5162', name: 'Caisse secondaire', nameAr: 'الصندوق الثانوي', nameFr: 'Caisse secondaire', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '5171', name: 'Régies d\'avances et accréditifs', nameAr: 'سلف الخزينة والاعتمادات', nameFr: 'Régies d\'avances et accréditifs', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: false, isActive: true },
  // CLASS 6 — Charges
  { code: '6111', name: 'Achats de marchandises revendus en l\'état', nameAr: 'مشتريات البضائع المعاد بيعها', nameFr: 'Achats de marchandises revendus en l\'état', type: 'expense', category: 'cost_of_goods_sold', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6112', name: 'Achats de matières premières et fournitures', nameAr: 'مشتريات المواد الأولية واللوازم', nameFr: 'Achats de matières premières et fournitures', type: 'expense', category: 'cost_of_goods_sold', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6121', name: 'Sous-traitance générale', nameAr: 'المقاولة من الباطن العامة', nameFr: 'Sous-traitance générale', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6122', name: 'Locations et charges locatives', nameAr: 'الإيجارات والأعباء الإيجارية', nameFr: 'Locations et charges locatives', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6123', name: 'Entretien et réparations', nameAr: 'الصيانة والإصلاحات', nameFr: 'Entretien et réparations', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6124', name: 'Primes d\'assurances', nameAr: 'أقساط التأمين', nameFr: 'Primes d\'assurances', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6125', name: 'Rémunérations du personnel extérieur', nameAr: 'أجور الأفراد الخارجيين', nameFr: 'Rémunérations du personnel extérieur', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6126', name: 'Commissions et honoraires', nameAr: 'العمولات والأتعاب', nameFr: 'Commissions et honoraires', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6127', name: 'Frais de transport', nameAr: 'مصاريف النقل', nameFr: 'Frais de transport', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6128', name: 'Frais de déplacement, mission et réception', nameAr: 'مصاريف التنقل والمهام والاستقبال', nameFr: 'Frais de déplacement, mission et réception', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6131', name: 'Publicité, publications et relations publiques', nameAr: 'الإشهار والنشر والعلاقات العامة', nameFr: 'Publicité, publications et relations publiques', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6132', name: 'Frais de téléphone et de correspondance', nameAr: 'مصاريف الهاتف والمراسلات', nameFr: 'Frais de téléphone et de correspondance', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6133', name: 'Cotisations et dons', nameAr: 'الاشتراكات والتبرعات', nameFr: 'Cotisations et dons', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6141', name: 'Études, recherches et documentation', nameAr: 'الدراسات والبحوث والتوثيق', nameFr: 'Études, recherches et documentation', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6145', name: 'Frais d\'actes et de contentieux', nameAr: 'مصاريف العقود والنزاعات', nameFr: 'Frais d\'actes et de contentieux', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6146', name: 'Frais postaux et frais de bureau', nameAr: 'المصاريف البريدية ومصاريف المكتب', nameFr: 'Frais postaux et frais de bureau', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6147', name: 'Cotisations patronales sociales', nameAr: 'اشتراكات صاحب العمل الاجتماعية', nameFr: 'Cotisations patronales sociales', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6161', name: 'Impôts et taxes (patente, taxe urbaine…)', nameAr: 'الضرائب والرسوم (التصريح، الضريبة الحضرية…)', nameFr: 'Impôts et taxes (patente, taxe urbaine…)', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6171', name: 'Rémunérations du personnel', nameAr: 'مرتبات الأفراد', nameFr: 'Rémunérations du personnel', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6174', name: 'Charges sociales patronales', nameAr: 'الأعباء الاجتماعية لصاحب العمل', nameFr: 'Charges sociales patronales', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6311', name: 'Intérêts des emprunts et dettes', nameAr: 'فوائد القروض والديون', nameFr: 'Intérêts des emprunts et dettes', type: 'expense', category: 'other_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6321', name: 'Pertes de change', nameAr: 'خسائر الصرف', nameFr: 'Pertes de change', type: 'expense', category: 'other_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6393', name: 'Dotations aux amortissements — immo. corporelles', nameAr: 'مخصصات الاستهلاك — الأصول المادية', nameFr: 'Dotations aux amortissements — immo. corporelles', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6394', name: 'Dotations aux amortissements — immo. incorporelles', nameAr: 'مخصصات الاستهلاك — الأصول غير المادية', nameFr: 'Dotations aux amortissements — immo. incorporelles', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6395', name: 'Dotations aux provisions pour dépréciation', nameAr: 'مخصصات مؤونات انخفاض القيمة', nameFr: 'Dotations aux provisions pour dépréciation', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  { code: '6701', name: 'Impôts sur les bénéfices (IS)', nameAr: 'ضريبة على الشركات', nameFr: 'Impôts sur les bénéfices (IS)', type: 'expense', category: 'tax_expense', normalBalance: 'debit', isSystem: false, isActive: true },
  // CLASS 7 — Produits
  { code: '7111', name: 'Ventes de marchandises en l\'état', nameAr: 'مبيعات البضائع في حالتها', nameFr: 'Ventes de marchandises en l\'état', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7121', name: 'Ventes de produits finis', nameAr: 'مبيعات المنتجات التامة', nameFr: 'Ventes de produits finis', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7122', name: 'Ventes de produits intermédiaires', nameAr: 'مبيعات المنتجات الوسيطة', nameFr: 'Ventes de produits intermédiaires', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7123', name: 'Ventes de produits résiduels', nameAr: 'مبيعات المنتجات المتبقية', nameFr: 'Ventes de produits résiduels', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7124', name: 'Ventes de travaux', nameAr: 'مبيعات الأشغال', nameFr: 'Ventes de travaux', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7125', name: 'Ventes de services', nameAr: 'مبيعات الخدمات', nameFr: 'Ventes de services', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7126', name: 'Chiffre d\'affaires à l\'export', nameAr: 'رقم أعمال التصدير', nameFr: 'Chiffre d\'affaires à l\'export', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7131', name: 'Variations des stocks — produits en cours', nameAr: 'تغيرات المخزون — منتجات قيد التصنيع', nameFr: 'Variations des stocks — produits en cours', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7141', name: 'Immobilisations produites par l\'entreprise pour elle-même', nameAr: 'الأصول الثابتة المنتجة ذاتياً', nameFr: 'Immobilisations produites par l\'entreprise pour elle-même', type: 'revenue', category: 'other_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7161', name: 'Subventions d\'exploitation reçues', nameAr: 'الإعانات الاستغلالية المستلمة', nameFr: 'Subventions d\'exploitation reçues', type: 'revenue', category: 'other_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7171', name: 'Reprise sur provisions d\'exploitation', nameAr: 'استرداد مؤونات الاستغلال', nameFr: 'Reprise sur provisions d\'exploitation', type: 'revenue', category: 'other_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7311', name: 'Produits des titres de participation', nameAr: 'عائدات سندات المساهمة', nameFr: 'Produits des titres de participation', type: 'revenue', category: 'other_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7321', name: 'Gains de change', nameAr: 'مكاسب الصرف', nameFr: 'Gains de change', type: 'revenue', category: 'other_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
  { code: '7381', name: 'Produits nets sur cessions d\'immobilisations', nameAr: 'الأرباح الصافية على التنازل عن الأصول', nameFr: 'Produits nets sur cessions d\'immobilisations', type: 'revenue', category: 'other_revenue', normalBalance: 'credit', isSystem: false, isActive: true },
];

function getAccountsByClass(classNum: number): MoroccanAccount[] {
  return MOROCCAN_ACCOUNTS.filter((a) => a.code.startsWith(String(classNum)));
}

const CLASS_NAMES: Record<number, string> = { 1: 'Financement Permanent', 2: 'Actif Immobilisé', 3: 'Actif Circulant', 4: 'Passif Circulant', 5: 'Trésorerie', 6: 'Charges', 7: 'Produits' };

interface WizardState {
  expanded: boolean;
  selected: Set<string>;
  classExpanded: Record<number, boolean>;
}

const wizardState: WizardState = {
  expanded: false,
  selected: new Set(MOROCCAN_ACCOUNTS.map((a) => a.code)),
  classExpanded: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false },
};

/** Main Settings View */
export function renderSettings(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  let currentLogo = profileService.get().logo || '';

  const render = () => {
    const profile = profileService.get();

    page.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; width: 100%; display: grid; gap: var(--space-6);">

      <div class="page-header">
        <div>
          <h2 class="page-title">${i18n.t('settings.title' as any)}</h2>
          <p class="page-subtitle">${i18n.t('settings.subtitle' as any)}</p>
        </div>
        <div class="header-actions">
           <button class="btn btn-primary" id="save-profile-btn">
             ${Icons.check(16)} ${i18n.t('settings.saveProfile' as any)}
           </button>
        </div>
      </div>

        <!-- 1. BUSINESS IDENTITY -->
        <div class="card overflow-hidden">
          <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              <div style="color:var(--color-primary);">${Icons.building(20)}</div>
              <h3 class="card-title">${i18n.t('settings.enterpriseProfile' as any)}</h3>
            </div>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-6);">
              
              <!-- Logo Section -->
              <div style="display:flex; flex-direction:column; gap:var(--space-4);">
                <div style="font-weight:600; font-size:var(--font-size-sm); color:var(--color-text-secondary);">${i18n.t('settings.companyLogo' as any)}</div>
                <div style="display:flex; align-items:center; gap:var(--space-4);">
                  <div id="logo-preview" style="
                    width:100px; height:100px; border-radius:var(--radius-md);
                    border:2px dashed var(--color-border);
                    display:flex; align-items:center; justify-content:center;
                    overflow:hidden; flex-shrink:0; background:var(--color-surface);
                    transition: border-color 0.2s;
                  ">
                    ${currentLogo
                      ? `<img src="${currentLogo}" alt="Logo" style="width:100%; height:100%; object-fit:contain;" />`
                      : `<span style="color:var(--color-text-tertiary);">${Icons.image(24)}</span>`
                    }
                  </div>
                  <div style="display:flex; flex-direction:column; gap:var(--space-2);">
                    <div style="font-size:var(--font-size-xs); color:var(--color-text-tertiary); max-width:200px;">${i18n.t('settings.logoHint' as any)}</div>
                    <div style="display:flex; gap:var(--space-2);">
                      <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
                        ${Icons.upload(14)} ${i18n.t('common.upload' as any)}
                        <input type="file" id="logo-input" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none;" />
                      </label>
                      ${currentLogo ? `<button class="btn btn-ghost btn-sm" id="logo-remove" style="color:var(--color-error);">${Icons.trash(14)}</button>` : ''}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Primary Info -->
              <div style="display:flex; flex-direction:column; gap:var(--space-4);">
                <div class="form-group">
                  <label class="form-label" for="ep-name">${i18n.t('settings.companyName' as any)}</label>
                  <input type="text" id="ep-name" class="form-control" placeholder="Acme Corporation" value="${profile.name}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ep-tagline">${i18n.t('settings.tagline' as any)}</label>
                  <input type="text" id="ep-tagline" class="form-control" placeholder="Technology Solutions" value="${profile.tagline}" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. CONTACT & LOCATION -->
        <div class="card">
          <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              <div style="color:var(--color-primary);">${Icons.mapPin(20)}</div>
              <h3 class="card-title">${i18n.t('settings.contactDetails' as any)}</h3>
            </div>
          </div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="ep-email">${i18n.t('settings.email' as any)}</label>
                <input type="email" id="ep-email" class="form-control" placeholder="billing@company.com" value="${profile.email}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-phone">${i18n.t('settings.phone' as any)}</label>
                <input type="tel" id="ep-phone" class="form-control force-ltr" placeholder="+1-555-0100" value="${profile.phone}" />
              </div>
            </div>
            <div class="form-group" style="margin-top:var(--space-4);">
              <label class="form-label" for="ep-address">${i18n.t('settings.address' as any)}</label>
              <input type="text" id="ep-address" class="form-control" placeholder="123 Business Ave" value="${profile.address}" />
            </div>
            <div class="form-row" style="margin-top:var(--space-4);">
              <div class="form-group">
                <label class="form-label" for="ep-city">${i18n.t('settings.city' as any)}</label>
                <input type="text" id="ep-city" class="form-control" placeholder="New York" value="${profile.city}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-country">${i18n.t('settings.country' as any)}</label>
                <input type="text" id="ep-country" class="form-control" placeholder="USA" value="${profile.country}" />
              </div>
            </div>
            <div class="form-row" style="margin-top:var(--space-4);">
              <div class="form-group">
                <label class="form-label" for="ep-website">${i18n.t('settings.website' as any)}</label>
                <div style="position:relative;">
                  <span style="position:absolute; left:var(--space-3); top:50%; transform:translateY(-50%); color:var(--color-text-tertiary);">${Icons.link(14)}</span>
                  <input type="url" id="ep-website" class="form-control" style="padding-left:var(--space-8);" placeholder="https://company.com" value="${profile.website}" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-taxid">${i18n.t('settings.taxId' as any)}</label>
                <input type="text" id="ep-taxid" class="form-control" placeholder="US-123456789" value="${profile.taxId}" />
              </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: var(--space-6);">
          
          <!-- 3. BILLING & INVOICING -->
          <div class="card">
            <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <div style="color:var(--color-primary);">${Icons.invoices(20)}</div>
                <h3 class="card-title">${i18n.t('nav.invoices' as any)}</h3>
              </div>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:var(--space-4);">
              <div class="form-group">
                <label class="form-label" for="ep-currency">${i18n.t('settings.defaultCurrency' as any)}</label>
                <select id="ep-currency" class="form-control">
                  ${CURRENCIES.map((code) => `<option value="${code}" ${(profile.currency || 'USD') === code ? 'selected' : ''}>${code} — ${i18n.t(`currencies.${code}` as any)}</option>`).join('')}
                </select>
                <span class="form-hint">${i18n.t('settings.currencyHint' as any)}</span>
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-default-tax">${i18n.t('settings.defaultTaxRate' as any)}</label>
                <div style="display:flex; align-items:center; gap:var(--space-2);">
                   <input type="number" id="ep-default-tax" class="form-control" placeholder="0" min="0" max="100" step="0.01" value="${profile.defaultTaxRate ?? 0}" />
                   <span style="font-weight:600; color:var(--color-text-tertiary);">%</span>
                </div>
                <span class="form-hint">${i18n.t('settings.defaultTaxHint' as any)}</span>
              </div>
              <div class="divider"></div>
              <div class="form-group">
                <label class="form-label" for="ep-pdf-lang">${i18n.t('settings.defaultPdfLanguage' as any)}</label>
                <select id="ep-pdf-lang" class="form-control">
                  <option value="en" ${profile.defaultPdfLanguage === 'en' ? 'selected' : ''}>🇺🇸 English</option>
                  <option value="fr" ${profile.defaultPdfLanguage === 'fr' ? 'selected' : ''}>🇫🇷 Français</option>
                  <option value="ar" ${profile.defaultPdfLanguage === 'ar' ? 'selected' : ''}>🇸🇦 العربية</option>
                </select>
                <span class="form-hint">${i18n.t('settings.pdfLanguageHint' as any)}</span>
              </div>
            </div>
          </div>

          <!-- 4. APP PREFERENCES -->
          <div class="card">
            <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <div style="color:var(--color-primary);">${Icons.settings(20)}</div>
                <h3 class="card-title">${i18n.t('settings.appearance' as any)}</h3>
              </div>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:var(--space-5);">
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: 2px;">${i18n.t('settings.language' as any)}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${i18n.t('settings.selectLanguage' as any)}</div>
                </div>
                <div id="settings-lang-switcher"></div>
              </div>

              <div class="divider"></div>

              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: 2px;">${i18n.t('settings.darkMode' as any)}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${i18n.t('settings.darkModeSubtitle' as any)}</div>
                </div>
                <label class="toggle" aria-label="Toggle dark mode">
                  <input type="checkbox" class="toggle-input" id="dark-mode-toggle" ${themeManager.getTheme() === 'dark' ? 'checked' : ''} />
                  <span class="toggle-track"></span>
                </label>
              </div>

              <div class="divider"></div>

              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: 2px;">${i18n.t('settings.lightSidebar' as any)}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${i18n.t('settings.lightSidebarSubtitle' as any)}</div>
                </div>
                <label class="toggle" aria-label="Toggle sidebar theme">
                  <input type="checkbox" class="toggle-input" id="sidebar-theme-toggle" ${sidebarThemeService.current === 'light' ? 'checked' : ''} />
                  <span class="toggle-track"></span>
                </label>
              </div>

              <div class="divider"></div>

              <div>
                <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: var(--space-3);">${i18n.t('settings.themePreview' as any)}</div>
                <div style="display: flex; gap: var(--space-4);">
                  <div id="theme-light" style="flex:1; cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'light' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-2); transition: transform 0.2s;">
                    <div style="background: #f8f7ff; border-radius: var(--radius-sm); padding: var(--space-3); height: 70px; display: flex; flex-direction: column; gap: 6px;">
                      <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                      <div style="height: 6px; width: 80%; background: #e5e0f5; border-radius: 4px;"></div>
                    </div>
                    <div style="text-align: center; font-size: 11px; font-weight:500; margin-top: var(--space-2); color: var(--color-text-secondary);">${i18n.t('settings.light' as any)}</div>
                  </div>
                  <div id="theme-dark" style="flex:1; cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'dark' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-2); transition: transform 0.2s;">
                    <div style="background: #0a0614; border-radius: var(--radius-sm); padding: var(--space-3); height: 70px; display: flex; flex-direction: column; gap: 6px;">
                      <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                      <div style="height: 6px; width: 80%; background: #2a1f45; border-radius: 4px;"></div>
                    </div>
                    <div style="text-align: center; font-size: 11px; font-weight:500; margin-top: var(--space-2); color: var(--color-text-secondary);">${i18n.t('settings.dark' as any)}</div>
                  </div>
                </div>
              </div>

              <div class="divider"></div>

              <div>
                <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: var(--space-3);">${i18n.t('settings.layoutStyle' as any)}</div>
                <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
                  <div id="layout-classic" style="flex:1; min-width: 100px; cursor:pointer; border: 1.5px solid ${layoutService.currentLayout === 'classic' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-3); background: ${layoutService.currentLayout === 'classic' ? 'var(--color-primary-subtle)' : 'transparent'}; transition: border-color 0.2s, background 0.2s;">
                    <div style="background: var(--color-bg-secondary); border-radius: var(--radius-sm); height: 60px; display: flex; overflow: hidden; margin-bottom: var(--space-2);">
                      <div style="width: 28px; background: #0f0a1e; display: flex; flex-direction: column; gap: 3px; padding: 6px 4px;">
                        <div style="height: 4px; background: #9929ea; border-radius: 2px;"></div>
                        <div style="height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px;"></div>
                        <div style="height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px;"></div>
                        <div style="height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px;"></div>
                      </div>
                      <div style="flex:1; padding: 6px; display: flex; flex-direction: column; gap: 3px;">
                        <div style="height: 4px; width: 70%; background: var(--color-border); border-radius: 2px;"></div>
                        <div style="height: 3px; width: 50%; background: var(--color-border-subtle); border-radius: 2px;"></div>
                      </div>
                    </div>
                    <div style="text-align:center; font-size:11px; font-weight:500; color:var(--color-text-secondary);">${i18n.t('settings.layoutClassic' as any)}</div>
                    <div style="text-align:center; font-size:10px; color:var(--color-text-tertiary); margin-top:2px;">${i18n.t('settings.layoutClassicDesc' as any)}</div>
                  </div>
                  <div id="layout-modern" style="flex:1; min-width: 100px; cursor:pointer; border: 1.5px solid ${layoutService.currentLayout === 'modern' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-3); background: ${layoutService.currentLayout === 'modern' ? 'var(--color-primary-subtle)' : 'transparent'}; transition: border-color 0.2s, background 0.2s;">
                    <div style="background: var(--color-bg-secondary); border-radius: var(--radius-sm); height: 60px; display: flex; overflow: hidden; margin-bottom: var(--space-2);">
                      <div style="width: 14px; background: #0f0a1e; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px;">
                        <div style="width: 8px; height: 8px; background: #9929ea; border-radius: 2px;"></div>
                        <div style="width: 6px; height: 6px; background: rgba(255,255,255,0.3); border-radius: 1px;"></div>
                        <div style="width: 6px; height: 6px; background: rgba(255,255,255,0.3); border-radius: 1px;"></div>
                      </div>
                      <div style="flex:1; padding: 6px; display: flex; flex-direction: column; gap: 3px;">
                        <div style="height: 4px; width: 70%; background: var(--color-border); border-radius: 2px;"></div>
                        <div style="height: 3px; width: 50%; background: var(--color-border-subtle); border-radius: 2px;"></div>
                      </div>
                    </div>
                    <div style="text-align:center; font-size:11px; font-weight:500; color:var(--color-text-secondary);">${i18n.t('settings.layoutModern' as any)}</div>
                    <div style="text-align:center; font-size:10px; color:var(--color-text-tertiary); margin-top:2px;">${i18n.t('settings.layoutModernDesc' as any)}</div>
                  </div>
                  <div id="layout-floating" style="flex:1; min-width: 100px; cursor:pointer; border: 1.5px solid ${layoutService.currentLayout === 'floating' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-3); background: ${layoutService.currentLayout === 'floating' ? 'var(--color-primary-subtle)' : 'transparent'}; transition: border-color 0.2s, background 0.2s;">
                    <div style="background: var(--color-bg-secondary); border-radius: var(--radius-sm); height: 60px; display: flex; gap: 3px; padding: 5px; margin-bottom: var(--space-2); overflow: hidden;">
                      <div style="width: 22px; background: var(--color-sidebar-bg); border-radius: 4px; display: flex; flex-direction: column; gap: 2px; padding: 4px 3px; flex-shrink:0;">
                        <div style="height: 3px; background: var(--color-primary); border-radius: 2px;"></div>
                        <div style="height: 2px; background: var(--color-sidebar-border); border-radius: 2px;"></div>
                        <div style="height: 2px; background: var(--color-sidebar-border); border-radius: 2px;"></div>
                      </div>
                      <div style="flex:1; display: flex; flex-direction: column; gap: 3px;">
                        <div style="height: 10px; background: var(--color-surface); border-radius: 4px; border: 1px solid var(--color-border-subtle);"></div>
                        <div style="flex:1; background: var(--color-surface); border-radius: 4px; border: 1px solid var(--color-border-subtle);"></div>
                      </div>
                    </div>
                    <div style="text-align:center; font-size:11px; font-weight:500; color:var(--color-text-secondary);">${i18n.t('settings.layoutFloating' as any)}</div>
                    <div style="text-align:center; font-size:10px; color:var(--color-text-tertiary); margin-top:2px;">${i18n.t('settings.layoutFloatingDesc' as any)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. SYSTEM & DATA -->
        <div class="card">
          <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              <div style="color:var(--color-primary);">${Icons.database(20)}</div>
              <h3 class="card-title">${i18n.t('settings.dataManagement' as any)}</h3>
            </div>
          </div>
          <div class="card-body">
            
            ${isElectron ? `
            <div style="padding:var(--space-4); background:var(--color-bg-secondary); border-radius:var(--radius-md); margin-bottom:var(--space-6); border:1px solid var(--color-border);">
              <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-2);">
                <div style="color:var(--color-info);">${Icons.info(16)}</div>
                <div style="font-size:var(--font-size-sm); font-weight:600;">${i18n.t('settings.dataOnDisk' as any)}</div>
              </div>
              <div id="data-path" style="font-size:var(--font-size-xs); color:var(--color-text-tertiary); font-family:var(--font-mono); padding:var(--space-3); background:var(--color-surface); border-radius:var(--radius-sm); border:1px solid var(--color-border-subtle); word-break:break-all;">
                ${i18n.t('common.loading' as any)}
              </div>
            </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-6);">
              
              <!-- Export Card -->
               <div style="display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-border-subtle); border-radius:var(--radius-md);">
                 <div style="color:var(--color-success);">${Icons.download(24)}</div>
                 <div style="font-weight:600;">${i18n.t('settings.exportExcel' as any)}</div>
                 <p style="font-size:var(--font-size-xs); color:var(--color-text-secondary); line-height:1.4;">
                   ${isElectron ? i18n.t('settings.exportExcelSubtitleWin' as any) : i18n.t('settings.exportExcelSubtitleWeb' as any)}
                 </p>
                 <button class="btn btn-secondary btn-sm" id="export-btn" style="margin-top:auto;">
                   ${Icons.download(14)} ${i18n.t('settings.exportData' as any)}
                 </button>
               </div>

               <!-- Import Card -->
               <div style="display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-border-subtle); border-radius:var(--radius-md);">
                 <div style="color:var(--color-info);">${Icons.upload(24)}</div>
                 <div style="font-weight:600;">${i18n.t('settings.importExcel' as any)}</div>
                 <p style="font-size:var(--font-size-xs); color:var(--color-text-secondary); line-height:1.4;">
                   ${isElectron ? i18n.t('settings.importExcelSubtitleWin' as any) : i18n.t('settings.importExcelSubtitleWeb' as any)}
                 </p>
                 ${isElectron
                   ? `<button class="btn btn-secondary btn-sm" id="import-btn" style="margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}</button>`
                   : `<label class="btn btn-secondary btn-sm" style="cursor:pointer; margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}<input type="file" id="import-file" accept=".xlsx,.xls" style="display:none;" /></label>`
                 }
               </div>

               <!-- Reset Card -->
               <div style="display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-error-subtle); background:var(--color-error-subtle-22); border-radius:var(--radius-md);">
                 <div style="color:var(--color-error);">${Icons.alertTriangle(24)}</div>
                 <div style="font-weight:600; color:var(--color-error);">${i18n.t('settings.clearAllData' as any)}</div>
                 <p style="font-size:var(--font-size-xs); color:var(--color-text-secondary); line-height:1.4;">
                   ${i18n.t('settings.clearAllDataSubtitle' as any)}
                 </p>
                 <button class="btn btn-ghost btn-sm" id="clear-btn" style="color:var(--color-error); border:1px solid rgba(239, 68, 68, 0.2); margin-top:auto;">
                   ${Icons.trash(14)} ${i18n.t('common.delete' as any)}
                 </button>
               </div>
            </div>
          </div>
        </div>

        <!-- ACCOUNTING SETUP -->
        <div class="card overflow-hidden" id="accounting-setup-section">
          <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle); cursor:pointer;" id="accounting-setup-toggle">
            <div style="display:flex; align-items:center; gap:var(--space-3); flex:1;">
              <div style="color:var(--color-primary);">${Icons.accounting(20)}</div>
              <div>
                <h3 class="card-title">${i18n.t('settings.accountingSetup.title' as any)}</h3>
                <p style="font-size:var(--font-size-xs); color:var(--color-text-secondary); margin:0;">${i18n.t('settings.accountingSetup.subtitle' as any)}</p>
              </div>
            </div>
            <span id="accounting-setup-chevron" style="color:var(--color-text-tertiary); transition:transform var(--transition-fast); transform:${wizardState.expanded ? 'rotate(0deg)' : 'rotate(-90deg)'};">▼</span>
          </div>
          <div id="accounting-setup-body" style="display:${wizardState.expanded ? 'block' : 'none'};">
            <div class="card-body">
              ${buildWizardHTML()}
            </div>
          </div>
        </div>

        <!-- ABOUT -->
        <div style="text-align:center; padding:var(--space-8) 0; border-top:1px solid var(--color-border-subtle);">
          <div style="font-size:var(--font-size-sm); font-weight:600; color:var(--color-text-primary);">${i18n.t('settings.about' as any)}</div>
          <div style="font-size:var(--font-size-xs); color:var(--color-text-tertiary); margin-top:4px;">Version 1.0.0 · © 2024 Tijara App</div>
        </div>

      </div>
    `;

    // ── Language Switcher ───────────────────────────────────────────────────
    const langContainer = page.querySelector('#settings-lang-switcher');
    if (langContainer) {
      langContainer.appendChild(createLanguageSwitcher());
    }

    // ── Logo logic ──────────────────────────────────────────────────────────
    const logoInput = page.querySelector<HTMLInputElement>('#logo-input')!;
    const logoRemove = page.querySelector<HTMLButtonElement>('#logo-remove');
    const logoPreview = page.querySelector<HTMLElement>('#logo-preview')!;

    logoInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        notifications.error(i18n.t('settings.logoSizeMsg' as any));
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        currentLogo = base64;
        logoPreview.innerHTML = `<img src="${base64}" alt="Logo" style="width:100%; height:100%; object-fit:contain;" />`;
        if (!page.querySelector('#logo-remove')) render(); // re-render to show remove button
      };
      reader.readAsDataURL(file);
    });

    if (logoRemove) {
      logoRemove.addEventListener('click', () => {
        currentLogo = '';
        render();
      });
    }

    // ── Theme logic ─────────────────────────────────────────────────────────
    const darkToggle = page.querySelector<HTMLInputElement>('#dark-mode-toggle')!;
    darkToggle.addEventListener('change', (e) => {
      const isDark = (e.target as HTMLInputElement).checked;
      themeManager.setTheme(isDark ? 'dark' : 'light');
    });

    page.querySelector('#theme-light')?.addEventListener('click', () => {
      themeManager.setTheme('light');
    });
    page.querySelector('#theme-dark')?.addEventListener('click', () => {
      themeManager.setTheme('dark');
    });

    // ── Sidebar theme toggle ─────────────────────────────────────────────────
    const sidebarToggle = page.querySelector<HTMLInputElement>('#sidebar-theme-toggle');
    sidebarToggle?.addEventListener('change', (e) => {
      const isLight = (e.target as HTMLInputElement).checked;
      sidebarThemeService.set(isLight ? 'light' : 'dark');
    });

    // ── Layout Style ────────────────────────────────────────────────────────
    page.querySelector('#layout-classic')?.addEventListener('click', () => {
      layoutService.setLayout('classic');
      render();
    });
    page.querySelector('#layout-modern')?.addEventListener('click', () => {
      layoutService.setLayout('modern');
      render();
    });
    page.querySelector('#layout-floating')?.addEventListener('click', () => {
      layoutService.setLayout('floating');
      render();
    });

    // ── Save Profile ────────────────────────────────────────────────────────
    page.querySelector('#save-profile-btn')?.addEventListener('click', () => {
      const updated = {
        name: page.querySelector<HTMLInputElement>('#ep-name')!.value.trim(),
        tagline: page.querySelector<HTMLInputElement>('#ep-tagline')!.value.trim(),
        email: page.querySelector<HTMLInputElement>('#ep-email')!.value.trim(),
        phone: page.querySelector<HTMLInputElement>('#ep-phone')!.value.trim(),
        address: page.querySelector<HTMLInputElement>('#ep-address')!.value.trim(),
        city: page.querySelector<HTMLInputElement>('#ep-city')!.value.trim(),
        country: page.querySelector<HTMLInputElement>('#ep-country')!.value.trim(),
        website: page.querySelector<HTMLInputElement>('#ep-website')!.value.trim(),
        taxId: page.querySelector<HTMLInputElement>('#ep-taxid')!.value.trim(),
        defaultTaxRate: parseFloat(page.querySelector<HTMLInputElement>('#ep-default-tax')!.value) || 0,
        currency: page.querySelector<HTMLSelectElement>('#ep-currency')!.value,
        defaultPdfLanguage: page.querySelector<HTMLSelectElement>('#ep-pdf-lang')!.value,
        logo: currentLogo,
      };

      profileService.save(updated);
      notifications.success(i18n.t('settings.saveProfileSuccess' as any));
    });

    // ── Data Path ───────────────────────────────────────────────────────────
    if (isElectron) {
      getElectron()!.getDataPath()
        .then((path: string) => {
          const pathEl = page.querySelector('#data-path');
          if (pathEl) pathEl.textContent = path;
        });
    }

    // ── Export/Import ───────────────────────────────────────────────────────
    page.querySelector('#export-btn')?.addEventListener('click', async () => {
       await repository.exportToExcel();
       if (isElectron) notifications.success(i18n.t('settings.notifications.exportSuccess' as any));
    });

    const handleImportFile = async (file: File) => {
      try {
        await repository.importFromExcel(file);
        notifications.success(i18n.t('settings.notifications.importSuccess' as any));
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        notifications.error(i18n.t('settings.notifications.importFailed' as any));
      }
    };

    if (isElectron) {
      page.querySelector('#import-btn')?.addEventListener('click', async () => {
        await repository.importFromExcel();
        notifications.success(i18n.t('settings.notifications.importSuccess' as any));
        setTimeout(() => window.location.reload(), 1500);
      });
    } else {
      page.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) handleImportFile(file);
      });
    }

    // ── Clear Data ──────────────────────────────────────────────────────────
    page.querySelector('#clear-btn')?.addEventListener('click', () => {
      import('@shared/components/modal').then(({ openModal }) => {
        const content = document.createElement('div');
        content.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:var(--space-4); text-align:center; padding:var(--space-2) 0;">
            <div style="width:56px; height:56px; border-radius:var(--radius-full); background:var(--color-error-subtle); color:var(--color-error); display:flex; align-items:center; justify-content:center;">
              ${Icons.alertTriangle(24)}
            </div>
            <p style="color:var(--color-text-secondary);">${i18n.t('settings.clearAllDataSubtitle' as any)}</p>
          </div>
        `;
        openModal({
          title: i18n.t('settings.clearAllData' as any),
          content,
          confirmText: i18n.t('common.delete' as any),
          confirmClass: 'btn-danger',
          onConfirm: async () => {
            await repository.clearAll();
            notifications.success(i18n.t('settings.notifications.clearedSuccess' as any));
            setTimeout(() => window.location.reload(), 1500);
          }
        });
      });
    });

    // ── Accounting Setup Section toggle ─────────────────────────────────────
    page.querySelector('#accounting-setup-toggle')?.addEventListener('click', () => {
      wizardState.expanded = !wizardState.expanded;
      const body = page.querySelector<HTMLElement>('#accounting-setup-body');
      const chevron = page.querySelector<HTMLElement>('#accounting-setup-chevron');
      if (body) body.style.display = wizardState.expanded ? 'block' : 'none';
      if (chevron) chevron.style.transform = wizardState.expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    attachWizardEvents(page, render);
  };

  render();
  themeManager.subscribe(render);
  i18n.onLanguageChange(render);

  return page;
}

// ── Wizard HTML builder ───────────────────────────────────────────────────

function buildWizardHTML(): string {
  const existingCount = accountService.getAll().length;
  const total = MOROCCAN_ACCOUNTS.length;
  const selectedCount = wizardState.selected.size;

  const warningBanner = existingCount > 0
    ? `<div class="setup-warning">
        ${Icons.alertTriangle(16)}
        <span>${i18n.t('settings.accountingSetup.existingWarning' as any, { count: existingCount })}</span>
       </div>`
    : '';

  const classesHTML = [1, 2, 3, 4, 5, 6, 7].map((classNum) => {
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
          <input type="checkbox" data-class-check="${classNum}"
            ${selectedInClass === accounts.length ? 'checked' : ''}
            style="flex-shrink:0;" />
          <span class="setup-class-code">CLASS ${classNum}</span>
          <span class="setup-class-name">${label}</span>
          <span class="setup-class-count">(${accounts.length})</span>
          <span class="setup-class-chevron" style="transform:${isOpen ? 'rotate(0deg)' : 'rotate(-90deg)'};">▼</span>
        </div>
        <div class="setup-class-body" id="setup-class-body-${classNum}" style="display:${isOpen ? 'block' : 'none'};">
          ${accountRows}
        </div>
      </div>`;
  }).join('');

  return `
    <p style="font-size:var(--font-size-sm); color:var(--color-text-secondary); margin:0 0 var(--space-4);">
      ${i18n.t('settings.accountingSetup.description' as any)}
    </p>
    ${warningBanner}
    <div class="setup-controls">
      <label class="setup-select-all">
        <input type="checkbox" id="setup-select-all" ${selectedCount === total ? 'checked' : ''} />
        ${selectedCount === total
          ? i18n.t('settings.accountingSetup.deselectAll' as any)
          : i18n.t('settings.accountingSetup.selectAll' as any)} (${total})
      </label>
      <span class="setup-counter" id="setup-counter">${selectedCount} ${i18n.t('settings.accountingSetup.accountsSelected' as any)}</span>
    </div>
    ${classesHTML}
    <div class="setup-footer">
      <span id="setup-selected-count" style="font-size:var(--font-size-sm); color:var(--color-text-secondary);">
        ${selectedCount} ${i18n.t('settings.accountingSetup.accountsSelected' as any)}
      </span>
      <div class="setup-actions">
        <button class="btn btn-ghost btn-sm" id="setup-skip">${i18n.t('settings.accountingSetup.skipBtn' as any)}</button>
        <button class="btn btn-primary" id="setup-import" ${selectedCount === 0 ? 'disabled' : ''}>
          ${Icons.chartOfAccounts(16)} ${i18n.t('settings.accountingSetup.importBtn' as any)}
        </button>
      </div>
    </div>`;
}

// ── Wizard event handlers ─────────────────────────────────────────────────

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
    allCb.nextSibling!.textContent = ` ${count === MOROCCAN_ACCOUNTS.length
      ? i18n.t('settings.accountingSetup.deselectAll' as any)
      : i18n.t('settings.accountingSetup.selectAll' as any)} (${MOROCCAN_ACCOUNTS.length})`;
  }
}

function updateClassCheckState(container: HTMLElement, classNum: number): void {
  const codes = getAccountsByClass(classNum).map((a) => a.code);
  const cb = container.querySelector<HTMLInputElement>(`[data-class-check="${classNum}"]`);
  if (!cb) return;
  const selectedInClass = codes.filter((c) => wizardState.selected.has(c)).length;
  cb.indeterminate = selectedInClass > 0 && selectedInClass < codes.length;
  cb.checked = selectedInClass === codes.length;
}

function attachWizardEvents(page: HTMLElement, rerender: () => void): void {
  // Section toggle is handled in the main attachEvents

  // Global select-all
  const allCheck = page.querySelector<HTMLInputElement>('#setup-select-all');
  allCheck?.addEventListener('change', () => {
    if (allCheck.checked) {
      MOROCCAN_ACCOUNTS.forEach((a) => wizardState.selected.add(a.code));
    } else {
      wizardState.selected.clear();
    }
    page.querySelectorAll<HTMLInputElement>('[data-code]').forEach((cb) => {
      cb.checked = wizardState.selected.has(cb.dataset.code!);
    });
    [1, 2, 3, 4, 5, 6, 7].forEach((n) => updateClassCheckState(page, n));
    updateWizardCounter(page);
  });

  // Per-account checkboxes
  page.querySelectorAll<HTMLInputElement>('[data-code]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) wizardState.selected.add(cb.dataset.code!);
      else wizardState.selected.delete(cb.dataset.code!);
      const classNum = parseInt(cb.closest<HTMLElement>('[data-class]')!.dataset.class!);
      updateClassCheckState(page, classNum);
      updateWizardCounter(page);
    });
  });

  // Per-class checkboxes
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

  // Class section collapse
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

  // Skip button
  page.querySelector('#setup-skip')?.addEventListener('click', () => {
    wizardState.expanded = false;
    const body = page.querySelector<HTMLElement>('#accounting-setup-body');
    const chevron = page.querySelector<HTMLElement>('#accounting-setup-chevron');
    if (body) body.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
  });

  // Import button
  page.querySelector('#setup-import')?.addEventListener('click', async () => {
    const toImport = MOROCCAN_ACCOUNTS.filter((a) => wizardState.selected.has(a.code));
    const newAccounts = toImport.filter((a) => accountService.isCodeUnique(a.code));

    if (newAccounts.length === 0) {
      notifications.info(i18n.t('settings.accountingSetup.allExist' as any));
      return;
    }

    const btn = page.querySelector<HTMLButtonElement>('#setup-import')!;
    btn.disabled = true;
    btn.textContent = i18n.t('common.loading' as any);

    for (const acc of newAccounts) {
      await accountService.create({
        code: acc.code,
        name: acc.name,
        nameAr: acc.nameAr,
        nameFr: acc.nameFr,
        type: acc.type,
        category: acc.category,
        normalBalance: acc.normalBalance,
        isSystem: false,
        isActive: true,
      });
    }

    notifications.success(
      i18n.t('settings.accountingSetup.importSuccess' as any, { count: newAccounts.length })
    );

    wizardState.expanded = false;
    rerender();
  });
}
