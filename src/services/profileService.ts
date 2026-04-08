/**
 * Enterprise profile service.
 * Persists company info and logo to localStorage (separate from business data).
 * The profile is used to brand invoices (PDF, print, and detail view).
 */

import type { EnterpriseProfile } from '@core/types';

const STORAGE_KEY = 'tijara-profile';

const DEFAULT_PROFILE: EnterpriseProfile = {
  name: '',
  tagline: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: '',
  website: '',
  taxId: '',
  logo: '',
  defaultTaxRate: 0,
};

class ProfileService {
  private profile: EnterpriseProfile | null = null;

  /** Load profile from localStorage */
  get(): EnterpriseProfile {
    if (this.profile) return this.profile;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.profile = { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<EnterpriseProfile>) };
      } catch {
        this.profile = { ...DEFAULT_PROFILE };
      }
    } else {
      this.profile = { ...DEFAULT_PROFILE };
    }
    return this.profile;
  }

  /** Save profile to localStorage */
  save(data: Partial<EnterpriseProfile>): void {
    this.profile = { ...this.get(), ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
  }

  /** Check whether a profile has been configured */
  isConfigured(): boolean {
    return !!this.get().name.trim();
  }

  /** Get the default tax rate (falls back to 0) */
  getDefaultTaxRate(): number {
    return this.get().defaultTaxRate ?? 0;
  }
}

export const profileService = new ProfileService();
