import { Home, MessageSquare, Camera, Users, BarChart3 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const { t } = useLanguage();
  const tabs = [
    { id: 'home', icon: Home, label: t('app.nav.home') },
    { id: 'triage', icon: MessageSquare, label: t('app.nav.triage') },
    { id: 'scan', icon: Camera, label: t('app.nav.scan') },
    { id: 'doctors', icon: Users, label: t('app.nav.doctors') },
    { id: 'dashboard', icon: BarChart3, label: t('app.nav.dashboard') },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex justify-around items-center py-3 px-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all relative px-3 py-1 rounded-xl",
              isActive ? "text-emerald-600" : "text-gray-400"
            )}
          >
            {isActive && (
              <span className="absolute inset-0 bg-emerald-50 rounded-xl" />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
            <span className="text-[10px] font-medium relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
