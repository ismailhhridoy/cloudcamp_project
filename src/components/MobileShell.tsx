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
        {/* Header */}
        <header className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <h1 className="text-xl font-bold text-emerald-900">ShasthyoAI</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100"
            >
              <Globe size={12} />
              {lang === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <div className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
              {lang === 'en' ? 'Health Aide' : 'স্বাস্থ্য সহায়ক'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-24">
          {children}
        </main>

        {/* Bottom Nav */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}
