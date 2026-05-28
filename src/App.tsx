/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AppShell } from "./components/AppShell.tsx";
import { ConsentGate } from "./components/ConsentGate.tsx";
import { HomePage } from "./pages/Home.tsx";
import { TriagePage } from "./pages/Triage.tsx";
import { ScannerPage } from "./pages/Scanner.tsx";
import { DoctorsPage } from "./pages/Doctors.tsx";
import { DashboardPage } from "./pages/Dashboard.tsx";
import { CompliancePage } from "./pages/Compliance.tsx";
import { DoctorPortal } from "./pages/DoctorPortal.tsx";
import { SettingsPage } from "./pages/Settings.tsx";
import { PatientProfilePage } from "./pages/PatientProfile.tsx";
import { DocsPage } from "./pages/Docs.tsx";
import { AuthModal } from "./components/AuthModal.tsx";
import { useCurrentUser } from "./lib/store.ts";
import { auth } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { LogIn, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "./lib/LanguageContext.tsx";
import { getConsent } from "./lib/consent.ts";
import { autoLoadTfIfOptedIn } from "./lib/transformersEngine.ts";
import { autoLoadIfCached as autoLoadOcrIfCached } from "./lib/tesseractEngine.ts";
import { autoLoadIfCached as autoLoadVoiceIfCached } from "./lib/voiceEngine.ts";
import { hasPatientProfile } from "./lib/profile.ts";
import { PatientProfileSheet } from "./components/PatientProfileSheet.tsx";
import { firebaseConfigStatus } from "./lib/firebase.ts";
import { initDbSync, seedOnceIfNeeded } from "./lib/db.ts";
import { AlertTriangle } from "lucide-react";

export default function App() {
  // Standalone /docs route — full-page pitch deck + technical docs, rendered outside the app
  // tab shell. Resolved before the main app mounts so it never flashes the loading/consent gates.
  // A wrapper keeps the Rules of Hooks intact (no conditional hooks in AppMain).
  if (typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "") === "/docs") {
    return <DocsPage />;
  }
  return <AppMain />;
}

function AppMain() {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [hasConsent, setHasConsent] = useState<boolean>(() => !!getConsent());
  const [showProfileGate, setShowProfileGate] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const account = useCurrentUser();
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setShowLoginModal(false);
    });
    // Boot both offline engines in the background if the user has previously opted in. This way
    // they're ready by the time the patient opens Triage — no extra click after a reload.
    autoLoadTfIfOptedIn();
    autoLoadOcrIfCached();
    autoLoadVoiceIfCached();

    // Bootstrap Firestore sync (no-op if config is still MOCK).
    const stopDbSync = initDbSync();

    // One-time seed of demo content into Firestore. Picks up the existing seeded constants from
    // the Doctors / DoctorPortal pages and pushes them as real documents.
    if (firebaseConfigStatus === "ok") {
      import("./lib/seedFirestore.ts")
        .then((m) => seedOnceIfNeeded(m.getSeedData()))
        .then((r) => { if (r.seeded) console.log("[firestore] one-time seed complete"); })
        .catch((e) => console.warn("[firestore] seed error", e));
    }

    return () => {
      unsubscribe();
      stopDbSync();
    };
  }, []);

  const triggerLogin = () => {
    if (!account) {
      // Local auth (signup/signin) — Firebase config is a mock placeholder.
      setShowAuthModal(true);
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
      case "home":
        return <HomePage onNavigate={setActiveTab} />;
      case "triage":
        return <TriagePage onLoginRequired={triggerLogin} user={user} />;
      case "scan":
        return <ScannerPage onLoginRequired={triggerLogin} user={user} />;
      case "doctors":
        return <DoctorsPage onLoginRequired={triggerLogin} user={user} />;
      case "dashboard":
        return <DashboardPage />;
      case "compliance":
        return <CompliancePage />;
      case "doctor-portal":
        return <DoctorPortal />;
      case "settings":
        return <SettingsPage />;
      case "patient-profile":
        return (
          <PatientProfilePage
            onSignIn={() => setShowAuthModal(true)}
            onEditProfile={() => setShowProfileGate(true)}
          />
        );
      default:
        return <HomePage onNavigate={setActiveTab} />;
    }
  };

  return (
    <>
      {/* Firebase config sanity banner — non-blocking. Shown when config still has 'MOCK' values. */}
      {firebaseConfigStatus !== "ok" && (
        <div className="fixed top-0 inset-x-0 z-[200] bg-amber-500 text-white px-4 py-2 flex items-center gap-2 text-xs shadow-lg">
          <AlertTriangle size={14} />
          <span className="font-bold">
            {firebaseConfigStatus === "mock"
              ? "Firebase is not configured — sign-up / sign-in and cloud sync are disabled. Edit firebase-applet-config.json."
              : "Firebase failed to initialise — check the browser console for details."}
          </span>
        </div>
      )}
      <AppShell activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLoginClick={triggerLogin}>
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
      </AppShell>

      {/* Consent gate — first run only.
          On accept, if the user has no profile yet, immediately show the profile sheet so the
          diagnostic engine + health tips get the data they need to be personalised. */}
      {!hasConsent && (
        <ConsentGate
          onAccept={() => {
            setHasConsent(true);
            if (!hasPatientProfile()) setShowProfileGate(true);
          }}
          onReviewCompliance={() => {
            setHasConsent(true);
            setActiveTab("compliance");
          }}
        />
      )}

      {/* Patient profile sheet — appears right after Consent on first launch. */}
      <AnimatePresence>
        {hasConsent && showProfileGate && (
          <PatientProfileSheet onClose={() => setShowProfileGate(false)} />
        )}
      </AnimatePresence>

      {/* Auth (sign in / sign up) modal */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setActiveTab("patient-profile")}
          />
        )}
      </AnimatePresence>

    </>
  );
}
