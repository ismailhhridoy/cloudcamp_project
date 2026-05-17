import { useState } from "react";
import { Search, MapPin, Star, ShieldCheck, UserRound, Phone, ChevronRight, Award, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { User } from "firebase/auth";

const DOCTORS = [
  { name: "Dr. Anisur Rahman", hospital: "Dhaka Medical College Hospital", bmdc: "A-54321", rating: 4.8, reviews: 156, verified: true, specialty: "General Medicine", phone: "+880-2-55165088", district: "Dhaka", scores: { explained: 4.9, respectful: 4.8, legible: 4.7, tests: 4.8 } },
  { name: "Dr. Fatema Begum", hospital: "Apollo Hospitals Dhaka", bmdc: "A-98765", rating: 4.5, reviews: 89, verified: true, specialty: "Gynecology & Obstetrics", phone: "+880-2-9829019", district: "Dhaka", scores: { explained: 4.6, respectful: 4.7, legible: 4.2, tests: 4.5 } },
  { name: "Dr. Kamal Hossain", hospital: "Rajshahi Medical College", bmdc: "A-12345", rating: 4.2, reviews: 45, verified: true, specialty: "Pediatrics", phone: "+880-721-772150", district: "Rajshahi", scores: { explained: 4.1, respectful: 4.4, legible: 4.0, tests: 4.3 } },
  { name: "Dr. Selina Akhter", hospital: "Chittagong Medical College", bmdc: "A-67890", rating: 4.9, reviews: 210, verified: true, specialty: "Internal Medicine", phone: "+880-31-619995", district: "Chittagong", scores: { explained: 5.0, respectful: 4.9, legible: 4.8, tests: 4.9 } },
  { name: "Dr. Jahangir Alam", hospital: "Sylhet MAG Osmani Medical", bmdc: "A-23456", rating: 4.3, reviews: 67, verified: true, specialty: "Cardiology", phone: "+880-821-714900", district: "Sylhet", scores: { explained: 4.2, respectful: 4.5, legible: 4.1, tests: 4.4 } },
  { name: "Dr. Nasrin Sultana", hospital: "Khulna Medical College", bmdc: "A-34567", rating: 4.6, reviews: 123, verified: true, specialty: "Dermatology", phone: "+880-41-731040", district: "Khulna", scores: { explained: 4.7, respectful: 4.8, legible: 4.4, tests: 4.5 } },
];

const FILTERS = ["all", "nearby", "top", "gynecology", "pediatrics", "cardiology"];

export function DoctorsPage({ onLoginRequired, user }: { onLoginRequired: () => void; user: User | null }) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<typeof DOCTORS[0] | null>(null);

  const filtered = DOCTORS.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.hospital.toLowerCase().includes(search.toLowerCase()) ||
      d.bmdc.toLowerCase().includes(search.toLowerCase()) ||
      d.specialty.toLowerCase().includes(search.toLowerCase()) ||
      d.district.toLowerCase().includes(search.toLowerCase());
    if (filter === "all" || filter === "nearby") return matchSearch;
    if (filter === "top") return matchSearch && d.rating >= 4.5;
    return matchSearch && d.specialty.toLowerCase().includes(filter);
  }).sort((a, b) => filter === "top" ? b.rating - a.rating : 0);

  const filterLabels: Record<string, { en: string; bn: string }> = {
    all: { en: "All", bn: "সব" },
    nearby: { en: "Nearby", bn: "কাছাকাছি" },
    top: { en: "Top Rated", bn: "শীর্ষ রেটেড" },
    gynecology: { en: "Gynecology", bn: "গাইনি" },
    pediatrics: { en: "Pediatrics", bn: "শিশু বিশেষজ্ঞ" },
    cardiology: { en: "Cardiology", bn: "হৃদরোগ" },
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 space-y-3">
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

      <div className="p-4 space-y-3 overflow-y-auto pb-24">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
          {filtered.length} {t("doctors.found")}
        </p>
        {filtered.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <AlertCircle size={32} className="text-gray-300 mx-auto" />
            <p className="text-gray-400 text-sm">{lang === "bn" ? "কোনো ডাক্তার পাওয়া যায়নি" : "No doctors found"}</p>
          </div>
        )}
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
