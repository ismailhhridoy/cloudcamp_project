import { ReactNode } from "react";
import { BottomNav } from "./BottomNav.tsx";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { Globe } from "lucide-react";

interface MobileShellProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function MobileShell({ children, activeTab, setActiveTab }: MobileShellProps) {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen">
      <div className="w-full max-w-md bg-white min-h-screen shadow-xl relative flex flex-col">
        {/* Header — z-50 so nothing overlaps it */}
        <header className="p-4 border-b border-gray-100 bg-white sticky top-0 z-50 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <img src="/icons/CareAid-Aid-logo.png" alt="CareAid AI" className="w-8 h-8 rounded-lg object-cover shrink-0" />
            <h1 className="text-xl font-bold text-emerald-900">CareAid AI</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100 active:scale-95 transition-all"
            >
              <Globe size={12} />
              {lang === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <div className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
              {lang === 'en' ? 'Health Aide' : 'স্বাস্থ্য সহায়ক'}
            </div>
          </div>
        </header>

        {/* Content — pt-0 because header is sticky, pb-20 for bottom nav.
            On the Advice page main is locked to viewport height so the chat's internal
            scroller is the only scroller and the fixed input bar stays put. */}
        <main
          className={
            activeTab === "triage"
              ? "flex-1 h-screen overflow-hidden"
              : "flex-1 overflow-y-auto pb-20"
          }
        >
          {children}
        </main>

        {/* Bottom Nav — z-50 so nothing overlaps it */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}
