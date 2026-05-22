import { useState } from "react";
import { ShieldCheck, AlertTriangle, Stethoscope, Database, Phone } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { saveConsent } from "../lib/consent.ts";

interface ConsentGateProps {
  onAccept: () => void;
  onReviewCompliance: () => void;
}

export function ConsentGate({ onAccept, onReviewCompliance }: ConsentGateProps) {
  const { t } = useLanguage();
  const [acks, setAcks] = useState({
    aiNotDoctor: false,
    doctorVerification: false,
    dataHandling: false,
    emergencyDisclaimer: false,
  });

  const allAck = Object.values(acks).every(Boolean);

  const items = [
    { key: "aiNotDoctor", icon: Stethoscope, label: t("consent.item.ai") },
    { key: "doctorVerification", icon: ShieldCheck, label: t("consent.item.verify") },
    { key: "dataHandling", icon: Database, label: t("consent.item.data") },
    { key: "emergencyDisclaimer", icon: Phone, label: t("consent.item.emergency") },
  ] as const;

  const handleAccept = () => {
    if (!allAck) return;
    saveConsent({
      acceptedAt: new Date().toISOString(),
      version: 1,
      acknowledgements: { ...acks },
    });
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl my-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
            <AlertTriangle size={26} />
          </div>
          <h2 className="text-xl font-black text-gray-900">{t("consent.title")}</h2>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-5">{t("consent.intro")}</p>

        <div className="space-y-3 mb-5">
          {items.map(({ key, icon: Icon, label }) => {
            const checked = acks[key];
            return (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                  checked ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 accent-emerald-600 shrink-0"
                  checked={checked}
                  onChange={(e) => setAcks((p) => ({ ...p, [key]: e.target.checked }))}
                />
                <Icon size={18} className={`shrink-0 mt-0.5 ${checked ? "text-emerald-600" : "text-gray-400"}`} />
                <span className="text-sm text-gray-700 leading-snug">{label}</span>
              </label>
            );
          })}
        </div>

        <button
          onClick={handleAccept}
          disabled={!allAck}
          className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
        >
          {t("consent.accept")}
        </button>

        <button
          onClick={onReviewCompliance}
          className="w-full mt-2 py-2 text-xs text-emerald-700 font-medium hover:underline"
        >
          {t("consent.review")}
        </button>
      </motion.div>
    </div>
  );
}
