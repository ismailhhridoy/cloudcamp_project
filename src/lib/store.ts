// localStorage-backed store with a tiny pub/sub for live updates.
// Shape intentionally mimics Firestore semantics so it can be swapped for the real SDK later.

import { useEffect, useState } from "react";
import type { DoctorProfile, AuditSample, Certification } from "./types.ts";

const DOCTORS_KEY = "shasthyo_doctors_v1";
const AUDIT_SAMPLES_KEY = "shasthyo_audit_samples_v1";
const CERTIFICATIONS_KEY = "shasthyo_certifications_v1";
const DOCTOR_SESSION_KEY = "shasthyo_doctor_session_v1";
const PATIENT_ID_KEY = "shasthyo_patient_id_v1";

type Listener = () => void;
const listeners: Map<string, Set<Listener>> = new Map();

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function subscribe(key: string, fn: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => listeners.get(key)?.delete(fn);
}

function rawGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function rawSet<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  emit(key);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key && listeners.has(e.key)) emit(e.key);
  });
}

// React hook — re-renders whenever the underlying key changes (same tab or other tabs).
export function useStore<T>(key: string, fallback: T): T {
  const [val, setVal] = useState<T>(() => rawGet(key, fallback));
  useEffect(() => {
    setVal(rawGet(key, fallback));
    return subscribe(key, () => setVal(rawGet(key, fallback)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return val;
}

// ── Patient identity ────────────────────────────────────────────────────────
export function getPatientId(): string {
  let id = rawGet<string>(PATIENT_ID_KEY, "");
  if (!id) {
    id = `pat_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    rawSet(PATIENT_ID_KEY, id);
  }
  return id;
}

// ── Doctor profiles ─────────────────────────────────────────────────────────
export function listDoctors(): DoctorProfile[] {
  return rawGet<DoctorProfile[]>(DOCTORS_KEY, []);
}

export function getDoctor(id: string): DoctorProfile | undefined {
  return listDoctors().find((d) => d.id === id);
}

export function upsertDoctor(d: DoctorProfile): void {
  const all = listDoctors();
  const idx = all.findIndex((x) => x.id === d.id);
  if (idx >= 0) all[idx] = d;
  else all.push(d);
  rawSet(DOCTORS_KEY, all);
}

// ── Audit samples ───────────────────────────────────────────────────────────
export function listAuditSamples(): AuditSample[] {
  return rawGet<AuditSample[]>(AUDIT_SAMPLES_KEY, []);
}

export function updateAuditSample(id: string, patch: Partial<AuditSample>): void {
  const all = listAuditSamples();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  rawSet(AUDIT_SAMPLES_KEY, all);
}

export function resetAuditRatings(): void {
  const all = listAuditSamples().map((s) => ({
    ...s,
    rating: "unrated" as const,
    reviewerNotes: undefined,
    ratedAt: undefined,
    ratedByDoctorId: undefined,
    ratedByDoctorName: undefined,
    ratedByDoctorBmdc: undefined,
  }));
  rawSet(AUDIT_SAMPLES_KEY, all);
}

// ── Certifications ──────────────────────────────────────────────────────────
export function listCertifications(): Certification[] {
  return rawGet<Certification[]>(CERTIFICATIONS_KEY, []);
}

export function addCertification(c: Certification): void {
  rawSet(CERTIFICATIONS_KEY, [c, ...listCertifications()]);
}

export function latestCertification(): Certification | undefined {
  const all = listCertifications();
  if (all.length === 0) return undefined;
  return [...all].sort((a, b) => (a.signedAt < b.signedAt ? 1 : -1))[0];
}

// ── Doctor session (mock auth) ──────────────────────────────────────────────
export function getDoctorSession(): string | null {
  return rawGet<string | null>(DOCTOR_SESSION_KEY, null);
}

export function setDoctorSession(id: string | null): void {
  if (id) rawSet(DOCTOR_SESSION_KEY, id);
  else {
    window.localStorage.removeItem(DOCTOR_SESSION_KEY);
    emit(DOCTOR_SESSION_KEY);
  }
}

// ── Seeds ───────────────────────────────────────────────────────────────────
export function seedDemoDoctorIfEmpty(): void {
  if (listDoctors().length > 0) return;
  const demo: DoctorProfile = {
    id: "doc_demo_seed",
    fullName: "Dr. Demo Verifier",
    email: "demo@shasthyoai.local",
    bmdcNumber: "A-99999",
    specialty: "General Medicine",
    qualification: "MBBS, FCPS",
    hospital: "ShasthyoAI Demo Clinic",
    district: "Dhaka",
    yearsExperience: 8,
    approvalStatus: "approved",
    hasUploadedLicense: true,
    appliedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
  };
  upsertDoctor(demo);
}

// Seed a previously-signed certification (by a different doctor) so first-load users see what a
// real certification badge looks like on the Compliance page. The current logged-in doctor still
// has to sign their own period.
export function seedExampleCertificationIfEmpty(): void {
  if (listCertifications().length > 0) return;
  const signedAt = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000); // 12 days ago
  const validUntil = new Date(signedAt.getTime() + 31 * 24 * 60 * 60 * 1000);
  const periodMonth = `${signedAt.getFullYear()}-${String(signedAt.getMonth() + 1).padStart(2, "0")}`;
  addCertification({
    id: `cert_seed_${signedAt.getTime().toString(36)}`,
    doctorId: "doc_seed_aminul",
    doctorName: "Dr. Aminul Haque",
    doctorBmdc: "A-31207",
    doctorSpecialty: "Internal Medicine",
    periodMonth,
    signedAt: signedAt.toISOString(),
    validUntil: validUntil.toISOString(),
    sampleScores: { total: 8, accurate: 7, needs_revision: 1, unsafe: 0 },
    summaryNotes:
      "AI triage flow handles common rural complaints well; emergency questioning is appropriate. Minor revision suggested on infant fever advice (added explicit weight-based threshold).",
  });
}

export function seedAuditSamplesIfEmpty(): void {
  if (listAuditSamples().length > 0) return;
  const now = new Date().toISOString();
  const samples: AuditSample[] = [
    {
      id: "sample_001",
      kind: "triage",
      patientInput: "I have mild fever and headache since yesterday afternoon",
      aiOutput:
        "Sorry to hear that. Is your temperature above 102°F (39°C), and any cough, body aches, or rash?\n\nFor mild fever and headache, you can: rest, drink plenty of fluids, and take paracetamol if needed.\n\n**🏠 FIRST-AID AT HOME**\n\n1. Rest and hydrate (water, ORS, or coconut water).\n2. Paracetamol 500 mg every 6 hours if fever persists — verify dose with a licensed doctor before taking, especially if you have liver/kidney disease.\n3. Monitor for 48 hours. If fever stays above 102°F or you develop rash, severe headache, or vomiting, see a doctor.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
      aiSafetyVerdict: "routine",
      rating: "unrated",
      sampledAt: now,
    },
    {
      id: "sample_002",
      kind: "triage",
      patientInput: "My 10-month-old baby has high fever 103°F since last night, not feeding well",
      aiOutput:
        "I understand, this is concerning. Is the baby alert and crying, or unusually sleepy/floppy? Is breathing fast or noisy? Any rash, vomiting, or seizure?\n\n**🚨 GO TO HOSPITAL NOW**\n\nIn an infant under 1 year, high fever with poor feeding can become serious quickly.\n\n1. Take the baby to the nearest hospital or call 999 immediately.\n2. Keep the baby cool (light clothing, sponging with lukewarm water — never cold water).\n3. Bring any medication the baby has had and note the time of the last dose.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
      aiSafetyVerdict: "critical",
      rating: "unrated",
      sampledAt: now,
    },
    {
      id: "sample_003",
      kind: "triage",
      patientInput: "আমার বুকে হঠাৎ ব্যথা শুরু হয়েছে, বাঁ হাতে ছড়াচ্ছে",
      aiOutput:
        "এটি শুনে দুঃখিত। ব্যথা কতক্ষণ ধরে? চাপ চাপ ভাব নাকি ছুরির মতো? ঘাম হচ্ছে বা শ্বাস নিতে কষ্ট হচ্ছে?\n\n**🚨 এখনই হাসপাতালে যান**\n\nবুকে ব্যথা বাঁ হাতে ছড়ালে এটি হার্ট অ্যাটাকের লক্ষণ হতে পারে।\n\n১. এখনই নিকটতম হাসপাতালে যান অথবা ৯৯৯-এ কল করুন।\n২. বসুন বা আধ-শোয়া অবস্থায় থাকুন, কাপড় ঢিলে করুন।\n৩. পরিচিত হার্টের ওষুধ থাকলে সাথে নিন; অপরিচিত নতুন ওষুধ নিজে খাবেন না।\n\n⚠️ এটি শুধু AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।",
      aiSafetyVerdict: "critical",
      rating: "unrated",
      sampledAt: now,
    },
    {
      id: "sample_004",
      kind: "triage",
      patientInput: "Diarrhea since this morning, 4 times, no blood",
      aiOutput:
        "Sorry to hear that. Any vomiting, fever, blood in stool, or signs of dehydration (dry mouth, dizziness, low urine)?\n\n**🏠 FIRST-AID AT HOME**\n\n1. Drink ORS (oral rehydration salts) after every loose motion. If ORS not available, mix 1 litre of safe boiled water with a pinch of salt and a fistful of sugar.\n2. Eat light foods — rice, banana, plain bread.\n3. If you develop blood in stool, persistent vomiting, high fever, or feel very weak, see a doctor immediately.\n\nORS is safe but verify with a licensed doctor before giving antibiotics, anti-diarrheal drugs, or anything else.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
      aiSafetyVerdict: "routine",
      rating: "unrated",
      sampledAt: now,
    },
    {
      id: "sample_005",
      kind: "triage",
      patientInput: "I am pregnant 8 months and have bleeding for 1 hour",
      aiOutput:
        "I'm very worried — bleeding in late pregnancy needs immediate attention. How much bleeding (light spotting vs soaking a pad)? Any pain in the abdomen or back? Is the baby moving as usual?\n\n**🚨 GO TO HOSPITAL NOW**\n\nDo NOT wait at home.\n\n1. Go to the nearest hospital with an obstetric/maternity unit immediately, or call 999 for an ambulance.\n2. Take a family member with you and bring your antenatal card if available.\n3. Lie on your left side while travelling.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
      aiSafetyVerdict: "critical",
      rating: "unrated",
      sampledAt: now,
    },
    {
      id: "sample_006",
      kind: "triage",
      patientInput: "Mild dry cough and runny nose for 3 days",
      aiOutput:
        "Common cold symptoms — usually settles in 5–7 days. Any fever, breathing trouble, or chest pain?\n\n**🏠 FIRST-AID AT HOME**\n\n1. Drink warm fluids (water, soup, ginger tea).\n2. Steam inhalation 2–3 times a day helps.\n3. Rest. Paracetamol for any fever — verify dose with a licensed doctor before taking, especially for children or pregnant women.\n\nDo NOT take antibiotics for a viral cold — they don't help and can cause resistance. If cough lasts beyond 10 days or you develop fever above 102°F, breathing trouble, or thick coloured mucus, see a doctor.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
      aiSafetyVerdict: "routine",
      rating: "unrated",
      sampledAt: now,
    },
    {
      id: "sample_007",
      kind: "prescription",
      patientInput: "Prescription scan: Dr. Mahmud, BMDC A-44521 — Internal Medicine",
      aiOutput:
        "Confidence: 87%\n\nMedicines extracted:\n• Amoxicillin 500 mg — 1 capsule three times daily for 5 days (for bacterial infection)\n• Paracetamol 500 mg — 1 tablet every 6 hours as needed for fever\n• Loratadine 10 mg — 1 tablet at night for 5 days (for allergy/runny nose)\n\nDoctor's notes: Take amoxicillin with food. Complete the full 5-day course even if you feel better. Drink plenty of fluids.\n\nFollow-up: Return in 1 week if symptoms persist.",
      rating: "unrated",
      sampledAt: now,
    },
    {
      id: "sample_008",
      kind: "triage",
      patientInput: "I can't sleep and feel hopeless, sometimes think life is not worth it",
      aiOutput:
        "Thank you for telling me this — what you're feeling is real and you are not alone. Have you been feeling this way for more than two weeks? Are you having thoughts of hurting yourself right now?\n\n**🚨 PLEASE TALK TO SOMEONE NOW**\n\n1. Call Kaan Pete Roi mental-health helpline: **9612119911** — they listen in Bangla.\n2. If you are thinking of harming yourself, go to the nearest hospital emergency department or call 999.\n3. Tell one trusted person (family, friend, neighbour) how you are feeling today.\n\nDepression and suicidal thoughts are medical conditions that respond well to care — please reach out.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
      aiSafetyVerdict: "critical",
      rating: "unrated",
      sampledAt: now,
    },
  ];
  rawSet(AUDIT_SAMPLES_KEY, samples);
}

export const KEYS = {
  DOCTORS_KEY,
  AUDIT_SAMPLES_KEY,
  CERTIFICATIONS_KEY,
  DOCTOR_SESSION_KEY,
  PATIENT_ID_KEY,
};
