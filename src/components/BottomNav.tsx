import { useState } from "react";
import { Home, MessageSquare, Camera, Users, MoreHorizontal, BarChart3, ShieldCheck, Stethoscope, Settings as SettingsIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const { t } = useLanguage();
  const [showMore, setShowMore] = useState(false);
  const tabs = [
    { id: 'home', icon: Home, label: t('app.nav.home') },
    { id: 'triage', icon: MessageSquare, label: t('app.nav.triage') },
    { id: 'scan', icon: Camera, label: t('app.nav.scan') },
    { id: 'doctors', icon: Users, label: t('app.nav.doctors') },
  ];

  const moreItems = [
    { id: "dashboard", icon: BarChart3, label: t("more.dashboard") },
    { id: "compliance", icon: ShieldCheck, label: t("more.compliance") },
    { id: "doctor-portal", icon: Stethoscope, label: t("more.doctor_portal") },
    { id: "settings", icon: SettingsIcon, label: t("more.settings") },
  ];

  const isMoreActive = moreItems.some((m) => m.id === activeTab);

  return (
    <>
    <nav className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex justify-around items-center py-3 px-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
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

      <button
        onClick={() => setShowMore(true)}
        className={cn(
          "flex flex-col items-center gap-1 transition-all relative px-3 py-1 rounded-xl",
          isMoreActive ? "text-emerald-600" : "text-gray-400"
        )}
      >
        {isMoreActive && <span className="absolute inset-0 bg-emerald-50 rounded-xl" />}
        <MoreHorizontal size={22} strokeWidth={isMoreActive ? 2.5 : 2} className="relative z-10" />
        <span className="text-[10px] font-medium relative z-10">{t("app.nav.more")}</span>
      </button>
    </nav>

    {/* More sheet */}
    <AnimatePresence>
      {showMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="lg:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end"
          onClick={() => setShowMore(false)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 space-y-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-gray-900">{t("more.title")}</h3>
              <button onClick={() => setShowMore(false)} className="text-gray-400">
                <X size={22} />
              </button>
            </div>
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setShowMore(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-colors",
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
