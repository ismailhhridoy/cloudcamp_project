import { Home, MessageSquare, Camera, Users, BarChart3, ShieldCheck, LogIn, LogOut, Globe, Stethoscope } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { auth } from "../lib/firebase.ts";
import { signOut } from "firebase/auth";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLoginClick: () => void;
}

export function Sidebar({ activeTab, setActiveTab, user, onLoginClick }: SidebarProps) {
  const { t, lang, setLang } = useLanguage();

  const tabs = [
    { id: "home", icon: Home, label: t("app.nav.home") },
    { id: "triage", icon: MessageSquare, label: t("app.nav.triage") },
    { id: "scan", icon: Camera, label: t("app.nav.scan") },
    { id: "doctors", icon: Users, label: t("app.nav.doctors") },
    { id: "dashboard", icon: BarChart3, label: t("app.nav.dashboard") },
    { id: "compliance", icon: ShieldCheck, label: t("app.nav.compliance") },
    { id: "doctor-portal", icon: Stethoscope, label: t("app.nav.doctor_portal") },
  ];

  return (
    <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-64 lg:flex-col lg:bg-emerald-950 lg:text-white">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-emerald-900/60">
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xl">S</span>
        </div>
        <div>
          <p className="font-bold text-base leading-tight">ShasthyoAI</p>
          <p className="text-[10px] text-emerald-300 leading-tight">{lang === "bn" ? "স্বাস্থ্য সহায়ক" : "Health Companion"}</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                isActive ? "bg-emerald-600 text-white" : "text-emerald-100/70 hover:bg-emerald-900/40 hover:text-white"
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: language + auth */}
      <div className="border-t border-emerald-900/60 p-3 space-y-2">
        <button
          onClick={() => setLang(lang === "en" ? "bn" : "en")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-100/80 hover:bg-emerald-900/40 hover:text-white transition-colors"
        >
          <Globe size={16} />
          {lang === "en" ? "বাংলা" : "English"}
        </button>
        {user ? (
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-100/80 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          >
            <LogOut size={16} />
            {lang === "bn" ? "সাইন আউট" : "Sign out"}
          </button>
        ) : (
          <button
            onClick={onLoginClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
          >
            <LogIn size={16} />
            {lang === "bn" ? "সাইন ইন" : "Sign in"}
          </button>
        )}
        <p className="text-[10px] text-emerald-300/60 px-4 pt-2 leading-relaxed">
          {lang === "bn" ? "AI পরামর্শ — চিকিৎসার বিকল্প নয়।" : "AI guidance — not a substitute for clinical care."}
        </p>
      </div>
    </aside>
  );
}
