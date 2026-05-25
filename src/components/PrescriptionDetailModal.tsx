import { useState } from "react";
import { X, Calendar, FileText, Pill, FlaskConical, Apple, Stethoscope, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import type { SavedPrescription, ExtractedMedicine } from "../lib/types.ts";
import { DoseGrid } from "./DoseGrid.tsx";

interface Props {
  record: SavedPrescription;
  onClose: () => void;
}

export function PrescriptionDetailModal({ record, onClose }: Props) {
  const { t, lang } = useLanguage();
  const [expandedMed, setExpandedMed] = useState<number | null>(null);
  const extraction = record.extraction;
  const meds: ExtractedMedicine[] = (extraction?.medicines || []) as ExtractedMedicine[];
  const tests: string[] = (extraction?.tests || []) as string[];

  return (
    <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm flex items-end lg:items-center justify-center overflow-y-auto">
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        className="w-full lg:max-w-2xl bg-white rounded-t-3xl lg:rounded-3xl p-5 sm:p-6 max-h-[95vh] overflow-y-auto"
      >
        <header className="flex items-start justify-between mb-4 sticky top-0 bg-white pb-2 z-10">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
              {lang === "bn" ? "প্রেসক্রিপশন বিস্তারিত" : "Prescription details"}
            </p>
            <h2 className="text-lg font-black text-gray-900 mt-0.5 truncate">
              {record.doctor.name || (lang === "bn" ? "ডাক্তার শনাক্ত হয়নি" : "Doctor not identified")}
            </h2>
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
              <Calendar size={11} /> {new Date(record.scannedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={22} />
          </button>
        </header>

        {/* Original uploaded image */}
        {record.imagePreview && (
          <section className="mb-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              {lang === "bn" ? "আপলোড করা ছবি" : "Uploaded image"}
            </p>
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-black">
              <img src={record.imagePreview} alt="prescription" className="w-full object-contain max-h-[420px]" />
            </div>
          </section>
        )}

        {/* Doctor block */}
        <section className="mb-4 bg-gray-50 rounded-2xl p-3 text-sm space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t("scan.result.doctor_detected")}</p>
          {record.doctor.specialization && <p className="text-gray-700">{record.doctor.specialization}</p>}
          {record.doctor.hospital && <p className="text-gray-700">{record.doctor.hospital}</p>}
          {record.doctor.bmdc ? (
            <p className="text-gray-600 text-xs">BMDC: <span className="font-mono">{record.doctor.bmdc}</span></p>
          ) : (
            <p className="text-amber-700 text-xs">{lang === "bn" ? "BMDC দেখা যাচ্ছে না" : "No BMDC visible"}</p>
          )}
        </section>

        {/* Diagnosis hint + follow-up */}
        {(extraction?.diagnosis_hint || extraction?.follow_up || extraction?.chief_complaint) && (
          <section className="mb-4 space-y-2">
            {extraction?.chief_complaint && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
                <FileText size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{lang === "bn" ? "অভিযোগ" : "Chief complaint"}</p>
                  <p className="text-xs text-blue-900 mt-0.5">{extraction.chief_complaint}</p>
                </div>
              </div>
            )}
            {extraction?.diagnosis_hint && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex gap-2">
                <Stethoscope size={14} className="text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{lang === "bn" ? "সম্ভাব্য রোগ" : "Likely diagnosis"}</p>
                  <p className="text-xs text-purple-900 mt-0.5">{extraction.diagnosis_hint}</p>
                </div>
              </div>
            )}
            {extraction?.follow_up && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{lang === "bn" ? "ফলো-আপ" : "Follow-up"}</p>
                <p className="text-xs text-emerald-900 mt-0.5">{extraction.follow_up}</p>
              </div>
            )}
          </section>
        )}

        {/* Medicines */}
        {meds.length > 0 && (
          <section className="mb-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1">
              {t("scan.result.meds_title")} ({meds.length})
            </p>
            {meds.map((m, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedMed(expandedMed === i ? null : i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                >
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                    <Pill size={14} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <p className="font-bold text-sm text-gray-900 truncate">{m.name}</p>
                      {m.strength && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{m.strength}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <DoseGrid schedule={m.schedule || { morning: 0, noon: 0, night: 0 }} lang={lang as "en" | "bn"} compact />
                      {(() => {
                        const dur = lang === "bn" ? (m.duration_bn || m.duration) : (m.duration || m.duration_bn);
                        return dur ? <span className="text-[10px] text-gray-500 font-medium">· {dur}</span> : null;
                      })()}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                    {expandedMed === i ? <><ChevronUp size={11} /> {lang === "bn" ? "কম" : "Less"}</> : <><ChevronDown size={11} /> {lang === "bn" ? "বিস্তারিত" : "Details"}</>}
                  </span>
                </button>
                {expandedMed === i && (
                  <div className="px-3 pb-3 border-t border-gray-50 pt-2.5 space-y-2 text-xs">
                    <DoseGrid schedule={m.schedule || { morning: 0, noon: 0, night: 0 }} lang={lang as "en" | "bn"} />
                    {(m.purpose_english || m.purpose_bangla) && (
                      <p className="text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg p-2">
                        {lang === "bn" ? (m.purpose_bangla || m.purpose_english) : (m.purpose_english || m.purpose_bangla)}
                      </p>
                    )}
                    {(m.warnings || m.warnings_bn) && (
                      <p className="text-orange-800 bg-orange-50 border border-orange-100 rounded-lg p-2">
                        {lang === "bn" ? (m.warnings_bn || m.warnings) : (m.warnings || m.warnings_bn)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Tests */}
        {tests.length > 0 && (
          <section className="mb-4">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FlaskConical size={12} /> {lang === "bn" ? "পরীক্ষা সুপারিশ" : "Recommended tests"}
            </p>
            <ul className="text-sm text-gray-700 space-y-1">
              {tests.map((t, i) => <li key={i} className="flex gap-2"><span className="text-blue-500">•</span>{t}</li>)}
            </ul>
          </section>
        )}

        {/* Nutrition */}
        {Array.isArray(extraction?.nutrition_guidelines) && extraction!.nutrition_guidelines.length > 0 && (
          <section className="mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Apple size={12} /> {lang === "bn" ? "পুষ্টি নির্দেশিকা" : "Nutrition guidelines"}
            </p>
            <ul className="space-y-1.5 text-xs text-emerald-900 leading-relaxed">
              {(lang === "bn" && extraction!.nutrition_guidelines_bn?.length
                ? extraction!.nutrition_guidelines_bn
                : extraction!.nutrition_guidelines
              ).map((tip, i) => <li key={i} className="flex gap-2"><span>•</span>{tip}</li>)}
            </ul>
          </section>
        )}

        {/* Patient notes */}
        {extraction?.patient_notes && (
          <section className="mb-2 bg-blue-50 border border-blue-100 rounded-2xl p-3">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{lang === "bn" ? "ডাক্তারের নির্দেশনা" : "Doctor's notes"}</p>
            <p className="text-xs text-blue-900 mt-1">{extraction.patient_notes}</p>
          </section>
        )}

        <button
          onClick={onClose}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-sm font-bold mt-4"
        >
          {lang === "bn" ? "বন্ধ করুন" : "Close"}
        </button>
      </motion.div>
    </div>
  );
}
