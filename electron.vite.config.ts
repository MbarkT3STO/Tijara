/**
 * electron-vite configuration.
 * Uses electron-vite's default output structure:
 *   out/main/index.js      – main process
 *   out/preload/index.js   – preload script
 *   out/renderer/          – renderer (Vite bundle)
 */

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          manualChunks: {
            xlsx: ['xlsx'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@core': resolve(__dirname, 'src/core'),
        '@features': resolve(__dirname, 'src/features'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@data': resolve(__dirname, 'src/data'),
        '@services': resolve(__dirname, 'src/services'),
        '@styles': resolve(__dirname, 'src/styles'),
      },
    },
  },
});
