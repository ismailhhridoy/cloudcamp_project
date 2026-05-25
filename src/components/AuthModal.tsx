import { useState } from "react";
import { X, UserRound, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { signIn, signUp } from "../lib/store.ts";
import { fbSignInWithGoogle } from "../lib/firebase.ts";

interface AuthModalProps { onClose: () => void; onSuccess?: () => void; }

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorMessage = (code: string): string => {
    const map: Record<string, { en: string; bn: string }> = {
      ACCOUNT_EXISTS: { en: "An account already exists for this email — please sign in.", bn: "এই ইমেইলে অ্যাকাউন্ট আছে — সাইন ইন করুন।" },
      NO_ACCOUNT: { en: "No account found for that email.", bn: "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" },
      WRONG_PASSWORD: { en: "Wrong password. Please try again.", bn: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" },
      PASSWORD_TOO_SHORT: { en: "Password must be at least 6 characters.", bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" },
      NAME_REQUIRED: { en: "Please enter your name.", bn: "আপনার নাম লিখুন।" },
      EMAIL_REQUIRED: { en: "Please enter your email.", bn: "আপনার ইমেইল লিখুন।" },
      GOOGLE_POPUP_BLOCKED: { en: "Browser blocked the Google sign-in window. Please allow popups for this site.", bn: "ব্রাউজার Google সাইন-ইন উইন্ডো ব্লক করেছে। এই সাইটের জন্য পপআপ Allow করুন।" },
      GOOGLE_CANCELLED: { en: "Google sign-in cancelled.", bn: "Google সাইন-ইন বাতিল হয়েছে।" },
    };
    return map[code]?.[lang === "bn" ? "bn" : "en"] || code;
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await fbSignInWithGoogle();
      onSuccess?.();
      onClose();
    } catch (e: any) {
      const code = String(e?.code || "");
      if (code.includes("popup-blocked")) setError(errorMessage("GOOGLE_POPUP_BLOCKED"));
      else if (code.includes("popup-closed") || code.includes("cancelled-popup")) setError(errorMessage("GOOGLE_CANCELLED"));
      else setError(e?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(name, email, pwd);
      } else {
        await signIn(email, pwd);
      }
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(errorMessage(e?.message || "unknown"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl p-6 sm:p-8 max-h-[95vh] overflow-y-auto"
      >
        <header className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <UserRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">
                {mode === "signup" ? t("auth.signup.title") : t("auth.signin.title")}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === "signup" ? t("auth.signup.intro") : t("auth.signin.intro")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </header>

        {/* Google sign-in — works for both signup and signin */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full bg-white border border-gray-200 text-gray-800 py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-colors mb-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853"/>
            <path d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" fill="#EA4335"/>
          </svg>
          {lang === "bn" ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="h-px bg-gray-100 flex-1" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {lang === "bn" ? "অথবা" : "or"}
          </span>
          <div className="h-px bg-gray-100 flex-1" />
        </div>

        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5 text-xs">
          <button
            onClick={() => { setMode("signin"); setError(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all ${mode === "signin" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"}`}
          >
            {t("auth.signin.tab")}
          </button>
          <button
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all ${mode === "signup" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"}`}
          >
            {t("auth.signup.tab")}
          </button>
        </div>

        <div className="space-y-3">
          {mode === "signup" && (
            <Field label={t("auth.name")}>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="name" />
            </Field>
          )}
          <Field label={t("auth.email")}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" />
          </Field>
          <Field label={t("auth.password")}>
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="input" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 flex gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !email.trim() || !pwd.trim() || (mode === "signup" && !name.trim())}
            className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {mode === "signup" ? <UserPlus size={16} /> : <LogIn size={16} />}
            {mode === "signup" ? t("auth.signup.cta") : t("auth.signin.cta")}
          </button>

          <p className="text-[11px] text-gray-500 leading-relaxed text-center">
            {t("auth.privacy")}
          </p>
        </div>

        <style>{`
          .input {
            width: 100%; background: #f9fafb; border: 1px solid #f3f4f6;
            border-radius: 0.75rem; padding: 0.65rem 0.85rem; font-size: 0.9rem; color: #111827;
            outline: none;
          }
          .input:focus { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15); }
        `}</style>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
