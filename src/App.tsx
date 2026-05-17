/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { MobileShell } from "./components/MobileShell.tsx";
import { HomePage } from "./pages/Home.tsx";
import { TriagePage } from "./pages/Triage.tsx";
import { ScannerPage } from "./pages/Scanner.tsx";
import { DoctorsPage } from "./pages/Doctors.tsx";
import { DashboardPage } from "./pages/Dashboard.tsx";
import { auth, signInWithGoogle } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { LogIn, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "./lib/LanguageContext.tsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setShowLoginModal(false);
    });
    return () => unsubscribe();
  }, []);

  const triggerLogin = () => {
    if (!user) {
      setShowLoginModal(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-emerald-900">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-emerald-400 w-12 h-12 mx-auto" />
          <div className="text-white font-bold tracking-widest uppercase text-xs">Loading ShasthyoAI...</div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomePage onNavigate={setActiveTab} />;
      case 'triage': return <TriagePage onLoginRequired={triggerLogin} user={user} />;
      case 'scan': return <ScannerPage onLoginRequired={triggerLogin} user={user} />;
      case 'doctors': return <DoctorsPage onLoginRequired={triggerLogin} user={user} />;
      case 'dashboard': return <DashboardPage />;
      default: return <HomePage onNavigate={setActiveTab} />;
    }
  };

  return (
    <>
      <MobileShell activeTab={activeTab} setActiveTab={setActiveTab}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </MobileShell>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md bg-white rounded-t-3xl p-8 relative shadow-2xl"
            >
              <button 
                onClick={() => setShowLoginModal(false)}
                className="absolute top-6 right-6 text-gray-400"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600">
                  <LogIn size={40} />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900">{t('auth.prompt.title')}</h2>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {t('auth.prompt.desc')}
                  </p>
                </div>

                <button 
                  onClick={signInWithGoogle}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-500 transition-colors"
                >
                  <LogIn size={20} />
                  {t('auth.btn.google')}
                </button>
                
                <button 
                   onClick={() => setShowLoginModal(false)}
                   className="text-gray-400 text-sm font-medium"
                >
                  {t('auth.btn.skip')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

