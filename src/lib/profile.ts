// Patient profile, persisted in localStorage. Used by the diagnostic engine to multiply risk
// based on chronic conditions, pregnancy, and district context.

import { useEffect, useState } from "react";
import type { PatientProfile, ChronicCondition } from "./types.ts";

const PROFILE_KEY = "shasthyo_patient_profile_v1";

const EMPTY: PatientProfile = {
  conditions: [],
  updatedAt: new Date(0).toISOString(),
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function getPatientProfile(): PatientProfile {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as PatientProfile) };
  } catch {}
  return EMPTY;
}

export function setPatientProfile(patch: Partial<PatientProfile>): void {
  if (typeof window === "undefined") return;
  const next: PatientProfile = {
    ...getPatientProfile(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  for (const fn of listeners) fn();
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: PROFILE_KEY }));
  } catch {}
  // Mirror to Firestore against the signed-in user. Lazy import to avoid circular deps.
  Promise.all([import("./store.ts"), import("./db.ts")])
    .then(([store, db]) => {
      const u = store.getCurrentUser();
      if (u) db.writePatientProfile(u.id, next);
    })
    .catch(() => {});
}

export function hasPatientProfile(): boolean {
  const p = getPatientProfile();
  return p.age != null || p.district != null || p.conditions.length > 0;
}

export function usePatientProfile(): PatientProfile {
  const [p, setP] = useState<PatientProfile>(getPatientProfile);
  useEffect(() => {
    const fn = () => setP(getPatientProfile());
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === PROFILE_KEY) setP(getPatientProfile());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return p;
}

// Friendly summary like "Age 52, Diabetic" for the diagnostic card.
export function summariseProfile(p: PatientProfile, lang: "en" | "bn"): string {
  const parts: string[] = [];
  if (p.age != null) parts.push(lang === "bn" ? `বয়স ${p.age}` : `Age ${p.age}`);
  if (p.conditions.includes("pregnancy")) {
    parts.push(lang === "bn" ? `গর্ভবতী${p.pregnancyWeeks ? ` (${p.pregnancyWeeks} সপ্তাহ)` : ""}` : `Pregnant${p.pregnancyWeeks ? ` (${p.pregnancyWeeks}w)` : ""}`);
  }
  if (p.conditions.includes("diabetes")) parts.push(lang === "bn" ? "ডায়াবেটিক" : "Diabetic");
  if (p.conditions.includes("hypertension")) parts.push(lang === "bn" ? "উচ্চ রক্তচাপ" : "Hypertensive");
  if (p.conditions.includes("heart_disease")) parts.push(lang === "bn" ? "হৃদরোগী" : "Cardiac");
  if (p.conditions.includes("asthma")) parts.push(lang === "bn" ? "হাঁপানি" : "Asthmatic");
  if (p.conditions.includes("kidney_disease")) parts.push(lang === "bn" ? "কিডনি রোগী" : "Renal");
  if (p.conditions.includes("tb_history")) parts.push(lang === "bn" ? "টিবি ইতিহাস" : "TB history");
  if (p.conditions.includes("immunocompromised")) parts.push(lang === "bn" ? "কম রোগ প্রতিরোধ" : "Immunocompromised");
  if (parts.length === 0) return lang === "bn" ? "প্রোফাইল সেট করা নেই" : "No profile set";
  return parts.join(", ");
}

export const CONDITION_OPTIONS: ChronicCondition[] = [
  "diabetes",
  "hypertension",
  "heart_disease",
  "asthma",
  "kidney_disease",
  "pregnancy",
  "tb_history",
  "immunocompromised",
];
