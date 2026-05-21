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
          // Larger max size: we want index + chunks cached for offline app shell. The LLM model
          // weights are NOT cached here — WebLLM manages its own IndexedDB cache.
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,svg,woff2,json}'],
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
