import { ReactNode } from "react";
import { BottomNav } from "./BottomNav.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";

interface AppShellProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLoginClick: () => void;
}

export function AppShell({ children, activeTab, setActiveTab, user, onLoginClick }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-100 lg:bg-gray-50">
      <div className="lg:flex lg:min-h-screen">
        {/* Desktop sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLoginClick={onLoginClick} />

        {/* Main column */}
        <div className="flex-1 flex flex-col lg:ml-64">
          <TopBar onLoginClick={onLoginClick} />

          {/* Mobile-only width cap so the look matches the original phone shell.
              Desktop gets full-bleed content with its own max-widths per page. */}
          <main className="flex-1 mx-auto w-full max-w-md lg:max-w-none bg-white lg:bg-transparent shadow-xl lg:shadow-none pb-20 lg:pb-12">
            {children}
          </main>

          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </div>
    </div>
  );
}
