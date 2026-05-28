import { Globe, LogIn, LogOut } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { useCurrentUser, signOut as signOutLocal } from "../lib/store.ts";

interface TopBarProps {
  onLoginClick: () => void;
}

export function TopBar({ onLoginClick }: TopBarProps) {
  const { lang, setLang } = useLanguage();
  const account = useCurrentUser();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
      {/* Mobile header (hidden on lg) */}
      <div className="lg:hidden px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
  <img
    src="/icons/CareAid-Ai-Logo.png"
    alt="CareAid AI"
    className="h-8 w-auto object-contain"
  />
  
</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100 active:scale-95 transition-all"
          >
            <Globe size={12} />
            {lang === "en" ? "বাংলা" : "EN"}
          </button>
        </div>
      </div>

      {/* Desktop header (only on lg) */}
      <div className="hidden lg:flex items-center justify-between px-8 py-4">
        <p className="text-sm text-gray-500">
          {lang === "bn"
            ? "AI-চালিত গ্রামীণ স্বাস্থ্য সহায়ক — চিকিৎসকের যাচাই সহ"
            : "AI-powered rural health companion — with licensed-doctor verification"}
        </p>
        <div className="flex items-center gap-3">
          {account ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 text-xs font-bold">
                {account.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700">{account.name}</span>
              <button
                onClick={() => signOutLocal()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                <LogOut size={14} /> {lang === "bn" ? "সাইন আউট" : "Sign out"}
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              <LogIn size={14} /> {lang === "bn" ? "সাইন ইন" : "Sign in"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
