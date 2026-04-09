/**
 * Auth screen – login and register views.
 * Shown before the main app shell when no valid session exists.
 */

import { authService } from '@services/authService';
import { themeManager } from '@core/theme';
import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';
import { createLanguageSwitcher } from '@shared/components/languageSwitcher';
import type { User } from '@core/types';

type AuthView = 'login' | 'register';

/**
 * Render the full-page auth screen.
 * Calls onSuccess(user) when authentication succeeds.
 */
export function renderAuthScreen(onSuccess: (user: User) => void): HTMLElement {
  let view: AuthView = 'login';

  const root = document.createElement('div');
  root.className = 'auth-screen';
  root.setAttribute('role', 'main');

  function render() {
    root.innerHTML = buildHTML(view);
    attachEvents();
  }

  i18n.onLanguageChange(render);

  function attachEvents() {
    // View toggle
    root.querySelector('#switch-view')?.addEventListener('click', () => {
      view = view === 'login' ? 'register' : 'login';
      render();
    });

    // Theme toggle
    root.querySelector('#auth-theme-btn')?.addEventListener('click', () => {
      themeManager.toggle();
      updateThemeIcon();
    });

    // Language switcher
    const langContainer = root.querySelector('#auth-lang-switcher');
    if (langContainer) {
      langContainer.appendChild(createLanguageSwitcher());
    }

    // Form submit
    if (view === 'login') {
      root.querySelector('#login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
      });
    } else {
      root.querySelector('#register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRegister();
      });
    }

    // Password visibility toggles
    root.querySelectorAll<HTMLButtonElement>('[data-toggle-pw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-pw')!;
        const input = root.querySelector<HTMLInputElement>(`#${targetId}`);
        if (!input) return;
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        btn.innerHTML = isText ? Icons.eye(16) : eyeOffIcon();
      });
    });

    updateThemeIcon();
  }

  function updateThemeIcon() {
    const btn = root.querySelector<HTMLButtonElement>('#auth-theme-btn');
    if (!btn) return;
    btn.innerHTML = themeManager.getTheme() === 'dark' ? Icons.sun() : Icons.moon();
  }

  async function handleLogin() {
    const email = (root.querySelector<HTMLInputElement>('#login-email'))?.value.trim() ?? '';
    const password = (root.querySelector<HTMLInputElement>('#login-password'))?.value ?? '';
    const btn = root.querySelector<HTMLButtonElement>('#login-submit')!;
    const errEl = root.querySelector<HTMLElement>('#login-error')!;

    if (!email || !password) {
      showError(errEl, i18n.t('auth.enterEmailPassword'));
      return;
    }

    setLoading(btn, true);
    clearError(errEl);

    try {
      const user = await authService.login(email, password);
      onSuccess(user);
    } catch (err) {
      showError(errEl, err instanceof Error ? err.message : 'Login failed.');
      setLoading(btn, false);
    }
  }

  async function handleRegister() {
    const name = (root.querySelector<HTMLInputElement>('#reg-name'))?.value.trim() ?? '';
    const email = (root.querySelector<HTMLInputElement>('#reg-email'))?.value.trim() ?? '';
    const password = (root.querySelector<HTMLInputElement>('#reg-password'))?.value ?? '';
    const confirm = (root.querySelector<HTMLInputElement>('#reg-confirm'))?.value ?? '';
    const btn = root.querySelector<HTMLButtonElement>('#register-submit')!;
    const errEl = root.querySelector<HTMLElement>('#register-error')!;

    if (!name || !email || !password) {
      showError(errEl, i18n.t('auth.allFieldsRequired'));
      return;
    }
    if (password.length < 6) {
      showError(errEl, i18n.t('auth.passwordLength'));
      return;
    }
    if (password !== confirm) {
      showError(errEl, i18n.t('auth.passwordsMatch'));
      return;
    }

    setLoading(btn, true);
    clearError(errEl);

    try {
      const user = await authService.register(name, email, password);
      onSuccess(user);
    } catch (err) {
      showError(errEl, err instanceof Error ? err.message : 'Registration failed.');
      setLoading(btn, false);
    }
  }

  render();
  return root;
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildHTML(view: AuthView): string {
  return `
    <div class="auth-bg">
      <div class="auth-card">

        <!-- Theme & Language toggle -->
        <div class="auth-controls">
          <button class="btn btn-ghost btn-icon auth-theme-btn" id="auth-theme-btn" aria-label="${i18n.t('topbar.toggleTheme')}"></button>
          <div id="auth-lang-switcher"></div>
        </div>

        <!-- Logo -->
        <div class="auth-logo">
          <div class="auth-logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div>
            <div class="auth-logo-name">${i18n.t('app.name')}</div>
            <div class="auth-logo-tagline">${i18n.t('app.tagline')}</div>
          </div>
        </div>

        <!-- Heading -->
        <div class="auth-heading">
          <h1 class="auth-title">${view === 'login' ? i18n.t('auth.welcomeBack') : i18n.t('auth.createAccount')}</h1>
          <p class="auth-subtitle">${view === 'login' ? i18n.t('auth.enterCredentials') : i18n.t('auth.setupAccount')}</p>
        </div>

        ${view === 'login' ? buildLoginForm() : buildRegisterForm()}

        <!-- Switch view -->
        <p class="auth-switch">
          ${view === 'login' ? i18n.t('auth.dontHaveAccount') : i18n.t('auth.alreadyHaveAccount')}
          <button class="auth-switch-btn" id="switch-view">
            ${view === 'login' ? i18n.t('auth.createOne') : i18n.t('auth.signIn')}
          </button>
        </p>

      </div>

      <!-- Decorative side panel -->
      <div class="auth-panel" aria-hidden="true">
        <div class="auth-panel-content">
          <div class="auth-panel-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" opacity="0.9">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <h2 class="auth-panel-title">${i18n.t('auth.manageBusinessSmarter')}</h2>
          <ul class="auth-panel-features">
            <li>${Icons.check(16)} ${i18n.t('auth.featureCustomers')}</li>
            <li>${Icons.check(16)} ${i18n.t('auth.featureProducts')}</li>
            <li>${Icons.check(16)} ${i18n.t('auth.featureSales')}</li>
            <li>${Icons.check(16)} ${i18n.t('auth.featureInvoices')}</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function buildLoginForm(): string {
  return `
    <form id="login-form" novalidate>
      <div id="login-error" class="auth-error" role="alert" aria-live="polite"></div>

      <div class="form-group">
        <label class="form-label" for="login-email">${i18n.t('auth.emailAddress')}</label>
        <input
          type="email"
          id="login-email"
          class="form-control"
          placeholder="you@example.com"
          autocomplete="email"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="login-password">${i18n.t('auth.password')}</label>
        <div class="pw-field">
          <input
            type="password"
            id="login-password"
            class="form-control"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
          <button type="button" class="pw-toggle" data-toggle-pw="login-password" aria-label="Toggle password visibility">
            ${Icons.eye(16)}
          </button>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-full" id="login-submit">
        ${i18n.t('auth.signIn')}
      </button>
    </form>
  `;
}

function buildRegisterForm(): string {
  return `
    <form id="register-form" novalidate>
      <div id="register-error" class="auth-error" role="alert" aria-live="polite"></div>

      <div class="form-group">
        <label class="form-label" for="reg-name">${i18n.t('auth.fullName')}</label>
        <input
          type="text"
          id="reg-name"
          class="form-control"
          placeholder="${i18n.t('auth.fullName')}"
          autocomplete="name"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="reg-email">${i18n.t('auth.emailAddress')}</label>
        <input
          type="email"
          id="reg-email"
          class="form-control"
          placeholder="you@example.com"
          autocomplete="email"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="reg-password">${i18n.t('auth.password')}</label>
        <div class="pw-field">
          <input
            type="password"
            id="reg-password"
            class="form-control"
            placeholder="Min. 6 characters"
            autocomplete="new-password"
            required
          />
          <button type="button" class="pw-toggle" data-toggle-pw="reg-password" aria-label="Toggle password visibility">
            ${Icons.eye(16)}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="reg-confirm">${i18n.t('auth.confirmPassword')}</label>
        <div class="pw-field">
          <input
            type="password"
            id="reg-confirm"
            class="form-control"
            placeholder="${i18n.t('auth.repeatPassword')}"
            autocomplete="new-password"
            required
          />
          <button type="button" class="pw-toggle" data-toggle-pw="reg-confirm" aria-label="Toggle confirm password visibility">
            ${Icons.eye(16)}
          </button>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-full" id="register-submit">
        ${i18n.t('auth.signUp')}
      </button>
    </form>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.classList.add('visible');
}

function clearError(el: HTMLElement): void {
  el.textContent = '';
  el.classList.remove('visible');
}

function setLoading(btn: HTMLButtonElement, loading: boolean): void {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> ${i18n.t('auth.pleaseWait')}`
    : btn.getAttribute('data-label') ?? btn.textContent ?? '';
  if (!loading) {
    // restore original label
    const label = btn.id === 'login-submit' ? i18n.t('auth.signIn') : i18n.t('auth.signUp');
    btn.textContent = label;
  }
}

function eyeOffIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}
