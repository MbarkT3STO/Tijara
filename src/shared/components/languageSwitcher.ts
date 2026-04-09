import { i18n } from '@core/i18n';
import { Icons } from './icons';
import type { Language } from '@core/i18n/types';

export function createLanguageSwitcher(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'language-switcher dropdown';
  wrapper.style.position = 'relative';

  const trigger = document.createElement('button');
  trigger.className = 'btn btn-ghost btn-sm';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');

  const updateTrigger = () => {
    const lang = i18n.currentLanguage;
    let label = 'EN';
    let flag = '🇺🇸';
    if (lang === 'fr') { label = 'FR'; flag = '🇫🇷'; }
    if (lang === 'ar') { label = 'AR'; flag = '🇸🇦'; }
    trigger.innerHTML = `<span style="font-size: 16px;">${flag}</span> <span style="font-weight: 500; margin: 0 4px;">${label}</span> ${Icons.chevronDown(14)}`;
  };
  
  updateTrigger();
  i18n.onLanguageChange(updateTrigger);

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.style.display = 'none';
  menu.style.minWidth = '140px';
  menu.innerHTML = `
    <button class="dropdown-item" data-lang="en">
      <span style="font-size: 16px;">🇺🇸</span> English
    </button>
    <button class="dropdown-item" data-lang="fr">
      <span style="font-size: 16px;">🇫🇷</span> Français
    </button>
    <button class="dropdown-item" data-lang="ar">
      <span style="font-size: 16px;">🇸🇦</span> العربية
    </button>
  `;

  let active = false;

  const close = () => {
    active = false;
    menu.style.display = 'none';
    trigger.setAttribute('aria-expanded', 'false');
  };

  const toggle = (e: Event) => {
    e.stopPropagation();
    active = !active;
    menu.style.display = active ? 'block' : 'none';
    trigger.setAttribute('aria-expanded', active ? 'true' : 'false');
  };

  trigger.addEventListener('click', toggle);
  document.addEventListener('click', close);

  menu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lang = btn.getAttribute('data-lang') as Language;
      i18n.setLanguage(lang);
      close();
    });
  });

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  return wrapper;
}
