import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Precache the icon assets (generated locally by `npm run generate-pwa-assets`)
      // so they're available offline too, not just the app-shell JS/CSS/HTML.
      includeAssets: [
        'icons/favicon.ico',
        'icons/apple-touch-icon-180x180.png',
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
        'icons/maskable-icon-512x512.png',
        'icons/icon.svg',
      ],
      // Run the service worker under `vite dev` so PWA/offline/push can be tested
      // locally. Note: a dev SW can serve stale modules after a big refactor — if
      // localhost goes blank, unregister the SW / hard-reload (or rm -rf node_modules/.vite).
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
        suppressWarnings: true,
      },
      manifest: {
        id: '/',
        scope: '/',
        lang: 'en',
        name: 'CacheNotes',
        short_name: 'cache',
        description: 'Terminal-aesthetic note organizer',
        categories: ['productivity'],
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
