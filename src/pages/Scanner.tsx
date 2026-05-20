import { useState } from "react";
import { Camera, CheckCircle2, AlertCircle, Loader2, PlayCircle, Pill, ShieldCheck, Clock, Bell, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { User } from "firebase/auth";

export function ScannerPage({ onLoginRequired, user }: { onLoginRequired: () => void; user: User | null }) {
  const { t, lang } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMed, setExpandedMed] = useState<number | null>(null);
  const [reminderSet, setReminderSet] = useState<Set<number>>(new Set());
  const [showRatingModal, setShowRatingModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview || isLoading) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    const base64 = preview.split(",")[1];
    try {
      const response = await fetch("/api/scan-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to analyze. Please try with a clearer image.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetReminder = (idx: number, medName: string) => {
    if (!user) { onLoginRequired(); return; }
    setReminderSet(prev => new Set([...prev, idx]));
    // In production: save to Firestore with notification schedule
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 pb-24 lg:max-w-3xl lg:mx-auto">
      <div className="text-center lg:text-left space-y-1">
        <h2 className="text-xl lg:text-3xl font-bold text-gray-900">{t("scan.title")}</h2>
        <p className="text-sm text-gray-500">{t("scan.subtitle")}</p>
      </div>

      {/* Upload area */}
      {!preview ? (
        <div className="w-full border-2 border-dashed border-emerald-200 rounded-3xl flex flex-col items-center justify-center bg-emerald-50/50 gap-4 py-10 px-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
            <Camera size={32} className="text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 text-center">
            {lang === "bn" ? "প্রেসক্রিপশন বা টেস্ট রিপোর্ট আপলোড করুন" : "Upload prescription or test report"}
          </p>
          {/* Take photo with camera */}
          <label className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3.5 rounded-xl font-bold cursor-pointer shadow-lg shadow-emerald-200 active:scale-95 transition-all text-sm">
            <Camera size={16} />
            {lang === "bn" ? "ক্যামেরা দিয়ে তুলুন" : "Take Photo"}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
            />
          </label>
          {/* Choose from gallery / storage */}
          <label className="w-full flex items-center justify-center gap-2 bg-white border-2 border-emerald-200 text-emerald-700 py-3.5 rounded-xl font-bold cursor-pointer active:scale-95 transition-all text-sm">
            <FileText size={16} />
            {lang === "bn" ? "গ্যালারি থেকে বেছে নিন" : "Choose from Gallery"}
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
            />
          </label>
          <p className="text-[10px] text-gray-400 text-center">
            {lang === "bn" ? "JPG, PNG বা PDF সাপোর্টেড" : "JPG, PNG or PDF supported"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-lg aspect-[4/3] bg-black">
            <img src={preview} alt="Prescription" className="w-full h-full object-contain" />
            <button onClick={() => { setPreview(null); setResult(null); setError(null); }}
              className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full backdrop-blur-sm text-xs font-bold">✕</button>
            {result && (
              <div className={cn("absolute top-3 left-3 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1",
                result.confidence > 80 ? "bg-emerald-500 text-white" : result.confidence > 50 ? "bg-orange-400 text-white" : "bg-red-500 text-white")}>
                {result.confidence > 80 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {result.confidence}% {t("scan.result.match")}
              </div>
            )}
          </div>
          {!result && !isLoading && (
            <button onClick={handleUpload}
              className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all">
              <PlayCircle size={20} /> {t("scan.btn.extract")}
            </button>
          )}
          {isLoading && (
            <div className="w-full bg-emerald-50 border border-emerald-100 py-4 rounded-xl flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700">{t("scan.btn.analyze")}</p>
              <p className="text-xs text-emerald-500">{lang === "bn" ? "হাতের লেখা পড়া হচ্ছে..." : "Reading handwriting..."}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Doctor card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <FileText size={12} /> {t("scan.result.doctor_detected")}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-gray-900">{result.doctor?.name || (lang === "bn" ? "নাম পাওয়া যায়নি" : "Name not found")}</p>
                  {result.doctor?.specialization && <p className="text-xs text-gray-500 mt-0.5">{result.doctor.specialization}</p>}
                  {result.doctor?.hospital && <p className="text-xs text-gray-500">{result.doctor.hospital}</p>}
                  <div className="flex items-center gap-1.5 mt-2">
                    <ShieldCheck size={14} className={result.doctor?.bmdc && result.doctor.bmdc !== "Not visible on prescription" ? "text-emerald-500" : "text-gray-300"} />
                    <span className="text-xs text-gray-500 font-medium">BMDC: {result.doctor?.bmdc || (lang === "bn" ? "দেখা যাচ্ছে না" : "Not visible")}</span>
                  </div>
                </div>
                {result.doctor?.bmdc && result.doctor.bmdc !== "Not visible on prescription" && (
                  <div className="bg-emerald-50 px-3 py-2 rounded-xl text-center shrink-0">
                    <CheckCircle2 size={20} className="text-emerald-500 mx-auto" />
                    <p className="text-[9px] font-bold text-emerald-600 mt-1">{lang === "bn" ? "যাচাইযোগ্য" : "Verifiable"}</p>
                  </div>
                )}
              </div>
              {result.follow_up && (
                <div className="mt-3 bg-blue-50 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{lang === "bn" ? "ফলো-আপ" : "Follow-up"}</p>
                  <p className="text-xs text-blue-800 mt-0.5">{result.follow_up}</p>
                </div>
              )}
            </div>

            {/* Medicines */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t("scan.result.meds_title")} ({result.medicines?.length || 0})</p>
              {result.medicines?.map((med: any, i: number) => (
                <motion.div key={i} layout className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandedMed(expandedMed === i ? null : i)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <Pill size={20} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{med.name}</p>
                      <p className="text-xs text-gray-500">{med.dosage} · {med.frequency}</p>
                      <p className="text-xs font-medium text-emerald-700 mt-1">{lang === "bn" ? med.purpose_bangla : med.purpose_english}</p>
                    </div>
                    {expandedMed === i ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {expandedMed === i && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                          <div className="grid grid-cols-2 gap-2">
                            {med.duration && <div className="bg-gray-50 rounded-xl p-2.5"><p className="text-[10px] text-gray-400 font-bold uppercase">{lang === "bn" ? "সময়কাল" : "Duration"}</p><p className="text-xs font-medium text-gray-700 mt-0.5">{med.duration}</p></div>}
                            {med.frequency && <div className="bg-gray-50 rounded-xl p-2.5"><p className="text-[10px] text-gray-400 font-bold uppercase">{lang === "bn" ? "কতবার" : "Frequency"}</p><p className="text-xs font-medium text-gray-700 mt-0.5">{med.frequency}</p></div>}
                          </div>
                          {med.purpose_bangla && (
                            <div className="bg-emerald-50 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">{lang === "bn" ? "কেন খাবেন" : "Purpose"}</p>
                              <p className="text-xs text-emerald-800">{lang === "bn" ? med.purpose_bangla : med.purpose_english}</p>
                            </div>
                          )}
                          {med.warnings && (
                            <div className="bg-orange-50 rounded-xl p-3 flex gap-2">
                              <AlertCircle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-orange-800">{med.warnings}</p>
                            </div>
                          )}
                          <button onClick={() => handleSetReminder(i, med.name)}
                            disabled={reminderSet.has(i)}
                            className={cn("w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                              reminderSet.has(i) ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-900 text-white active:scale-95")}>
                            {reminderSet.has(i) ? <><CheckCircle2 size={14} /> {lang === "bn" ? "রিমাইন্ডার সেট হয়েছে" : "Reminder Set!"}</> : <><Bell size={14} /> {lang === "bn" ? "রিমাইন্ডার সেট করুন" : "Set Reminder"}</>}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Patient notes */}
            {result.patient_notes && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">{lang === "bn" ? "ডাক্তারের নির্দেশনা" : "Doctor's Notes"}</p>
                <p className="text-sm text-blue-800">{result.patient_notes}</p>
              </div>
            )}

            {/* Rate doctor CTA */}
            {result.doctor?.name && (
              <button onClick={() => setShowRatingModal(true)}
                className="w-full py-3 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center justify-center gap-2 bg-emerald-50 active:scale-95 transition-all">
                ⭐ {lang === "bn" ? "ডাক্তারকে রেটিং দিন" : "Rate This Doctor"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Doctor Rating Modal */}
      <AnimatePresence>
        {showRatingModal && result?.doctor && (
          <DoctorRatingModal
            doctor={result.doctor}
            lang={lang}
            user={user}
            onLoginRequired={onLoginRequired}
            onClose={() => setShowRatingModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DoctorRatingModal({ doctor, lang, user, onLoginRequired, onClose }: any) {
  const [ratings, setRatings] = useState({ explained: 0, respectful: 0, legible: 0, tests: 0 });
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const questions = [
    { key: "explained", en: "Explained diagnosis clearly", bn: "রোগ স্পষ্টভাবে বুঝিয়ে বলেছেন" },
    { key: "respectful", en: "Was respectful and listened", bn: "সম্মানজনক এবং মনোযোগী ছিলেন" },
    { key: "legible", en: "Prescription was easy to read", bn: "প্রেসক্রিপশন পড়তে সহজ ছিল" },
    { key: "tests", en: "Recommended appropriate care", bn: "সঠিক চিকিৎসার পরামর্শ দিয়েছেন" },
  ];

  const handleSubmit = async () => {
    if (!user) { onLoginRequired(); return; }
    if (Object.values(ratings).some(v => v === 0)) return;
    setSubmitting(true);
    try {
      await fetch("/api/rate-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bmdc: doctor.bmdc, doctorName: doctor.name, ratings, comment }),
      });
      setSubmitted(true);
    } catch { setSubmitted(true); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className="w-full max-w-md bg-white rounded-t-3xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{lang === "bn" ? "ধন্যবাদ!" : "Thank you!"}</h3>
            <p className="text-sm text-gray-500">{lang === "bn" ? "আপনার বেনামী রেটিং স্বাস্থ্যসেবা উন্নত করতে সাহায্য করবে।" : "Your anonymous rating helps improve healthcare quality."}</p>
            <button onClick={onClose} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{lang === "bn" ? "বন্ধ করুন" : "Close"}</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{lang === "bn" ? "ডাক্তারকে রেটিং দিন" : "Rate Your Doctor"}</h3>
                <p className="text-xs text-gray-400">{doctor.name} · {lang === "bn" ? "সম্পূর্ণ익명" : "Completely anonymous"}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 text-xl font-bold">✕</button>
            </div>
            <div className="space-y-4">
              {questions.map(q => (
                <div key={q.key}>
                  <p className="text-sm font-medium text-gray-700 mb-2">{lang === "bn" ? q.bn : q.en}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRatings(p => ({ ...p, [q.key]: star }))}
                        className={cn("w-10 h-10 rounded-xl text-lg transition-all", (ratings as any)[q.key] >= star ? "bg-amber-400 text-white scale-110" : "bg-gray-100 text-gray-300")}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{lang === "bn" ? "অতিরিক্ত মন্তব্য (ঐচ্ছিক)" : "Additional comment (optional)"}</p>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                  placeholder={lang === "bn" ? "আপনার অভিজ্ঞতা লিখুন..." : "Share your experience..."}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            <button onClick={handleSubmit} disabled={submitting || Object.values(ratings).some(v => v === 0)}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {lang === "bn" ? "বেনামে জমা দিন" : "Submit Anonymously"}
            </button>
            <p className="text-center text-[10px] text-gray-400">{lang === "bn" ? "আপনার পরিচয় কখনই প্রকাশ করা হবে না" : "Your identity will never be revealed"}</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
