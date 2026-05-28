import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './lib/LanguageContext.tsx';
import { applyFontScale } from './lib/fontSize.ts';

applyFontScale();

// PWA service worker — register only when the virtual module exists (production build with
// vite-plugin-pwa active). The module ID is constructed at runtime so Vite's import analyzer
// doesn't try to resolve it during dev transforms.
const pwaModuleId = ['virtual', 'pwa-register'].join(':');
import(/* @vite-ignore */ pwaModuleId)
  .then(({ registerSW }) => registerSW({ immediate: true }))
  .catch(() => { /* dev mode — no SW */ });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
