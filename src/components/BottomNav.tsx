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
    <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-100 flex justify-around items-center py-3 px-2 z-20">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors relative",
              isActive ? "text-emerald-600" : "text-gray-400"
            )}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {isActive && (
              <span className="absolute -top-1 w-1 h-1 bg-emerald-600 rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
