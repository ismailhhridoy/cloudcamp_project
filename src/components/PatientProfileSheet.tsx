import { useState } from "react";
import { X, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { setPatientProfile, usePatientProfile, CONDITION_OPTIONS } from "../lib/profile.ts";
import type { ChronicCondition } from "../lib/types.ts";

const DISTRICTS = [
  "Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barisal", "Mymensingh", "Rangpur",
  "Cumilla", "Noakhali", "Tangail", "Jashore", "Kushtia", "Dinajpur", "Bogura", "Faridpur",
  "Satkhira", "Gaibandha", "Narsingdi",
];

const CONDITION_LABELS: Record<ChronicCondition, { en: string; bn: string }> = {
  diabetes: { en: "Diabetes", bn: "ডায়াবেটিস" },
  hypertension: { en: "Hypertension", bn: "উচ্চ রক্তচাপ" },
  heart_disease: { en: "Heart disease", bn: "হৃদরোগ" },
  asthma: { en: "Asthma", bn: "হাঁপানি" },
  kidney_disease: { en: "Kidney disease", bn: "কিডনি রোগ" },
  pregnancy: { en: "Pregnant", bn: "গর্ভবতী" },
  tb_history: { en: "TB history", bn: "টিবি ইতিহাস" },
  immunocompromised: { en: "Immunocompromised", bn: "কম রোগ প্রতিরোধ" },
};

interface Props { onClose: () => void; }

export function PatientProfileSheet({ onClose }: Props) {
  const { t, lang } = useLanguage();
  const current = usePatientProfile();
  const [age, setAge] = useState<string>(current.age != null ? String(current.age) : "");
  const [sex, setSex] = useState<string>(current.sex || "");
  const [district, setDistrict] = useState<string>(current.district || "");
  const [conditions, setConditions] = useState<ChronicCondition[]>(current.conditions || []);
  const [pregnancyWeeks, setPregnancyWeeks] = useState<string>(current.pregnancyWeeks != null ? String(current.pregnancyWeeks) : "");

  const toggle = (c: ChronicCondition) =>
    setConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const save = () => {
    setPatientProfile({
      age: age ? Number(age) : undefined,
      sex: (sex as any) || undefined,
      district: district || undefined,
      conditions,
      pregnancyWeeks: pregnancyWeeks ? Number(pregnancyWeeks) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full lg:max-w-xl bg-white rounded-t-3xl lg:rounded-3xl p-6 sm:p-7 max-h-[95vh] overflow-y-auto"
      >
        <header className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <UserRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">{t("profile.title")}</h2>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t("profile.intro")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </header>

        <div className="space-y-4">
          {/* Age + sex */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("profile.age")}>
              <input
                type="number"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t("profile.sex")}>
              <select value={sex} onChange={(e) => setSex(e.target.value)} className="input">
                <option value="">{lang === "bn" ? "নির্বাচন করুন" : "Select"}</option>
                <option value="male">{lang === "bn" ? "পুরুষ" : "Male"}</option>
                <option value="female">{lang === "bn" ? "মহিলা" : "Female"}</option>
                <option value="other">{lang === "bn" ? "অন্যান্য" : "Other"}</option>
              </select>
            </Field>
          </div>

          {/* District */}
          <Field label={t("profile.district")}>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className="input">
              <option value="">{lang === "bn" ? "নির্বাচন করুন" : "Select district"}</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>

          {/* Conditions */}
          <Field label={t("profile.conditions")}>
            <div className="flex flex-wrap gap-2">
              {CONDITION_OPTIONS.map((c) => {
                const active = conditions.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      active
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {lang === "bn" ? CONDITION_LABELS[c].bn : CONDITION_LABELS[c].en}
                  </button>
                );
              })}
            </div>
          </Field>

          {conditions.includes("pregnancy") && (
            <Field label={t("profile.pregnancyWeeks")}>
              <input
                type="number"
                min={1}
                max={42}
                value={pregnancyWeeks}
                onChange={(e) => setPregnancyWeeks(e.target.value)}
                className="input"
              />
            </Field>
          )}

          <button
            onClick={save}
            className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-500 transition-colors"
          >
            {t("profile.save")}
          </button>
          <p className="text-[11px] text-gray-500 leading-relaxed text-center">
            {t("profile.privacy")}
          </p>
        </div>

        <style>{`
          .input {
            width: 100%; background: #f9fafb; border: 1px solid #f3f4f6;
            border-radius: 0.75rem; padding: 0.6rem 0.8rem; font-size: 0.875rem; color: #111827;
            outline: none;
          }
          .input:focus { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15); }
        `}</style>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
