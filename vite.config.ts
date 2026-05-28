import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Auto-inject the SW registration into the built bundle. This means we do NOT import
        // `virtual:pwa-register` anywhere in app code — avoiding the production "blocked by CORS /
        // ERR_FAILED" error that happens when the virtual module is referenced but not resolved.
        injectRegister: 'auto',
        // No service worker in dev — keeps `npx vite` free of stale-cache confusion while building.
        devOptions: {enabled: false},
        includeAssets: ['icons/CareAid-Aid-logo.png', 'model-manifest.json'],
        manifest: {
          name: 'CareAid AI — স্বাস্থ্য সহায়ক',
          short_name: 'CareAid AI',
          description: 'AI-powered Bangla health companion. Works offline once installed.',
          theme_color: '#065f46',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          lang: 'bn',
          icons: [
            {src: '/icons/CareAid-Aid-logo.png', sizes: '192x192', type: 'image/png'},
            {src: '/icons/CareAid-Aid-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'},
          ],
        },
        workbox: {
          // App shell + small assets precached. Large WASM (ONNX ~23MB, tesseract-core ~3MB each)
          // excluded from precache and runtime-cached instead, so the build doesn't blow the
          // service-worker precache size gate on Render.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,svg,woff2,json}'],
          globIgnores: ['**/*.wasm'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/mcp\//],
          runtimeCaching: [
            {
              urlPattern: ({url}: {url: URL}) => url.pathname === '/api/offline-triage',
              handler: 'StaleWhileRevalidate',
              options: {cacheName: 'offline-triage-rules'},
            },
            {
              urlPattern: ({url}: {url: URL}) => url.pathname === '/model-manifest.json',
              handler: 'NetworkFirst',
              options: {cacheName: 'model-manifest', networkTimeoutSeconds: 3},
            },
            {
              urlPattern: ({url}: {url: URL}) => /\.wasm(\.js)?$/.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'wasm-runtime',
                expiration: {maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365},
              },
            },
            {
              urlPattern: ({url}: {url: URL}) =>
                url.origin === 'https://cdn.jsdelivr.net' &&
                /\/npm\/@tesseract\.js-data\//.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'tesseract-langdata',
                expiration: {maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
          ],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
