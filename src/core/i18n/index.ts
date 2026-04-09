import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import type { Language, Direction, TranslationKey, TranslationSchema } from './types';

const translations: Record<Language, TranslationSchema> = {
  en,
  fr,
  ar,
};

type Listener = (lang: Language, dir: Direction) => void;

class I18nService {
  private _currentLanguage: Language = 'en';
  private _listeners: Set<Listener> = new Set();

  constructor() {
    const saved = localStorage.getItem('tijara_language');
    if (saved === 'en' || saved === 'fr' || saved === 'ar') {
      this._currentLanguage = saved;
    }
    this.updateDocument();
  }

  get currentLanguage(): Language {
    return this._currentLanguage;
  }

  get direction(): Direction {
    return this._currentLanguage === 'ar' ? 'rtl' : 'ltr';
  }

  t(key: TranslationKey, variables?: Record<string, string | number>): string {
    return this.tFor(this._currentLanguage, key, variables);
  }

  /** Translate a key into a specific language */
  tFor(lang: Language, key: TranslationKey, variables?: Record<string, string | number>): string {
    const keys = key.split('.');
    let result: any = translations[lang] || translations['en'];

    for (const k of keys) {
      if (!result || result[k] === undefined) {
        console.warn(`Translation missing for key: ${key} in ${lang}`);
        return key;
      }
      result = result[k];
    }

    let text = typeof result === 'string' ? result : key;

    if (variables) {
      for (const [k, v] of Object.entries(variables)) {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      }
    }

    return text;
  }

  getDirectionFor(lang: Language): Direction {
    return lang === 'ar' ? 'rtl' : 'ltr';
  }

  setLanguage(lang: Language): void {
    if (this._currentLanguage === lang) return;

    this._currentLanguage = lang;
    localStorage.setItem('tijara_language', lang);
    this.updateDocument();

    for (const listener of this._listeners) {
      listener(this.currentLanguage, this.direction);
    }
  }

  onLanguageChange(callback: Listener): void {
    this._listeners.add(callback);
  }

  offLanguageChange(callback: Listener): void {
    this._listeners.delete(callback);
  }

  private updateDocument() {
    document.documentElement.dir = this.direction;
    document.documentElement.lang = this._currentLanguage;
    document.documentElement.setAttribute('data-lang', this._currentLanguage);
  }
}

export const i18n = new I18nService();
export type { I18nService };
