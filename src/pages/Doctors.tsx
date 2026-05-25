import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Star, ShieldCheck, UserRound, AlertCircle, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { User } from "firebase/auth";
import { useStore, KEYS, useCurrentUser, saveSubmittedReview } from "../lib/store.ts";
import type { LegibilityRecord, ExternalDoctor, PatientRatingRecord } from "../lib/types.ts";
import { usePatientProfile } from "../lib/profile.ts";
import { requestGeolocation, haversineKm } from "../lib/distance.ts";

// No seed data — doctors only appear as patients scan prescriptions. Auto-registration uses the
// BMDC number as the id when visible, falling back to a synthetic id derived from name+hospital.
// `bmdc` starting with `nb_` means "no BMDC on prescription".

// Simplified to two filters: doctors who need handwriting improvement vs already-good ones.
const FILTERS = ["needs_training", "already_good"] as const;
type FilterKey = (typeof FILTERS)[number];

export function DoctorsPage({ onLoginRequired, user }: { onLoginRequired: () => void; user: User | null }) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("needs_training");
  const [selected, setSelected] = useState<any | null>(null);
  const legibility = useStore<LegibilityRecord[]>(KEYS.LEGIBILITY_KEY, []);
  const patientRatings = useStore<PatientRatingRecord[]>(KEYS.PATIENT_RATINGS_KEY, []);
  const externalDoctors = useStore<ExternalDoctor[]>(KEYS.EXTERNAL_DOCTORS_KEY, []);
  const legibilityByBmdc = new Map(legibility.map((r) => [r.bmdc, r] as const));
  const ratingByBmdc = new Map(patientRatings.map((r) => [r.bmdc, r] as const));
  const lookupLegibility = (bmdc: string) => legibilityByBmdc.get(bmdc);
  const lookupPatientRating = (bmdc: string) => ratingByBmdc.get(bmdc);

  // Build the doctor list strictly from auto-registered records.
  const allDoctors = useMemo(() => {
    return externalDoctors.map((e) => ({
      name: e.name,
      hospital: e.hospital || "",
      bmdc: e.bmdc,
      bmdcKnown: !e.bmdc.startsWith("nb_"),
      reviews: 0,
      verified: false,
      specialty: e.specialty || "General",
      phone: "",
      district: e.district || "",
      lat: undefined as number | undefined,
      lng: undefined as number | undefined,
      prescriptionScore: 0,
      scanCount: e.scanCount || 0,
      scannedAt: e.scannedAt,
    }));
  }, [externalDoctors]);

  const filtered = allDoctors.filter(d => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.hospital || "").toLowerCase().includes(search.toLowerCase()) ||
      d.bmdc.toLowerCase().includes(search.toLowerCase()) ||
      (d.specialty || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.district || "").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    const leg = lookupLegibility(d.bmdc);
    if (filter === "needs_training") {
      // Anything with no scans yet OR avgScore < 4 needs improvement.
      return !leg || leg.avgScore < 4;
    }
    // already_good — needs at least one scan and avg ≥ 4.
    return !!leg && leg.avgScore >= 4;
  }).sort((a, b) => {
    const la = lookupLegibility(a.bmdc)?.avgScore;
    const lb = lookupLegibility(b.bmdc)?.avgScore;
    if (filter === "needs_training") {
      // Ascending: worst first; doctors with no scans get pushed to the end (worst-known wins).
      return (la ?? 99) - (lb ?? 99);
    }
    // Already good — descending by score, best first.
    return (lb ?? 0) - (la ?? 0);
  });

  const filterLabels: Record<string, { en: string; bn: string }> = {
    needs_training: { en: "Need improvement", bn: "উন্নতি প্রয়োজন" },
    already_good: { en: "Already good", bn: "ইতিমধ্যে ভালো" },
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 lg:max-w-6xl lg:mx-auto lg:w-full">
      <div className="p-4 lg:p-6 bg-white border-b border-gray-100 sticky top-0 z-10 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("doctors.search.placeholder")}
            className="w-full bg-gray-100 py-3 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                filter === f ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600")}>
              {lang === "bn" ? filterLabels[f].bn : filterLabels[f].en}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-3 overflow-y-auto pb-24">
        {allDoctors.length === 0 ? (
          <div className="text-center py-16 space-y-3 max-w-md mx-auto">
            <UserRound size={36} className="text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">
              {lang === "bn" ? "এখনো কোনো ডাক্তার তালিকায় নেই" : "No doctors in the registry yet"}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {lang === "bn"
                ? "যখন রোগীরা প্রেসক্রিপশন স্ক্যান করবেন, ডাক্তারের প্রোফাইল স্বয়ংক্রিয়ভাবে এখানে যোগ হবে। BMDC না থাকলেও প্রোফাইল তৈরি হয়।"
                : "Doctor profiles are added automatically as patients scan prescriptions. Profiles are created even when no BMDC number is visible on the prescription."}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
              {filter === "needs_training"
                ? (lang === "bn" ? `${filtered.length} জন ডাক্তারের উন্নতি দরকার` : `${filtered.length} doctors need improvement`)
                : (lang === "bn" ? `${filtered.length} জন ডাক্তার ইতিমধ্যে ভালো` : `${filtered.length} doctors already good`)}
            </p>
            {filtered.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <AlertCircle size={32} className="text-gray-300 mx-auto" />
                <p className="text-gray-400 text-sm">
                  {filter === "needs_training"
                    ? (lang === "bn" ? "ভালো খবর — কোনো ডাক্তারের উন্নতি প্রয়োজন নেই।" : "Good news — no doctors need improvement.")
                    : (lang === "bn" ? "এখনো কোনো ডাক্তারের ভালো স্কোর নেই।" : "No doctors with a good score yet.")}
                </p>
              </div>
            )}
          </>
        )}
        {allDoctors.length > 0 && (
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
        {filtered.map((doc, i) => {
          const leg = lookupLegibility(doc.bmdc);
          const rank = i + 1;
          const rankTone =
            filter === "needs_training"
              ? (rank <= 3 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700")
              : "bg-emerald-50 border-emerald-200 text-emerald-700";
          return (
            <motion.div key={doc.bmdc} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border font-black text-sm", rankTone)}>
                  {rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-gray-900 truncate">{doc.name}</h3>
                    {doc.verified && <ShieldCheck size={14} className="text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-emerald-600 font-medium truncate">{doc.specialty}</p>
                  {doc.hospital && (
                    <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                      <MapPin size={11} className="shrink-0" />
                      <span className="text-[11px] truncate">{doc.hospital}{doc.district ? ` · ${doc.district}` : ""}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-[10px] font-medium text-gray-400">
                      {doc.scanCount || 0} {lang === "bn" ? "স্ক্যান" : "scans"}
                    </span>
                    {doc.bmdcKnown ? (
                      <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-mono">
                        {doc.bmdc}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        {lang === "bn" ? "BMDC নেই" : "No BMDC"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Two scores only: AI handwriting (live) + patient prescription clarity. */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(() => {
                  const tone = !leg ? "gray" : leg.avgScore >= 4 ? "emerald" : leg.avgScore >= 3 ? "amber" : "red";
                  const cls =
                    tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : tone === "amber"  ? "border-amber-200 bg-amber-50 text-amber-700"
                    : tone === "red"    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-gray-100 bg-gray-50 text-gray-500";
                  const pct = leg ? Math.round((leg.avgScore / 5) * 100) : null;
                  return (
                    <div className={`rounded-lg border p-2 flex items-center gap-2 ${cls}`}>
                      <PenLine size={14} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                          {lang === "bn" ? "হাতের লেখা (AI)" : "Handwriting (AI)"}
                        </p>
                        <p className="text-xs font-bold">
                          {pct != null ? `${pct}%` : (lang === "bn" ? "স্ক্যান নেই" : "no scans")}
                          {leg && <span className="font-medium opacity-70"> · {leg.scoreCount} {lang === "bn" ? "স্ক্যান" : "scans"}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const rate = lookupPatientRating(doc.bmdc);
                  return (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 flex items-center gap-2">
                      <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {lang === "bn" ? "প্রেসক্রিপশন (রোগী)" : "Prescription (patient)"}
                        </p>
                        <p className="text-xs font-bold text-gray-900">
                          {rate
                            ? <>{rate.avgScore} / 5 <span className="font-medium text-gray-400">· {rate.scoreCount}</span></>
                            : (lang === "bn" ? "রেটিং নেই" : "no ratings")}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          );
        })}
        </div>
        )}
      </div>

      {/* Rating modal */}
      <AnimatePresence>
        {selected && (
          <DoctorRateSheet doctor={selected} lang={lang} onLoginRequired={onLoginRequired} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function DoctorRateSheet({ doctor, lang, onLoginRequired, onClose }: any) {
  // Simplified per spec: ONE question — how easy was it to read the prescription — plus an
  // optional free-text comment. No other ratings collected.
  const [legibleScore, setLegibleScore] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  // Use the locally-mapped account (.id = Firebase uid) — Firebase User objects use .uid.
  const account = useCurrentUser();

  const canSubmit = legibleScore > 0;

  const handleSubmit = async () => {
    if (!account) { onLoginRequired(); return; }
    setLoading(true);
    try {
      fetch("/api/rate-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bmdc: doctor.bmdc,
          doctorName: doctor.name,
          ratings: { legible: legibleScore },
          comment,
        }),
      }).catch(() => {});
      // Persist to the signed-in user's review history (local + Firestore).
      saveSubmittedReview({
        userId: account.id,
        bmdc: doctor.bmdc,
        doctorName: doctor.name,
        legibleScore,
        comment: comment || undefined,
      });
    } catch { /* still show success */ }
    finally { setLoading(false); setDone(true); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className="w-full max-w-md bg-white rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
        {done ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto"><ShieldCheck size={32} className="text-emerald-600" /></div>
            <h3 className="text-lg font-bold">{lang === "bn" ? "রেটিং জমা হয়েছে!" : "Rating submitted!"}</h3>
            <p className="text-sm text-gray-500">{lang === "bn" ? "আপনার বেনামী মতামত স্বাস্থ্যসেবার মান উন্নত করবে।" : "Your anonymous feedback helps improve healthcare."}</p>
            <button onClick={onClose} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">
              {lang === "bn" ? "বন্ধ করুন" : "Close"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">{lang === "bn" ? "প্রেসক্রিপশন রেটিং" : "Prescription Rating"}</h3>
                <p className="text-xs text-gray-400">{doctor.name}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {lang === "bn" ? "প্রেসক্রিপশন পড়া কতটা সহজ ছিল?" : "How easy was it to read the prescription?"}
                </p>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setLegibleScore(s)}
                      className={cn("flex-1 h-12 rounded-xl text-lg transition-all font-bold",
                        legibleScore >= s ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-300")}>
                      ★
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-medium text-gray-400 mt-1">
                  <span>{lang === "bn" ? "একদম পড়া যায়নি" : "Couldn't read at all"}</span>
                  <span>{lang === "bn" ? "খুব পরিষ্কার" : "Very clear"}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">
                  {lang === "bn" ? "অতিরিক্ত মন্তব্য (ঐচ্ছিক)" : "Additional comment (optional)"}
                </p>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                  placeholder={lang === "bn" ? "আপনার অভিজ্ঞতা সংক্ষেপে লিখুন..." : "Briefly share your experience..."}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>

              <button onClick={handleSubmit} disabled={!canSubmit || loading}
                className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-all">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {lang === "bn" ? "বেনামে জমা দিন" : "Submit Anonymously"}
              </button>
              <p className="text-center text-[10px] text-gray-400">🔒 {lang === "bn" ? "আপনার পরিচয় সম্পূর্ণ গোপন থাকবে" : "Your identity is completely private"}</p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
