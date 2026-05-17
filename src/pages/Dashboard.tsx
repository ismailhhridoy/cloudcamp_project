import { useState } from "react";
import { AlertCircle, TrendingUp, Users, Map as MapIcon, Layers, Activity, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";

const DISEASE_DATA = [
  { district: "Dhaka", disease: "Dengue", cases: 847, trend: "+12%", severity: "high", lat: 23.8103, lng: 90.4125, color: "#ea580c" },
  { district: "Chittagong", disease: "Typhoid", cases: 312, trend: "+5%", severity: "medium", lat: 22.3569, lng: 91.7832, color: "#d97706" },
  { district: "Sylhet", disease: "Waterborne", cases: 198, trend: "+18%", severity: "high", lat: 24.8949, lng: 91.8687, color: "#2563eb" },
  { district: "Rajshahi", disease: "Flu", cases: 156, trend: "-3%", severity: "low", lat: 24.3636, lng: 88.6241, color: "#16a34a" },
  { district: "Khulna", disease: "Diarrhea", cases: 423, trend: "+8%", severity: "medium", lat: 22.8456, lng: 89.5403, color: "#7c3aed" },
  { district: "Barisal", disease: "Malaria", cases: 87, trend: "-2%", severity: "low", lat: 22.7010, lng: 90.3535, color: "#0891b2" },
  { district: "Mymensingh", disease: "Pneumonia", cases: 234, trend: "+3%", severity: "medium", lat: 24.7471, lng: 90.4203, color: "#be185d" },
  { district: "Rangpur", disease: "Flu", cases: 145, trend: "+1%", severity: "low", lat: 25.7439, lng: 89.2752, color: "#16a34a" },
];

const DOCTOR_SCORES = [
  { district: "Chittagong", score: 4.9, doctors: 312, legibility: "Excellent" },
  { district: "Dhaka", score: 4.5, doctors: 1240, legibility: "Good" },
  { district: "Khulna", score: 4.3, doctors: 189, legibility: "Good" },
  { district: "Sylhet", score: 4.1, doctors: 156, legibility: "Needs Improvement" },
  { district: "Rajshahi", score: 3.9, doctors: 201, legibility: "Needs Training" },
];

export function DashboardPage() {
  const { lang } = useLanguage();
  const [activeView, setActiveView] = useState<"disease" | "doctors">("disease");
  const [view, setView] = useState<"list" | "map">("list");

  const totalCases = DISEASE_DATA.reduce((a, b) => a + b.cases, 0);
  const highSeverity = DISEASE_DATA.filter(d => d.severity === "high").length;

  return (
    <div className="flex flex-col bg-gray-50 pb-24">

      {/* Ministry header */}
      <div className="bg-emerald-900 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Shield size={22} className="text-emerald-300" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">{lang === "bn" ? "স্বাস্থ্য মন্ত্রণালয় ড্যাশবোর্ড" : "Ministry of Health Dashboard"}</p>
            <p className="text-white font-bold text-sm">{lang === "bn" ? "জনস্বাস্থ্য পর্যবেক্ষণ" : "Public Health Surveillance"}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: lang === "bn" ? "মোট রিপোর্ট" : "Total Reports", value: totalCases.toLocaleString(), icon: Activity, color: "text-emerald-300" },
            { label: lang === "bn" ? "উচ্চ ঝুঁকি" : "High Risk Areas", value: highSeverity, icon: AlertCircle, color: "text-orange-300" },
            { label: lang === "bn" ? "স্বাস্থ্যকর্মী" : "Health Workers", value: "13k+", icon: Users, color: "text-blue-300" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
                <Icon size={18} className={cn("mx-auto mb-1", s.color)} />
                <p className="text-lg font-black text-white">{s.value}</p>
                <p className="text-[9px] text-white/60 font-medium leading-tight">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toggle tabs */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-gray-100">
          <button onClick={() => setActiveView("disease")}
            className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeView === "disease" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500")}>
            {lang === "bn" ? "রোগ বিস্তার" : "Disease Map"}
          </button>
          <button onClick={() => setActiveView("doctors")}
            className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeView === "doctors" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500")}>
            {lang === "bn" ? "ডাক্তার মান" : "Doctor Quality"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {activeView === "disease" ? (
          <>
            {/* Alert banner */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3">
              <AlertCircle size={18} className="text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-orange-800">{lang === "bn" ? "সক্রিয় সতর্কতা" : "Active Alert"}</p>
                <p className="text-xs text-orange-700 mt-0.5">{lang === "bn" ? "ঢাকা ও সিলেটে ডেঙ্গু ও পানিবাহিত রোগের প্রকোপ বাড়ছে।" : "Dengue and waterborne diseases rising in Dhaka and Sylhet districts."}</p>
              </div>
            </div>

            {/* List/map toggle */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === "bn" ? "জেলা অনুযায়ী রিপোর্ট" : "Reports by District"}</p>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setView("list")} className={cn("p-1.5 rounded-md transition-all", view === "list" ? "bg-white shadow-sm text-emerald-600" : "text-gray-400")}><Layers size={14} /></button>
                <button onClick={() => setView("map")} className={cn("p-1.5 rounded-md transition-all", view === "map" ? "bg-white shadow-sm text-emerald-600" : "text-gray-400")}><MapIcon size={14} /></button>
              </div>
            </div>

            {view === "map" ? (
              <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <div className="relative bg-emerald-50 h-64 flex items-center justify-center">
                  {/* SVG Bangladesh map placeholder with pins */}
                  <svg viewBox="0 0 300 320" className="w-full h-full p-4">
                    <ellipse cx="150" cy="160" rx="90" ry="120" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="2" />
                    {DISEASE_DATA.map((d, i) => {
                      const x = ((d.lng - 88) / (93 - 88)) * 200 + 50;
                      const y = ((26 - d.lat) / (26 - 21)) * 240 + 40;
                      const r = d.severity === "high" ? 14 : d.severity === "medium" ? 10 : 7;
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r={r} fill={d.color} opacity={0.85} />
                          <text x={x} y={y + 4} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
                            {d.cases > 100 ? Math.round(d.cases / 100) + "h" : d.cases}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    {["high", "medium", "low"].map(s => (
                      <div key={s} className="flex items-center gap-1 bg-white rounded-full px-2 py-0.5 shadow-sm">
                        <div className={cn("w-2 h-2 rounded-full", s === "high" ? "bg-red-500" : s === "medium" ? "bg-orange-400" : "bg-green-500")} />
                        <span className="text-[9px] font-bold text-gray-600 capitalize">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {DISEASE_DATA.sort((a, b) => b.cases - a.cases).map((d, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">{d.district}</p>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                          d.severity === "high" ? "bg-red-100 text-red-600" : d.severity === "medium" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600")}>
                          {d.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{d.disease}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 mr-2">
                          <div className="h-1.5 rounded-full" style={{ width: `${(d.cases / 847) * 100}%`, backgroundColor: d.color }} />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-gray-700">{d.cases.toLocaleString()}</span>
                          <span className={cn("text-[10px] font-bold", d.trend.startsWith("+") ? "text-red-500" : "text-green-500")}>{d.trend}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === "bn" ? "জেলা অনুযায়ী ডাক্তারের মান" : "Doctor Quality by District"}</p>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-800">{lang === "bn" ? "প্রশিক্ষণের সুপারিশ" : "Training Recommendation"}</p>
              <p className="text-xs text-blue-700 mt-1">{lang === "bn" ? "রাজশাহী ও সিলেটে প্রেসক্রিপশনের মান উন্নয়নের জন্য প্রশিক্ষণ প্রয়োজন।" : "Rajshahi and Sylhet need prescription legibility training based on patient reports."}</p>
            </div>
            <div className="space-y-2">
              {DOCTOR_SCORES.map((d, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-gray-900">{d.district}</p>
                      <p className="text-xs text-gray-400">{d.doctors} {lang === "bn" ? "ডাক্তার নিবন্ধিত" : "doctors registered"}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-amber-400 text-sm">★</span>
                        <span className="font-bold text-gray-900">{d.score}</span>
                      </div>
                      <p className={cn("text-[10px] font-bold", d.legibility === "Excellent" ? "text-emerald-600" : d.legibility === "Good" ? "text-blue-600" : "text-orange-600")}>
                        {d.legibility}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${(d.score / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-900 rounded-2xl p-4 text-white">
              <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-2">{lang === "bn" ? "মন্ত্রণালয়ে পাঠানো হবে" : "Sent to Ministry"}</p>
              <p className="text-sm">{lang === "bn" ? "এই ডেটা স্বাস্থ্য অধিদপ্তরে প্রতি সপ্তাহে বেনামীভাবে পাঠানো হয়।" : "This anonymized data is sent to DGHS weekly to improve doctor training programs."}</p>
              <div className="flex items-center gap-1 mt-3 text-emerald-300">
                <span className="text-xs font-bold">{lang === "bn" ? "আরও জানুন" : "Learn more"}</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
