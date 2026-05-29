import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext.tsx";

// Reliable "Install app" entry point. Browsers fire `beforeinstallprompt` inconsistently (only
// after engagement heuristics, once per period, never after install). We capture that event and
// expose a button so the user can install on demand. On iOS — which never fires the event — we
// show a short "Add to Home Screen" hint instead. Renders nothing when already installed or when
// installation isn't available.
export function InstallButton({ className }: { className?: string }) {
  const { lang } = useLanguage();
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }

    const ua = navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    setIsIOS(ios);

    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  // iOS: no programmatic install — show a manual hint.
  if (isIOS) {
    return (
      <div className={className}>
        <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          <Share size={14} />
          {lang === "bn"
            ? "ইনস্টল করতে: Share → Add to Home Screen"
            : "To install: Share → Add to Home Screen"}
        </p>
      </div>
    );
  }

  if (!deferred) return null;

  const install = async () => {
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
  };

  return (
    <button
      onClick={install}
      className={
        className ||
        "w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-colors"
      }
    >
      <Download size={16} />
      {lang === "bn" ? "অ্যাপ ইনস্টল করুন" : "Install app"}
    </button>
  );
}
