import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// A production bundle without these boots straight into a crash screen, so fail
// the build instead (Vercel: set them for Production *and* Preview).
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

function requireEnv(keys: string[]): Plugin {
  return {
    name: 'cache:require-env',
    apply: 'build',
    configResolved(config) {
      const missing = keys.filter(k => !String(config.env[k] ?? '').trim());
      if (missing.length) {
        throw new Error(
          `Missing required env: ${missing.join(', ')}. Set them in web/.env locally, or in Vercel → Settings → Environment Variables (Production and Preview).`
        );
      }
      if (!config.env.VITE_VAPID_PUBLIC_KEY) {
        config.logger.warn('VITE_VAPID_PUBLIC_KEY is not set — push reminders will be unavailable in this build.');
      }
    },
  };
}

// Tag error reports with the deployed commit and Vercel environment unless set
// explicitly. Unprefixed loadEnv so Vercel's system vars are visible.
function releaseTags(): Plugin {
  return {
    name: 'cache:release-tags',
    config(_config, { mode }) {
      const env = loadEnv(mode, '.', '');
      return {
        define: {
          'import.meta.env.VITE_RELEASE': JSON.stringify(env.VITE_RELEASE || env.VERCEL_GIT_COMMIT_SHA || ''),
          'import.meta.env.VITE_DEPLOY_ENV': JSON.stringify(env.VITE_DEPLOY_ENV || env.VERCEL_ENV || ''),
        },
      };
    },
  };
}

export default defineConfig({
  build: {
    // Font subsets load on demand by unicode-range; inlining the small ones would
    // put every script's glyphs into the critical CSS.
    assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  plugins: [
    requireEnv(REQUIRED_ENV),
    releaseTags(),
    react(),
    VitePWA({
      // The SW skips waiting; lib/pwaUpdate.ts registers it and decides when to reload.
      registerType: 'autoUpdate',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // App shell + the Latin JetBrains Mono files, so an offline cold start keeps the font.
        globPatterns: ['**/*.{js,css,html}', 'assets/jetbrains-mono-latin-{400,700}-normal-*.woff2'],
      },
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
        description: 'Capture a thought in two seconds, sort it later. A terminal-style note inbox.',
        categories: ['productivity'],
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        launch_handler: { client_mode: ['focus-existing', 'auto'] },
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
    // Cover the web app plus the pure server-side reminder logic in the Deno edge
    // function (supabase/functions/**), which has no runtime of its own to test in.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      '../supabase/functions/**/*.{test,spec}.ts',
    ],
  },
  // Allow Vite to transform the edge-function test file, which lives above web/.
  server: { fs: { allow: ['..'] } },
});
