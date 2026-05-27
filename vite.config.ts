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
        // Dev SW lets us test offline behaviour with `npm run dev`.
        devOptions: {enabled: true, type: 'module'},
        includeAssets: ['icons/icon.svg', 'model-manifest.json'],
        manifest: {
          name: 'ShasthyoAI — স্বাস্থ্য সহায়ক',
          short_name: 'ShasthyoAI',
          description: 'AI-powered Bangla health companion. Works offline once installed.',
          theme_color: '#065f46',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          lang: 'bn',
          icons: [
            {src: '/icons/icon.svg', sizes: '192x192', type: 'image/svg+xml'},
            {src: '/icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable'},
          ],
        },
        workbox: {
          // App shell + small assets are precached. Large WASM files (ONNX Runtime ~23MB,
          // tesseract-core ~3MB each) are excluded from precache via globIgnores and instead
          // runtime-cached on first use — this avoids the build failing on Render/Vercel where
          // the service-worker precache manifest has a hard size gate.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,svg,woff2,json}'],
          globIgnores: ['**/*.wasm'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({url}) => url.pathname === '/api/offline-triage',
              handler: 'StaleWhileRevalidate',
              options: {cacheName: 'offline-triage-rules'},
            },
            {
              urlPattern: ({url}) => url.pathname === '/model-manifest.json',
              handler: 'NetworkFirst',
              options: {cacheName: 'model-manifest', networkTimeoutSeconds: 3},
            },
            {
              // Large WASM files (ONNX Runtime, Tesseract core) — runtime-cached on first
              // load so they're offline-ready after the initial page visit. Not precached
              // because the 23MB ort-wasm file blows the build-time precache limit.
              urlPattern: ({request, url}) =>
                url.origin === self.location.origin &&
                (request.destination === '' || request.destination === 'script') &&
                /\.wasm(\.js)?$/.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'wasm-runtime',
                expiration: {maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365},
              },
            },
            {
              // Tesseract.js language data is fetched from jsdelivr on first OCR run. Cache
              // forever so every subsequent prescription scan works offline. ~10-17MB per
              // language file (eng + ben). Opaque responses (status 0) included so cross-
              // origin fetches are still cached when CORS headers vary.
              urlPattern: ({url}) =>
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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
