import { useEffect } from "react";
import { ShieldCheck, AlertTriangle, FileText, Database, Phone, Stethoscope, Globe2, FileSignature, Clock } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { KEYS, useStore, seedExampleCertificationIfEmpty } from "../lib/store.ts";
import type { Certification } from "../lib/types.ts";

export function CompliancePage() {
  const { t, lang } = useLanguage();
  const certifications = useStore<Certification[]>(KEYS.CERTIFICATIONS_KEY, []);
  useEffect(() => { seedExampleCertificationIfEmpty(); }, []);
  const latest = [...certifications].sort((a, b) => (a.signedAt < b.signedAt ? 1 : -1))[0];
  const nextDue = latest ? new Date(latest.validUntil) : null;
  const isExpired = nextDue ? nextDue.getTime() < Date.now() : false;

  const limits = [t("compliance.limit.1"), t("compliance.limit.2"), t("compliance.limit.3"), t("compliance.limit.4")];
  const standards = [
    { icon: ShieldCheck, text: t("compliance.std.bmdc") },
    { icon: ShieldCheck, text: t("compliance.std.bmdc_code") },
    { icon: FileText, text: t("compliance.std.dghs") },
    { icon: Database, text: t("compliance.std.dsa") },
    { icon: Globe2, text: t("compliance.std.who") },
    { icon: Globe2, text: t("compliance.std.hipaa") },
  ];
  const data = [t("compliance.data.1"), t("compliance.data.2"), t("compliance.data.3")];

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-8 pb-24 lg:max-w-5xl lg:mx-auto">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-emerald-900 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
            <ShieldCheck size={12} /> Safety · Compliance · Trust
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">{t("compliance.title")}</h1>
          <p className="text-sm sm:text-base text-emerald-100/80 leading-relaxed">{t("compliance.intro")}</p>
        </div>
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <ShieldCheck size={200} />
        </div>
      </div>

      {/* Current certification banner */}
      {latest && (
        <section
          className={`rounded-3xl border-2 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center ${
            isExpired ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isExpired ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {isExpired ? <Clock size={28} /> : <FileSignature size={28} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isExpired ? "text-amber-700" : "text-emerald-700"}`}>
              {isExpired ? t("compliance.cert.expiredTag") : t("compliance.cert.currentTag")}
            </p>
            <p className="text-sm sm:text-base font-bold text-gray-900 mt-1">
              {t("compliance.cert.signedBy")} <strong>Dr. {latest.doctorName}</strong>, BMDC #{latest.doctorBmdc}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {latest.doctorSpecialty} · {t("compliance.cert.period")} {latest.periodMonth}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {t("compliance.cert.signedOn")} {new Date(latest.signedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")} ·{" "}
              {t("compliance.cert.validUntil")} {new Date(latest.validUntil).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}
            </p>
            <div className="flex gap-3 mt-2 text-[11px] font-bold">
              <span className="text-emerald-700">✓ {latest.sampleScores.accurate} {t("audit.rating.accurate").toLowerCase()}</span>
              <span className="text-amber-700">⚠ {latest.sampleScores.needs_revision} {t("audit.rating.needs_revision").toLowerCase()}</span>
              <span className="text-red-700">✗ {latest.sampleScores.unsafe} {t("audit.rating.unsafe").toLowerCase()}</span>
            </div>
            {latest.summaryNotes && (
              <p className="text-[11px] sm:text-xs text-gray-600 italic mt-2 leading-relaxed">{latest.summaryNotes}</p>
            )}
          </div>
        </section>
      )}
      {!latest && (
        <section className="rounded-3xl border-2 border-dashed border-gray-200 bg-white p-5 sm:p-6 text-center">
          <FileSignature size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-700">{t("compliance.cert.none.title")}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t("compliance.cert.none.body")}</p>
        </section>
      )}

      {/* AI limits */}
      <Section
        icon={<Stethoscope className="text-emerald-600" size={20} />}
        title={t("compliance.section.limits")}
        tone="emerald"
      >
        <ul className="space-y-3">
          {limits.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Standards */}
      <Section
        icon={<FileText className="text-blue-600" size={20} />}
        title={t("compliance.section.standards")}
        tone="blue"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {standards.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <Icon size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-gray-700 leading-snug">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Data handling */}
      <Section
        icon={<Database className="text-purple-600" size={20} />}
        title={t("compliance.section.data")}
        tone="purple"
      >
        <ul className="space-y-3">
          {data.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-purple-500 shrink-0" />
              <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Emergency numbers */}
      <Section
        icon={<Phone className="text-red-600" size={20} />}
        title={t("compliance.section.emergency")}
        tone="red"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: t("compliance.emergency.999"), num: "999" },
            { label: t("compliance.emergency.dghs"), num: "16263" },
            { label: t("compliance.emergency.suicide"), num: "9612119911" },
          ].map((e, i) => (
            <a
              key={i}
              href={`tel:${e.num}`}
              className="block p-4 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
            >
              <p className="text-xs font-bold text-red-700">{e.label}</p>
              <p className="text-lg font-black text-red-900 mt-1">{e.num}</p>
            </a>
          ))}
        </div>
      </Section>

      {/* Disclaimer */}
      <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
        <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-900 text-sm">{t("compliance.disclaimer.title")}</p>
          <p className="text-xs sm:text-sm text-amber-800 mt-1 leading-relaxed">
            {t("compliance.disclaimer.body")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "emerald" | "blue" | "purple" | "red";
  children: React.ReactNode;
}) {
  const toneRing: Record<string, string> = {
    emerald: "border-emerald-100",
    blue: "border-blue-100",
    purple: "border-purple-100",
    red: "border-red-100",
  };
  return (
    <section className={`bg-white border ${toneRing[tone]} rounded-3xl p-5 sm:p-6 shadow-sm`}>
      <header className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">{icon}</div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
      </header>
      {children}
    </section>
  );
}
