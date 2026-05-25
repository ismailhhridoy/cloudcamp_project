import { useMemo, useState } from "react";
import { UserRound, FileText, Star, LogOut, Trash2, ShieldCheck, Calendar, Eye } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import {
  useCurrentUser, signOut, listSavedPrescriptions, listSubmittedReviews,
  deleteSavedPrescription, useStore, KEYS,
} from "../lib/store.ts";
import { usePatientProfile, summariseProfile } from "../lib/profile.ts";
import type { SavedPrescription, SubmittedReview } from "../lib/types.ts";
import { PrescriptionDetailModal } from "../components/PrescriptionDetailModal.tsx";

interface Props {
  onSignIn: () => void;
  onEditProfile: () => void;
}

export function PatientProfilePage({ onSignIn, onEditProfile }: Props) {
  const { t, lang } = useLanguage();
  const user = useCurrentUser();
  const profile = usePatientProfile();
  const [activeRx, setActiveRx] = useState<SavedPrescription | null>(null);
  // useStore subscriptions so the page re-renders on new prescriptions / reviews / sign-out.
  const allRx = useStore<SavedPrescription[]>(KEYS.SAVED_PRESCRIPTIONS_KEY, []);
  const allReviews = useStore<SubmittedReview[]>(KEYS.SUBMITTED_REVIEWS_KEY, []);

  const myRx = useMemo(() => allRx.filter((p) => user && p.userId === user.id), [allRx, user]);
  const myReviews = useMemo(() => allReviews.filter((r) => user && r.userId === user.id), [allReviews, user]);

  if (!user) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 lg:max-w-2xl lg:mx-auto pb-24">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <UserRound size={32} />
          </div>
          <h1 className="text-xl font-black text-gray-900">{t("profile.signin.title")}</h1>
          <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto">{t("profile.signin.intro")}</p>
          <button onClick={onSignIn} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500">
            {t("auth.signin.cta")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:max-w-4xl lg:mx-auto space-y-5">
      {/* Account header */}
      <header className="bg-gradient-to-br from-emerald-900 to-emerald-700 text-white rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center text-white font-black text-xl">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-black truncate">{user.name}</h1>
            <p className="text-xs text-emerald-100/80 truncate">{user.email}</p>
            <p className="text-[10px] text-emerald-200/60 mt-0.5">
              {t("profile.memberSince")} {new Date(user.createdAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="text-xs text-white/80 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          >
            <LogOut size={12} /> {t("profile.signOut")}
          </button>
        </div>
      </header>

      {/* Profile (medical) */}
      <section className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t("triage.profile.label")}</p>
            <h2 className="text-base font-bold text-gray-900">{summariseProfile(profile, lang as "en" | "bn")}</h2>
          </div>
          <button onClick={onEditProfile} className="text-xs font-bold text-emerald-600 hover:underline">
            {t("triage.profile.edit")}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-xl py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t("profile.age")}</p>
            <p className="text-sm font-bold text-gray-800">{profile.age ?? "—"}</p>
          </div>
          <div className="bg-gray-50 rounded-xl py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t("profile.district")}</p>
            <p className="text-sm font-bold text-gray-800 truncate">{profile.district || "—"}</p>
          </div>
          <div className="bg-gray-50 rounded-xl py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t("profile.conditions")}</p>
            <p className="text-sm font-bold text-gray-800">{profile.conditions.length}</p>
          </div>
        </div>
      </section>

      {/* Prescription history */}
      <section className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
        <header className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-emerald-600" />
          <h2 className="text-base font-bold text-gray-900">{t("profile.rx.title")}</h2>
          <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{myRx.length}</span>
        </header>
        {myRx.length === 0 ? (
          <p className="text-sm text-gray-500 leading-relaxed">{t("profile.rx.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {myRx.map((rx) => (
              <li key={rx.id} className="border border-gray-100 rounded-2xl p-3 flex gap-3 items-start hover:border-emerald-200 transition-colors">
                <button
                  onClick={() => setActiveRx(rx)}
                  className="flex gap-3 items-start flex-1 min-w-0 text-left"
                >
                  {/* Thumbnail of the uploaded image when available. */}
                  {rx.imagePreview ? (
                    <img
                      src={rx.imagePreview}
                      alt="prescription"
                      className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                      <FileText size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {rx.doctor.name || (lang === "bn" ? "ডাক্তার শনাক্ত হয়নি" : "Doctor not identified")}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {rx.doctor.specialization || ""}
                      {rx.doctor.bmdc ? ` · BMDC ${rx.doctor.bmdc}` : ""}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1 flex-wrap">
                      <Calendar size={10} /> {new Date(rx.scannedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}
                      <span className="opacity-60">·</span>
                      <span>{rx.medicineCount} {lang === "bn" ? "ওষুধ" : "meds"}</span>
                      {rx.testCount > 0 && <><span className="opacity-60">·</span><span>{rx.testCount} {lang === "bn" ? "পরীক্ষা" : "tests"}</span></>}
                    </div>
                    {rx.diagnosisHint && (
                      <p className="text-[11px] text-purple-700 mt-1 italic line-clamp-1">{rx.diagnosisHint}</p>
                    )}
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-emerald-700">
                      <Eye size={10} /> {lang === "bn" ? "বিস্তারিত দেখুন" : "View details"}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => { if (confirm(t("profile.rx.confirmDelete"))) deleteSavedPrescription(rx.id); }}
                  className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                  title={t("profile.rx.delete")}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* My reviews */}
      <section className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
        <header className="flex items-center gap-2 mb-3">
          <Star size={16} className="text-amber-500" />
          <h2 className="text-base font-bold text-gray-900">{t("profile.reviews.title")}</h2>
          <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{myReviews.length}</span>
        </header>
        {myReviews.length === 0 ? (
          <p className="text-sm text-gray-500 leading-relaxed">{t("profile.reviews.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {myReviews.map((rev) => (
              <li key={rev.id} className="border border-gray-100 rounded-2xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{rev.doctorName}</p>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{rev.bmdc}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-500 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < rev.legibleScore ? "fill-amber-400" : "text-gray-200 fill-gray-200"} />
                  ))}
                  <span className="text-[10px] text-gray-500 ml-1">{rev.legibleScore}/5 · {t("profile.reviews.prescription")}</span>
                </div>
                {rev.comment && <p className="text-xs text-gray-600 italic mt-1">"{rev.comment}"</p>}
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(rev.submittedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-gray-500 text-center leading-relaxed px-4">
        <ShieldCheck size={10} className="inline -mt-0.5 mr-1" />
        {t("profile.dataNotice")}
      </p>

      <AnimatePresence>
        {activeRx && (
          <PrescriptionDetailModal record={activeRx} onClose={() => setActiveRx(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
