import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './lib/LanguageContext.tsx';
import { applyFontScale } from './lib/fontSize.ts';

// Apply the persisted font scale before React mounts so the UI never flashes at the wrong size.
applyFontScale();

// Service worker auto-update: when a new app build is deployed, the SW picks it up on next launch.
// The WebLLM model itself is independent — it lives in its own IndexedDB and is updated via the
// Settings page after consulting /model-manifest.json.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
