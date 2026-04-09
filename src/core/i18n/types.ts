import en from './locales/en.json';

export type Language = 'en' | 'fr' | 'ar';
export type Direction = 'ltr' | 'rtl';

export type TranslationSchema = typeof en;

type Join<K, P> = K extends string | number ?
    P extends string | number ?
    `${K}${"" extends P ? "" : "."}${P}`
    : never : never;

export type DeepKeys<T> = T extends object
  ? {
      [K in keyof T]-?: K extends string
        ? T[K] extends string
          ? K
          : T[K] extends object
          ? Join<K, DeepKeys<T[K]>>
          : never
        : never;
    }[keyof T]
  : never;

export type TranslationKey = DeepKeys<TranslationSchema>;
