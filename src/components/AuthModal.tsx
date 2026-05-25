import { useState } from "react";
import { X, UserRound, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { signIn, signUp } from "../lib/store.ts";

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
    };
    return map[code]?.[lang === "bn" ? "bn" : "en"] || code;
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
