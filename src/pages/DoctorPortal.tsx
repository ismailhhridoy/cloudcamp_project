import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  Upload,
  Edit3,
  MessageSquare,
  Camera,
  AlertTriangle,
  FileSignature,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { useLanguage } from "../lib/LanguageContext.tsx";
import {
  KEYS,
  useStore,
  upsertDoctor,
  setDoctorSession,
  listDoctors,
  seedDemoDoctorIfEmpty,
  seedAuditSamplesIfEmpty,
  seedExampleCertificationIfEmpty,
  updateAuditSample,
  addCertification,
  resetAuditRatings,
} from "../lib/store.ts";
import type {
  DoctorProfile,
  AuditSample,
  AuditRating,
  Certification,
} from "../lib/types.ts";

export function DoctorPortal() {
  const { t, lang } = useLanguage();
  const doctors = useStore<DoctorProfile[]>(KEYS.DOCTORS_KEY, []);
  const sessionId = useStore<string | null>(KEYS.DOCTOR_SESSION_KEY, null);

  useEffect(() => {
    seedDemoDoctorIfEmpty();
    seedAuditSamplesIfEmpty();
    seedExampleCertificationIfEmpty();
  }, []);

  const currentDoctor = doctors.find((d) => d.id === sessionId);

  if (!currentDoctor) return <PortalLanding lang={lang} t={t} />;
  if (currentDoctor.approvalStatus === "pending_admin") return <PendingApproval doctor={currentDoctor} lang={lang} t={t} />;
  if (currentDoctor.approvalStatus === "rejected") return <Rejected doctor={currentDoctor} t={t} />;
  return <AuditPanel doctor={currentDoctor} lang={lang} t={t} />;
}

// ───── Landing / sign-in ─────────────────────────────────────────────────────
function PortalLanding({ lang, t }: { lang: string; t: (k: string) => string }) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  const signInDemo = () => {
    const demo = listDoctors().find((d) => d.id === "doc_demo_seed");
    if (demo) setDoctorSession(demo.id);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:max-w-3xl lg:mx-auto space-y-6">
      <header className="bg-gradient-to-br from-emerald-900 to-emerald-700 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
            <Stethoscope size={12} /> {t("portal.tag")}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">{t("portal.title")}</h1>
          <p className="text-sm text-emerald-100/80 leading-relaxed">{t("portal.intro")}</p>
        </div>
        <ShieldCheck size={180} className="absolute -right-6 -bottom-6 opacity-10" />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={signInDemo}
          className="bg-white border border-gray-100 rounded-2xl p-5 text-left shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Stethoscope size={22} />
          </div>
          <p className="font-bold text-gray-900">{t("portal.demo.title")}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t("portal.demo.sub")}</p>
          <p className="text-[10px] font-bold text-emerald-600 mt-3 uppercase tracking-wider">{t("portal.demo.cta")} →</p>
        </button>

        <button
          onClick={() => setShowOnboarding(true)}
          className="bg-white border border-gray-100 rounded-2xl p-5 text-left shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Upload size={22} />
          </div>
          <p className="font-bold text-gray-900">{t("portal.onboard.title")}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t("portal.onboard.sub")}</p>
          <p className="text-[10px] font-bold text-blue-600 mt-3 uppercase tracking-wider">{t("portal.onboard.cta")} →</p>
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-sm text-amber-900">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{t("portal.notice")}</p>
      </div>

      <AnimatePresence>{showOnboarding && <OnboardingForm onClose={() => setShowOnboarding(false)} t={t} lang={lang} />}</AnimatePresence>
    </div>
  );
}

// ───── Onboarding form ──────────────────────────────────────────────────────
function OnboardingForm({ onClose, t }: { onClose: () => void; t: (k: string) => string; lang: string }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    bmdcNumber: "",
    specialty: "",
    qualification: "MBBS",
    hospital: "",
    district: "",
    yearsExperience: 0,
    hasUploadedLicense: false,
  });
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!form.fullName.trim() || !form.bmdcNumber.trim() || !form.specialty.trim()) {
      setError(t("portal.form.error.required"));
      return;
    }
    if (!form.hasUploadedLicense) {
      setError(t("portal.form.error.license"));
      return;
    }
    const id = `doc_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    const doc: DoctorProfile = {
      id,
      fullName: form.fullName.trim(),
      email: form.email.trim() || undefined,
      bmdcNumber: form.bmdcNumber.trim(),
      specialty: form.specialty.trim(),
      qualification: form.qualification.trim(),
      hospital: form.hospital.trim(),
      district: form.district.trim(),
      yearsExperience: Number(form.yearsExperience) || 0,
      approvalStatus: "pending_admin",
      hasUploadedLicense: true,
      appliedAt: new Date().toISOString(),
    };
    upsertDoctor(doc);
    setDoctorSession(id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full lg:max-w-xl bg-white rounded-t-3xl lg:rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
      >
        <header className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-black text-gray-900">{t("portal.form.title")}</h2>
            <p className="text-xs text-gray-500 mt-1">{t("portal.form.sub")}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold">
            ✕
          </button>
        </header>

        <div className="space-y-4">
          <Field label={t("portal.form.fullName")} required>
            <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="input" />
          </Field>
          <Field label={t("portal.form.email")}>
            <input value={form.email} onChange={(e) => update("email", e.target.value)} className="input" type="email" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("portal.form.bmdc")} required>
              <input value={form.bmdcNumber} onChange={(e) => update("bmdcNumber", e.target.value)} className="input" placeholder="A-12345" />
            </Field>
            <Field label={t("portal.form.qualification")}>
              <input value={form.qualification} onChange={(e) => update("qualification", e.target.value)} className="input" />
            </Field>
          </div>
          <Field label={t("portal.form.specialty")} required>
            <input value={form.specialty} onChange={(e) => update("specialty", e.target.value)} className="input" placeholder="e.g. Internal Medicine, Pediatrics" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("portal.form.hospital")}>
              <input value={form.hospital} onChange={(e) => update("hospital", e.target.value)} className="input" />
            </Field>
            <Field label={t("portal.form.district")}>
              <input value={form.district} onChange={(e) => update("district", e.target.value)} className="input" />
            </Field>
          </div>
          <Field label={t("portal.form.experience")}>
            <input
              type="number"
              min={0}
              max={60}
              value={form.yearsExperience}
              onChange={(e) => update("yearsExperience", e.target.value)}
              className="input"
            />
          </Field>

          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 accent-emerald-600 shrink-0"
              checked={form.hasUploadedLicense}
              onChange={(e) => update("hasUploadedLicense", e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium text-gray-800">{t("portal.form.license")}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t("portal.form.license.sub")}</p>
            </div>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 flex gap-2">
              <XCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button onClick={submit} className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-500 transition-colors">
            {t("portal.form.submit")}
          </button>
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
    </motion.div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ───── Pending admin approval ────────────────────────────────────────────────
function PendingApproval({ doctor, t, lang }: { doctor: DoctorProfile; t: (k: string) => string; lang: string }) {
  const approve = () => {
    upsertDoctor({ ...doctor, approvalStatus: "approved", approvedAt: new Date().toISOString() });
  };
  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:max-w-2xl lg:mx-auto space-y-6">
      <div className="bg-white rounded-3xl border border-amber-100 p-6 sm:p-8 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
          <Clock size={32} />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">{t("portal.pending.title")}</h1>
        <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">{t("portal.pending.body")}</p>

        <div className="bg-gray-50 rounded-2xl p-4 text-left text-xs text-gray-600 space-y-1">
          <p><strong>{doctor.fullName}</strong> · {doctor.qualification}</p>
          <p>BMDC #{doctor.bmdcNumber} · {doctor.specialty}</p>
          {doctor.hospital && <p>{doctor.hospital}{doctor.district ? `, ${doctor.district}` : ""}</p>}
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{lang === "bn" ? "ডেমো মোড" : "Demo Mode"}</p>
          <button onClick={approve} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-colors">
            {t("portal.pending.demoApprove")}
          </button>
          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">{t("portal.pending.demoNote")}</p>
        </div>

        <button onClick={() => setDoctorSession(null)} className="mt-2 text-xs text-gray-500 hover:underline flex items-center gap-1 mx-auto">
          <LogOut size={12} /> {t("portal.signOut")}
        </button>
      </div>
    </div>
  );
}

// ───── Rejected ──────────────────────────────────────────────────────────────
function Rejected({ doctor, t }: { doctor: DoctorProfile; t: (k: string) => string }) {
  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:max-w-2xl lg:mx-auto">
      <div className="bg-white rounded-3xl border border-red-100 p-6 sm:p-8 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
          <XCircle size={32} />
        </div>
        <h1 className="text-xl font-black text-gray-900">{t("portal.rejected.title")}</h1>
        {doctor.rejectedReason && <p className="text-sm text-red-700">{doctor.rejectedReason}</p>}
        <button onClick={() => setDoctorSession(null)} className="text-xs text-gray-500 hover:underline flex items-center gap-1 mx-auto">
          <LogOut size={12} /> {t("portal.signOut")}
        </button>
      </div>
    </div>
  );
}

// ───── Audit panel ──────────────────────────────────────────────────────────
function AuditPanel({ doctor, t, lang }: { doctor: DoctorProfile; t: (k: string) => string; lang: string }) {
  const samples = useStore<AuditSample[]>(KEYS.AUDIT_SAMPLES_KEY, []);
  const certifications = useStore<Certification[]>(KEYS.CERTIFICATIONS_KEY, []);
  const [selected, setSelected] = useState<AuditSample | null>(null);
  const [showSign, setShowSign] = useState(false);

  const ratedCount = samples.filter((s) => s.rating !== "unrated").length;
  const totalCount = samples.length;
  const scores = useMemo(
    () => ({
      total: ratedCount,
      accurate: samples.filter((s) => s.rating === "accurate").length,
      needs_revision: samples.filter((s) => s.rating === "needs_revision").length,
      unsafe: samples.filter((s) => s.rating === "unsafe").length,
    }),
    [samples, ratedCount]
  );
  const canSign = ratedCount === totalCount && totalCount > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:max-w-6xl lg:mx-auto space-y-5">
      <header className="bg-emerald-900 text-white rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">{t("portal.queue.tag")}</p>
          <h1 className="text-lg sm:text-xl font-black truncate">{doctor.fullName}</h1>
          <p className="text-xs text-emerald-100/80 mt-0.5">
            {doctor.qualification} · BMDC #{doctor.bmdcNumber} · {doctor.specialty}
          </p>
        </div>
        <button
          onClick={() => setDoctorSession(null)}
          className="text-xs text-emerald-100 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors self-end sm:self-auto"
        >
          <LogOut size={12} /> {t("portal.signOut")}
        </button>
      </header>

      {/* Audit progress */}
      <section className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">{t("portal.audit.title")}</h2>
            <p className="text-xs text-gray-500 leading-relaxed">{t("portal.audit.intro")}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-emerald-600">{ratedCount}/{totalCount}</p>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t("portal.audit.progress")}</p>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: totalCount === 0 ? "0%" : `${(ratedCount / totalCount) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <ScoreChip label={t("audit.rating.accurate")} count={scores.accurate} tone="emerald" />
          <ScoreChip label={t("audit.rating.needs_revision")} count={scores.needs_revision} tone="amber" />
          <ScoreChip label={t("audit.rating.unsafe")} count={scores.unsafe} tone="red" />
        </div>
        <button
          onClick={() => setShowSign(true)}
          disabled={!canSign}
          className="w-full mt-5 py-3.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <FileSignature size={16} /> {t("portal.audit.signCta")}
        </button>
        {!canSign && (
          <p className="text-[11px] text-gray-400 text-center mt-2">{t("portal.audit.signHint")}</p>
        )}
      </section>

      {/* Samples grid */}
      <section className="space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t("portal.audit.samples")}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {samples.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {s.kind === "triage" ? <MessageSquare size={14} className="text-emerald-600" /> : <Camera size={14} className="text-blue-600" />}
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {s.kind === "triage" ? t("portal.kind.triage") : t("portal.kind.prescription")}
                  </span>
                </div>
                <RatingPill rating={s.rating} t={t} />
              </div>
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{s.patientInput}</p>
              <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">{s.aiOutput.replace(/[*#_]/g, "").slice(0, 140)}…</p>
              {s.aiSafetyVerdict === "critical" && (
                <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  <AlertTriangle size={10} /> {t("portal.flag.critical")}
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Past certifications */}
      {certifications.length > 0 && (
        <section className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t("portal.audit.history")}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {certifications.map((c) => (
              <div key={c.id} className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{c.periodMonth}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">Dr. {c.doctorName}</p>
                <p className="text-[11px] text-gray-500">BMDC #{c.doctorBmdc} · {c.doctorSpecialty}</p>
                <div className="flex gap-2 mt-2 text-[10px]">
                  <span className="text-emerald-600 font-bold">✓ {c.sampleScores.accurate}</span>
                  <span className="text-amber-600 font-bold">⚠ {c.sampleScores.needs_revision}</span>
                  <span className="text-red-600 font-bold">✗ {c.sampleScores.unsafe}</span>
                </div>
                {c.summaryNotes && <p className="text-[11px] text-gray-500 italic mt-2 leading-relaxed">{c.summaryNotes}</p>}
                <p className="text-[10px] text-gray-400 mt-2">
                  {new Date(c.signedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")} → {new Date(c.validUntil).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {selected && (
          <AuditSheet
            sample={selected}
            doctor={doctor}
            onClose={() => setSelected(null)}
            t={t}
          />
        )}
        {showSign && (
          <SignCertificationModal
            doctor={doctor}
            scores={scores}
            onClose={() => setShowSign(false)}
            t={t}
            lang={lang}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreChip({ label, count, tone }: { label: string; count: number; tone: "emerald" | "amber" | "red" }) {
  const toneMap = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  } as const;
  return (
    <div className={`rounded-xl p-3 border ${toneMap[tone]}`}>
      <p className="text-xl font-black">{count}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}

function RatingPill({ rating, t }: { rating: AuditRating; t: (k: string) => string }) {
  const map: Record<AuditRating, { c: string; key: string }> = {
    unrated: { c: "bg-gray-100 text-gray-500 border-gray-200", key: "audit.rating.unrated" },
    accurate: { c: "bg-emerald-50 text-emerald-700 border-emerald-200", key: "audit.rating.accurate" },
    needs_revision: { c: "bg-amber-50 text-amber-700 border-amber-200", key: "audit.rating.needs_revision" },
    unsafe: { c: "bg-red-50 text-red-700 border-red-200", key: "audit.rating.unsafe" },
  };
  const m = map[rating];
  return <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${m.c}`}>{t(m.key)}</span>;
}

// ───── Audit sample sheet ────────────────────────────────────────────────────
function AuditSheet({
  sample,
  doctor,
  onClose,
  t,
}: {
  sample: AuditSample;
  doctor: DoctorProfile;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const [rating, setRating] = useState<AuditRating>(sample.rating === "unrated" ? "accurate" : sample.rating);
  const [notes, setNotes] = useState(sample.reviewerNotes || "");

  const save = () => {
    updateAuditSample(sample.id, {
      rating,
      reviewerNotes: notes || undefined,
      ratedByDoctorId: doctor.id,
      ratedByDoctorName: doctor.fullName,
      ratedByDoctorBmdc: doctor.bmdcNumber,
      ratedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center overflow-y-auto"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full lg:max-w-2xl bg-white rounded-t-3xl lg:rounded-3xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto"
      >
        <header className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {sample.kind === "triage" ? t("portal.kind.triage") : t("portal.kind.prescription")}
            </p>
            <h2 className="text-lg font-black text-gray-900 mt-1">{t("portal.audit.review.title")}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold">✕</button>
        </header>

        <section className="space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t("portal.audit.review.patientInput")}</p>
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-800 whitespace-pre-wrap">{sample.patientInput}</div>
        </section>

        <section className="mt-4 space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t("portal.audit.review.aiOutput")}</p>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm prose prose-sm max-w-none">
            <Markdown>{sample.aiOutput}</Markdown>
          </div>
          {sample.aiSafetyVerdict && sample.aiSafetyVerdict !== "routine" && (
            <p className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 mt-1">
              <AlertTriangle size={10} /> AI verdict: {sample.aiSafetyVerdict}
            </p>
          )}
        </section>

        <section className="mt-5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("portal.audit.review.rateLabel")}</p>
          <div className="grid grid-cols-3 gap-2">
            {(["accurate", "needs_revision", "unsafe"] as const).map((r) => {
              const tones: Record<string, string> = {
                accurate: rating === r ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200",
                needs_revision: rating === r ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 border border-amber-200",
                unsafe: rating === r ? "bg-red-600 text-white" : "bg-red-50 text-red-700 border border-red-200",
              };
              return (
                <button
                  key={r}
                  onClick={() => setRating(r)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${tones[r]}`}
                >
                  {t(`audit.rating.${r}`)}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t("portal.audit.review.notesLabel")}</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("portal.audit.review.notesPlaceholder")}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <button
            onClick={save}
            className="w-full mt-4 py-3.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
          >
            <Edit3 size={16} /> {t("portal.audit.review.save")}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            {t("portal.audit.review.signedBy").replace("{name}", doctor.fullName).replace("{bmdc}", doctor.bmdcNumber)}
          </p>
        </section>
      </motion.div>
    </motion.div>
  );
}

// ───── Sign certification modal ─────────────────────────────────────────────
function SignCertificationModal({
  doctor,
  scores,
  onClose,
  t,
  lang,
}: {
  doctor: DoctorProfile;
  scores: { total: number; accurate: number; needs_revision: number; unsafe: number };
  onClose: () => void;
  t: (k: string) => string;
  lang: string;
}) {
  const [notes, setNotes] = useState("");
  const sign = () => {
    const signedAt = new Date();
    const validUntil = new Date(signedAt.getTime() + 31 * 24 * 60 * 60 * 1000);
    const periodMonth = `${signedAt.getFullYear()}-${String(signedAt.getMonth() + 1).padStart(2, "0")}`;
    const cert: Certification = {
      id: `cert_${doctor.id}_${signedAt.getTime().toString(36)}`,
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      doctorBmdc: doctor.bmdcNumber,
      doctorSpecialty: doctor.specialty,
      periodMonth,
      signedAt: signedAt.toISOString(),
      validUntil: validUntil.toISOString(),
      sampleScores: scores,
      summaryNotes: notes || undefined,
    };
    addCertification(cert);
    resetAuditRatings();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center overflow-y-auto"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full lg:max-w-xl bg-white rounded-t-3xl lg:rounded-3xl p-6 sm:p-8"
      >
        <header className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <FileSignature size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">{t("portal.sign.title")}</h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t("portal.sign.body")}</p>
          </div>
        </header>

        <div className="bg-gray-50 rounded-2xl p-4 space-y-2 mb-4">
          <p className="text-sm font-bold text-gray-900">Dr. {doctor.fullName}</p>
          <p className="text-xs text-gray-600">{doctor.qualification} · BMDC #{doctor.bmdcNumber}</p>
          <p className="text-xs text-gray-500">{doctor.specialty}{doctor.hospital ? ` · ${doctor.hospital}` : ""}</p>
          <div className="flex gap-3 pt-2 border-t border-gray-200 mt-2 text-xs">
            <span className="text-emerald-700"><strong>{scores.accurate}</strong> {t("audit.rating.accurate").toLowerCase()}</span>
            <span className="text-amber-700"><strong>{scores.needs_revision}</strong> {t("audit.rating.needs_revision").toLowerCase()}</span>
            <span className="text-red-700"><strong>{scores.unsafe}</strong> {t("audit.rating.unsafe").toLowerCase()}</span>
          </div>
        </div>

        <label className="block text-xs font-bold text-gray-600 mb-1.5">{t("portal.sign.notesLabel")}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t("portal.sign.notesPlaceholder")}
          className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />

        <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{t("portal.sign.disclaimer")}</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {lang === "bn" ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={sign}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} /> {t("portal.sign.confirm")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
