/**
 * Application entry point.
 * Imports global styles and bootstraps the app.
 */

import '@styles/main.css';
import { bootstrap } from '@core/app';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Root element #app not found');
}

bootstrap(root).catch((err) => {
  console.error('Failed to bootstrap application:', err);
  root.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; color: #ef4444;">
      <div style="text-align: center;">
        <h1>Failed to start Tijara</h1>
        <p style="color: #666; margin-top: 8px;">${err instanceof Error ? err.message : 'Unknown error'}</p>
      </div>
    </div>
  `;
});
