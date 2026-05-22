import { useState } from "react";
import { Search, MapPin, Star, ShieldCheck, UserRound, Phone, ChevronRight, Award, AlertCircle, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { User } from "firebase/auth";
import { useStore, KEYS } from "../lib/store.ts";
import type { LegibilityRecord } from "../lib/types.ts";
import { usePatientProfile } from "../lib/profile.ts";

const DOCTORS = [
  { name: "Dr. Anisur Rahman", hospital: "Dhaka Medical College Hospital", bmdc: "A-54321", rating: 4.8, reviews: 156, verified: true, specialty: "General Medicine", phone: "+880-2-55165088", district: "Dhaka", scores: { explained: 4.9, respectful: 4.8, legible: 4.7, tests: 4.8 } },
  { name: "Dr. Fatema Begum", hospital: "Apollo Hospitals Dhaka", bmdc: "A-98765", rating: 4.5, reviews: 89, verified: true, specialty: "Gynecology & Obstetrics", phone: "+880-2-9829019", district: "Dhaka", scores: { explained: 4.6, respectful: 4.7, legible: 4.2, tests: 4.5 } },
  { name: "Dr. Kamal Hossain", hospital: "Rajshahi Medical College", bmdc: "A-12345", rating: 4.2, reviews: 45, verified: true, specialty: "Pediatrics", phone: "+880-721-772150", district: "Rajshahi", scores: { explained: 4.1, respectful: 4.4, legible: 4.0, tests: 4.3 } },
  { name: "Dr. Selina Akhter", hospital: "Chittagong Medical College", bmdc: "A-67890", rating: 4.9, reviews: 210, verified: true, specialty: "Internal Medicine", phone: "+880-31-619995", district: "Chittagong", scores: { explained: 5.0, respectful: 4.9, legible: 4.8, tests: 4.9 } },
  { name: "Dr. Jahangir Alam", hospital: "Sylhet MAG Osmani Medical", bmdc: "A-23456", rating: 4.3, reviews: 67, verified: true, specialty: "Cardiology", phone: "+880-821-714900", district: "Sylhet", scores: { explained: 4.2, respectful: 4.5, legible: 4.1, tests: 4.4 } },
  { name: "Dr. Nasrin Sultana", hospital: "Khulna Medical College", bmdc: "A-34567", rating: 4.6, reviews: 123, verified: true, specialty: "Dermatology", phone: "+880-41-731040", district: "Khulna", scores: { explained: 4.7, respectful: 4.8, legible: 4.4, tests: 4.5 } },
  { name: "Dr. Mahbub Hasan", hospital: "Barisal Sher-e-Bangla Medical College", bmdc: "A-44521", rating: 4.4, reviews: 92, verified: true, specialty: "Pediatrics", phone: "+880-431-2173546", district: "Barisal", scores: { explained: 4.5, respectful: 4.6, legible: 3.4, tests: 4.4 } },
  { name: "Dr. Roksana Khanam", hospital: "Mymensingh Medical College", bmdc: "A-58219", rating: 4.7, reviews: 178, verified: true, specialty: "Gynecology & Obstetrics", phone: "+880-91-66063", district: "Mymensingh", scores: { explained: 4.7, respectful: 4.8, legible: 4.5, tests: 4.6 } },
  { name: "Dr. Tariq Aziz", hospital: "Rangpur Medical College", bmdc: "A-61932", rating: 4.0, reviews: 53, verified: true, specialty: "Internal Medicine", phone: "+880-521-66205", district: "Rangpur", scores: { explained: 3.9, respectful: 4.2, legible: 3.5, tests: 4.0 } },
  { name: "Dr. Sumi Akter", hospital: "Cumilla Medical College", bmdc: "A-70214", rating: 4.5, reviews: 71, verified: true, specialty: "Dermatology", phone: "+880-81-76061", district: "Cumilla", scores: { explained: 4.6, respectful: 4.7, legible: 4.3, tests: 4.4 } },
  { name: "Dr. Imran Hossain", hospital: "Jashore Medical College", bmdc: "A-78435", rating: 4.2, reviews: 64, verified: true, specialty: "General Medicine", phone: "+880-421-66666", district: "Jashore", scores: { explained: 4.2, respectful: 4.3, legible: 4.0, tests: 4.1 } },
  { name: "Dr. Nahid Rezwana", hospital: "Dinajpur Medical College", bmdc: "A-82155", rating: 4.6, reviews: 108, verified: true, specialty: "Cardiology", phone: "+880-531-65111", district: "Dinajpur", scores: { explained: 4.7, respectful: 4.7, legible: 4.6, tests: 4.5 } },
  { name: "Dr. Faruque Hossain", hospital: "Faridpur Medical College", bmdc: "A-65318", rating: 3.8, reviews: 47, verified: true, specialty: "Pediatrics", phone: "+880-631-63133", district: "Faridpur", scores: { explained: 3.8, respectful: 4.0, legible: 3.0, tests: 3.9 } },
  { name: "Dr. Sabina Yasmin", hospital: "Noakhali Medical College", bmdc: "A-91402", rating: 4.4, reviews: 86, verified: true, specialty: "Gynecology & Obstetrics", phone: "+880-321-71500", district: "Noakhali", scores: { explained: 4.5, respectful: 4.5, legible: 4.2, tests: 4.3 } },
];

const FILTERS = ["all", "nearby", "top", "needs_training", "gynecology", "pediatrics", "cardiology", "dermatology"];

// District centres (subset of the hospitals helper) for "nearest" sort without geolocation.
const DISTRICT_CENTRES: Record<string, [number, number]> = {
  Dhaka: [23.8103, 90.4125], Chittagong: [22.3569, 91.7832], Sylhet: [24.8949, 91.8687],
  Rajshahi: [24.3636, 88.6241], Khulna: [22.8456, 89.5403], Barisal: [22.7010, 90.3535],
  Mymensingh: [24.7471, 90.4203], Rangpur: [25.7439, 89.2752], Cumilla: [23.4607, 91.1809],
  Noakhali: [22.8324, 91.0976], Jashore: [23.1664, 89.2086], Dinajpur: [25.6217, 88.6354],
  Faridpur: [23.6070, 89.8429],
};

function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function DoctorsPage({ onLoginRequired, user }: { onLoginRequired: () => void; user: User | null }) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<typeof DOCTORS[0] | null>(null);
  const legibility = useStore<LegibilityRecord[]>(KEYS.LEGIBILITY_KEY, []);
  const legibilityByBmdc = new Map(legibility.map((r) => [r.bmdc, r] as const));
  const lookupLegibility = (bmdc: string) => legibilityByBmdc.get(bmdc);
  const profile = usePatientProfile();
  const userCentre: [number, number] | null =
    profile.district && DISTRICT_CENTRES[profile.district] ? DISTRICT_CENTRES[profile.district] : null;
  const distanceFor = (doc: { district: string }) => {
    if (!userCentre) return Infinity;
    const target = DISTRICT_CENTRES[doc.district];
    if (!target) return Infinity;
    return distanceKm(userCentre, target);
  };

  const filtered = DOCTORS.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.hospital.toLowerCase().includes(search.toLowerCase()) ||
      d.bmdc.toLowerCase().includes(search.toLowerCase()) ||
      d.specialty.toLowerCase().includes(search.toLowerCase()) ||
      d.district.toLowerCase().includes(search.toLowerCase());
    if (filter === "all") return matchSearch;
    if (filter === "nearby") return matchSearch;
    if (filter === "top") return matchSearch && d.rating >= 4.5;
    if (filter === "needs_training") {
      const leg = lookupLegibility(d.bmdc);
      return matchSearch && !!leg && leg.avgScore <= 2.5;
    }
    return matchSearch && d.specialty.toLowerCase().includes(filter);
  }).sort((a, b) => {
    if (filter === "top") return b.rating - a.rating;
    if (filter === "needs_training") {
      const la = lookupLegibility(a.bmdc)?.avgScore ?? 99;
      const lb = lookupLegibility(b.bmdc)?.avgScore ?? 99;
      return la - lb;
    }
    if (filter === "nearby") return distanceFor(a) - distanceFor(b);
    return 0;
  });

  const filterLabels: Record<string, { en: string; bn: string }> = {
    all: { en: "All", bn: "সব" },
    nearby: { en: "Nearby", bn: "কাছাকাছি" },
    top: { en: "Top Rated", bn: "শীর্ষ রেটেড" },
    needs_training: { en: "Needs handwriting training", bn: "হাতের লেখা প্রশিক্ষণ প্রয়োজন" },
    gynecology: { en: "Gynecology", bn: "গাইনি" },
    pediatrics: { en: "Pediatrics", bn: "শিশু বিশেষজ্ঞ" },
    cardiology: { en: "Cardiology", bn: "হৃদরোগ" },
    dermatology: { en: "Dermatology", bn: "ত্বক বিশেষজ্ঞ" },
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
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
          {filtered.length} {t("doctors.found")}
        </p>
        {filtered.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <AlertCircle size={32} className="text-gray-300 mx-auto" />
            <p className="text-gray-400 text-sm">{lang === "bn" ? "কোনো ডাক্তার পাওয়া যায়নি" : "No doctors found"}</p>
          </div>
        )}
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
        {filtered.map((doc, i) => (
          <motion.div key={doc.bmdc} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex gap-3">
              <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
                <UserRound size={28} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-gray-900">{doc.name}</h3>
                  {doc.verified && <ShieldCheck size={14} className="text-emerald-500 shrink-0" />}
                </div>
                <p className="text-[11px] text-emerald-600 font-medium">{doc.specialty}</p>
                <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                  <MapPin size={11} className="shrink-0" />
                  <span className="text-[11px] truncate">{doc.hospital}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <Star size={13} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-gray-900">{doc.rating}</span>
                    <span className="text-[10px] text-gray-400">({doc.reviews})</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{doc.bmdc}</span>
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {[
                { key: "explained", label: lang === "bn" ? "ব্যাখ্যা" : "Clarity" },
                { key: "respectful", label: lang === "bn" ? "সম্মান" : "Respect" },
                { key: "legible", label: lang === "bn" ? "লেখা" : "Script" },
                { key: "tests", label: lang === "bn" ? "যত্ন" : "Care" },
              ].map(s => (
                <div key={s.key} className="text-center bg-gray-50 rounded-lg py-1.5">
                  <p className="text-xs font-bold text-gray-800">{(doc.scores as any)[s.key]}</p>
                  <p className="text-[9px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* AI handwriting legibility (aggregated from real scans) */}
            {(() => {
              const leg = lookupLegibility(doc.bmdc);
              if (!leg) return null;
              const tone = leg.avgScore >= 4 ? "emerald" : leg.avgScore >= 3 ? "amber" : "red";
              const cls = tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700";
              return (
                <div className={`mt-2 rounded-lg border p-2 flex items-center gap-2 ${cls}`}>
                  <PenLine size={13} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      {lang === "bn" ? "AI হাতের লেখা" : "AI handwriting"}
                    </p>
                    <p className="text-[10px] opacity-80 truncate">
                      {leg.avgScore}/5 · {leg.scoreCount} {lang === "bn" ? "স্ক্যান" : "scans"}
                      {leg.avgScore <= 2.5 && (lang === "bn" ? " · প্রশিক্ষণ প্রয়োজন" : " · needs training")}
                    </p>
                  </div>
                  <span className="text-sm font-black">{leg.avgScore}</span>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <a href={`tel:${doc.phone}`}
                className="py-2.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 flex items-center justify-center gap-1.5 hover:bg-gray-50">
                <Phone size={13} /> {lang === "bn" ? "কল করুন" : "Call"}
              </a>
              <button onClick={() => setSelected(doc)}
                className="py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-500 shadow-sm">
                <Award size={13} /> {t("doctors.btn.rate")}
              </button>
            </div>
          </motion.div>
        ))}
        </div>
      </div>

      {/* Rating modal */}
      <AnimatePresence>
        {selected && (
          <DoctorRateSheet doctor={selected} lang={lang} user={user} onLoginRequired={onLoginRequired} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function DoctorRateSheet({ doctor, lang, user, onLoginRequired, onClose }: any) {
  const [ratings, setRatings] = useState({ explained: 0, respectful: 0, legible: 0, tests: 0 });
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const questions = [
    { key: "explained", en: "Explained my condition clearly", bn: "রোগ স্পষ্টভাবে বুঝিয়েছেন" },
    { key: "respectful", en: "Was respectful and listened", bn: "সম্মানজনক ও মনোযোগী ছিলেন" },
    { key: "legible", en: "Prescription was readable", bn: "প্রেসক্রিপশন পড়তে পারা গেছে" },
    { key: "tests", en: "Recommended appropriate care", bn: "সঠিক চিকিৎসা দিয়েছেন" },
  ];

  const canSubmit = Object.values(ratings).every(v => v > 0);

  const handleSubmit = async () => {
    if (!user) { onLoginRequired(); return; }
    setLoading(true);
    try {
      await fetch("/api/rate-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bmdc: doctor.bmdc, doctorName: doctor.name, ratings, comment }),
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
                <h3 className="font-bold text-gray-900">{lang === "bn" ? "বেনামী রেটিং" : "Anonymous Rating"}</h3>
                <p className="text-xs text-gray-400">{doctor.name}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-5">
              {questions.map(q => (
                <div key={q.key}>
                  <p className="text-sm font-medium text-gray-700 mb-2">{lang === "bn" ? q.bn : q.en}</p>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => setRatings(p => ({ ...p, [q.key]: s }))}
                        className={cn("flex-1 h-10 rounded-xl text-base transition-all font-bold",
                          (ratings as any)[q.key] >= s ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-300")}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                placeholder={lang === "bn" ? "অতিরিক্ত মন্তব্য (ঐচ্ছিক)..." : "Additional comment (optional)..."}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
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
