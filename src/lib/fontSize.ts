// Patient-controlled global font size. Stored in localStorage and applied via a CSS variable
// `--app-font-scale` on the <html> element. Tailwind text-* classes still use em-based rules so
// scaling the root cleanly resizes the whole app.

import { useEffect, useState } from "react";

const KEY = "shasthyo_font_scale_v1";

export type FontScale = "sm" | "md" | "lg" | "xl";

const SCALE_VALUE: Record<FontScale, number> = {
  sm: 0.9,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
};

export function getFontScale(): FontScale {
  if (typeof window === "undefined") return "md";
  const v = window.localStorage.getItem(KEY) as FontScale | null;
  return v && v in SCALE_VALUE ? v : "md";
}

export function setFontScale(scale: FontScale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, scale);
  applyFontScale(scale);
  window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: scale }));
}

export function applyFontScale(scale: FontScale = getFontScale()): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.style.setProperty("--app-font-scale", String(SCALE_VALUE[scale]));
  html.style.fontSize = `${SCALE_VALUE[scale] * 100}%`;
}

export function useFontScale(): [FontScale, (s: FontScale) => void] {
  const [s, setS] = useState<FontScale>(getFontScale);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setS(getFontScale());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [s, (next: FontScale) => { setFontScale(next); setS(next); }];
}
