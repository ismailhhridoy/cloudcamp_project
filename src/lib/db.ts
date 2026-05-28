// Firestore ↔ localStorage bridge.
//
// The existing app reads data through a sync localStorage cache (see store.ts). To preserve
// every page without rewriting, this module keeps that cache as the source of UI reads but adds:
//   • Firestore onSnapshot listeners that mirror remote → local on every change
//   • Write helpers that push local → remote (fire-and-forget, queued offline by Firestore SDK)
//   • Lifecycle: subscriptions are started on sign-in, cleaned up on sign-out
//
// Collections:
//   users/{uid}                                — account doc (display name, createdAt)
//   users/{uid}/patientProfile/main            — single profile doc (age, district, conditions...)
//   users/{uid}/prescriptions/{rxId}           — saved scans
//   users/{uid}/reviews/{revId}                — submitted prescription reviews
//   doctors/{bmdc}                             — auto-registered + seeded doctors directory
//   legibilityScores/{bmdc}                    — AI handwriting aggregate per doctor (public read)
//   doctorAccounts/{id}                        — onboarded MBBS auditor accounts
//   auditSamples/{id}                          — audit pool (MBBS reviews these)
//   certifications/{id}                        — signed monthly certifications
//   appState/seeded                            — single doc, marks one-time seed complete

import { firebaseConfigStatus, getDb, onAuthChange, type AuthUserLite } from "./firebase.ts";
import {
  collection, doc, getDoc, onSnapshot, setDoc, serverTimestamp, deleteDoc,
  type Unsubscribe, type DocumentData,
} from "firebase/firestore";
import { KEYS } from "./store.ts";
import type {
  SavedPrescription, SubmittedReview, LegibilityRecord, ExternalDoctor,
  AuditSample, Certification, DoctorProfile, PatientProfile, PatientRatingRecord,
  TriageMessage,
} from "./types.ts";

const TRIAGE_CHAT_LOCAL_KEY = "shasthyo_triage_chat_v1";

const CONNECTED = () => firebaseConfigStatus === "ok";

// ── Tiny shared helpers ─────────────────────────────────────────────────────
function rawGet<T>(key: string, fallback: T): T {
  try { const r = window.localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}
function rawSet<T>(key: string, value: T): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
  // Manual storage event so cross-tab + same-tab useStore listeners pick up the change.
  try { window.dispatchEvent(new StorageEvent("storage", { key })); } catch {}
}

// ── User session state ─────────────────────────────────────────────────────
export interface CachedSession {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

let currentUid: string | null = null;
const subs: Unsubscribe[] = [];

function clearSubs(): void {
  while (subs.length) { try { subs.pop()?.(); } catch {} }
}

// Public initialisation — call once at app startup. Listens for auth state changes and starts /
// stops Firestore sync accordingly.
export function initDbSync(): () => void {
  if (!CONNECTED()) return () => {};
  const unsub = onAuthChange((u) => {
    if (u && u.uid !== currentUid) {
      currentUid = u.uid;
      writeSessionCache(u);
      startUserSubscriptions(u);
    } else if (!u && currentUid) {
      currentUid = null;
      window.localStorage.removeItem(KEYS.USER_SESSION_KEY);
      try { window.dispatchEvent(new StorageEvent("storage", { key: KEYS.USER_SESSION_KEY })); } catch {}
      clearSubs();
    }
  });
  // Public collections subscribe regardless of auth state.
  startPublicSubscriptions();
  return () => { unsub(); clearSubs(); };
}

function writeSessionCache(u: AuthUserLite): void {
  // Store as a compact account record so existing useCurrentUser callers can read sync.
  const cached: CachedSession = {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
  };
  // Mirror into the legacy USER_ACCOUNTS_KEY + USER_SESSION_KEY format used by store.ts so the
  // existing useCurrentUser hook keeps working unchanged.
  const accounts = rawGet<any[]>(KEYS.USER_ACCOUNTS_KEY, []);
  const idx = accounts.findIndex((a) => a.id === u.uid);
  const merged = {
    id: u.uid,
    email: u.email,
    name: u.displayName,
    passwordHash: "fb",
    salt: "fb",
    createdAt: u.createdAt,
  };
  if (idx >= 0) accounts[idx] = merged; else accounts.push(merged);
  rawSet(KEYS.USER_ACCOUNTS_KEY, accounts);
  rawSet(KEYS.USER_SESSION_KEY, u.uid);

  // Also write the user doc on Firestore (idempotent).
  void setDoc(
    doc(getDb(), "users", u.uid),
    { email: u.email, displayName: u.displayName, createdAt: u.createdAt, lastLogin: serverTimestamp() },
    { merge: true }
  ).catch((e) => console.warn("[db] users/{uid} write failed", e));
}

// ── Per-user subscriptions ─────────────────────────────────────────────────
function startUserSubscriptions(u: AuthUserLite): void {
  clearSubs();
  const db = getDb();

  // patientProfile
  subs.push(onSnapshot(
    doc(db, "users", u.uid, "patientProfile", "main"),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as PatientProfile;
      try { window.localStorage.setItem("shasthyo_patient_profile_v1", JSON.stringify(data)); } catch {}
      try { window.dispatchEvent(new StorageEvent("storage", { key: "shasthyo_patient_profile_v1" })); } catch {}
    },
    (e) => console.warn("[db] patientProfile listener", e)
  ));

  // prescriptions — merge remote into local so local-only docs (writes that haven't synced yet,
  // permission denials, etc.) aren't wiped by an empty initial snapshot.
  subs.push(onSnapshot(
    collection(db, "users", u.uid, "prescriptions"),
    (snap) => {
      const remote: SavedPrescription[] = snap.docs.map((d) => d.data() as SavedPrescription);
      const local = rawGet<SavedPrescription[]>(KEYS.SAVED_PRESCRIPTIONS_KEY, []);
      const merged = mergeById(local, remote, (x) => x.id);
      merged.sort((a, b) => (a.scannedAt < b.scannedAt ? 1 : -1));
      rawSet(KEYS.SAVED_PRESCRIPTIONS_KEY, merged);
    },
    (e) => console.error("[db] prescriptions listener error:", e?.message || e)
  ));

  // triageChat — single rolling doc at users/{uid}/triageChat/main. Remote replaces local
  // (chat is a single ordered conversation; merge-by-id doesn't apply).
  subs.push(onSnapshot(
    doc(db, "users", u.uid, "triageChat", "main"),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { messages?: TriageMessage[] };
      const remote = Array.isArray(data.messages) ? data.messages : [];
      const local = rawGet<TriageMessage[]>(TRIAGE_CHAT_LOCAL_KEY, []);
      // If the remote conversation is longer or strictly newer, take it; otherwise keep local
      // so an in-flight write doesn't get clobbered by a stale snapshot.
      if (remote.length >= local.length) {
        rawSet(TRIAGE_CHAT_LOCAL_KEY, remote);
      }
    },
    (e) => console.warn("[db] triageChat listener", e)
  ));

  // reviews
  subs.push(onSnapshot(
    collection(db, "users", u.uid, "reviews"),
    (snap) => {
      const remote: SubmittedReview[] = snap.docs.map((d) => d.data() as SubmittedReview);
      const local = rawGet<SubmittedReview[]>(KEYS.SUBMITTED_REVIEWS_KEY, []);
      const merged = mergeById(local, remote, (x) => x.id);
      merged.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
      rawSet(KEYS.SUBMITTED_REVIEWS_KEY, merged);
    },
    (e) => console.error("[db] reviews listener error:", e?.message || e)
  ));
}

// Merge two arrays by id; remote wins where both have the same id, but local-only items
// survive (so a pending or denied write doesn't disappear from the UI).
function mergeById<T>(local: T[], remote: T[], idOf: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const x of local) map.set(idOf(x), x);
  for (const x of remote) map.set(idOf(x), x);
  return Array.from(map.values());
}

// ── Public subscriptions (auth-optional, public-read) ──────────────────────
function startPublicSubscriptions(): void {
  const db = getDb();

  subs.push(onSnapshot(collection(db, "doctors"), (snap) => {
    const remote: ExternalDoctor[] = snap.docs.map((d) => d.data() as ExternalDoctor);
    const local = rawGet<ExternalDoctor[]>(KEYS.EXTERNAL_DOCTORS_KEY, []);
    rawSet(KEYS.EXTERNAL_DOCTORS_KEY, mergeById(local, remote, (x) => x.bmdc));
  }, (e) => console.error("[db] doctors listener error:", e?.message || e)));

  subs.push(onSnapshot(collection(db, "legibilityScores"), (snap) => {
    const remote: LegibilityRecord[] = snap.docs.map((d) => d.data() as LegibilityRecord);
    const local = rawGet<LegibilityRecord[]>(KEYS.LEGIBILITY_KEY, []);
    rawSet(KEYS.LEGIBILITY_KEY, mergeById(local, remote, (x) => x.bmdc));
  }, (e) => console.error("[db] legibilityScores listener error:", e?.message || e)));

  subs.push(onSnapshot(collection(db, "patientRatings"), (snap) => {
    const remote: PatientRatingRecord[] = snap.docs.map((d) => d.data() as PatientRatingRecord);
    const local = rawGet<PatientRatingRecord[]>(KEYS.PATIENT_RATINGS_KEY, []);
    rawSet(KEYS.PATIENT_RATINGS_KEY, mergeById(local, remote, (x) => x.bmdc));
  }, (e) => console.error("[db] patientRatings listener error:", e?.message || e)));

  subs.push(onSnapshot(collection(db, "doctorAccounts"), (snap) => {
    const remote: DoctorProfile[] = snap.docs.map((d) => d.data() as DoctorProfile);
    const local = rawGet<DoctorProfile[]>(KEYS.DOCTORS_KEY, []);
    rawSet(KEYS.DOCTORS_KEY, mergeById(local, remote, (x) => x.id));
  }, (e) => console.error("[db] doctorAccounts listener error:", e?.message || e)));

  subs.push(onSnapshot(collection(db, "auditSamples"), (snap) => {
    const remote: AuditSample[] = snap.docs.map((d) => d.data() as AuditSample);
    const local = rawGet<AuditSample[]>(KEYS.AUDIT_SAMPLES_KEY, []);
    rawSet(KEYS.AUDIT_SAMPLES_KEY, mergeById(local, remote, (x) => x.id));
  }, (e) => console.error("[db] auditSamples listener error:", e?.message || e)));

  subs.push(onSnapshot(collection(db, "certifications"), (snap) => {
    const remote: Certification[] = snap.docs.map((d) => d.data() as Certification);
    const local = rawGet<Certification[]>(KEYS.CERTIFICATIONS_KEY, []);
    rawSet(KEYS.CERTIFICATIONS_KEY, mergeById(local, remote, (x) => x.id));
  }, (e) => console.error("[db] certifications listener error:", e?.message || e)));
}

// ── Write helpers ─────────────────────────────────────────────────────────
// Each is fire-and-forget; the Firestore SDK queues writes when offline and flushes when online.
// Errors are surfaced as console.error so misconfigurations (rules denied, undefined fields,
// network down) are noisy enough to debug.

// Strip undefined values at any depth — even with ignoreUndefinedProperties on the SDK, some
// SDK versions still surface a warning. Cleaner to send shaped data.
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as any;
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as object)) {
      if (v === undefined) continue;
      out[k] = clean(v as any);
    }
    return out as T;
  }
  return value;
}

function safeWrite(fn: () => Promise<unknown>, label: string): void {
  if (!CONNECTED()) return;
  fn().catch((e) => {
    const msg = e?.code || e?.message || String(e);
    console.error(`[db] write failed (${label}):`, msg, e);
    // Common surface causes — log a hint for the developer.
    if (String(msg).includes("permission-denied")) {
      console.error("[db] Firestore PERMISSION_DENIED — did you publish firestore.rules in the Firebase Console?");
    } else if (String(msg).includes("invalid data") || String(msg).includes("undefined")) {
      console.error("[db] Firestore invalid-data — a field value is undefined or unsupported.");
    }
  });
}

export function writePatientProfile(uid: string, p: PatientProfile): void {
  safeWrite(() => setDoc(doc(getDb(), "users", uid, "patientProfile", "main"), clean(p) as DocumentData, { merge: true }), "patientProfile");
}

export function writePrescription(uid: string, p: SavedPrescription): void {
  safeWrite(() => setDoc(doc(getDb(), "users", uid, "prescriptions", p.id), clean(p) as DocumentData), "prescription");
}
export function deletePrescription(uid: string, rxId: string): void {
  safeWrite(() => deleteDoc(doc(getDb(), "users", uid, "prescriptions", rxId)), "deletePrescription");
}

export function writeReview(uid: string, r: SubmittedReview): void {
  safeWrite(() => setDoc(doc(getDb(), "users", uid, "reviews", r.id), clean(r) as DocumentData), "review");
}

export function writeTriageChat(uid: string, messages: TriageMessage[]): void {
  safeWrite(
    () => setDoc(
      doc(getDb(), "users", uid, "triageChat", "main"),
      { messages: clean(messages), updatedAt: serverTimestamp() } as DocumentData,
    ),
    "triageChat",
  );
}

export function writeExternalDoctor(d: ExternalDoctor): void {
  safeWrite(() => setDoc(doc(getDb(), "doctors", d.bmdc), clean(d) as DocumentData, { merge: true }), "externalDoctor");
}

// ── /docs config (shared, global) ────────────────────────────────────────────
// Stored at appState/docs — public read, signed-in write (existing firestore.rules). This makes
// the admin's visibility/schedule changes propagate to EVERY visitor in real time, instead of
// being stuck in one browser's localStorage.
export async function fetchDocsConfigOnce(): Promise<Record<string, unknown> | null> {
  if (!CONNECTED()) return null;
  try {
    const snap = await getDoc(doc(getDb(), "appState", "docs"));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch (e) {
    console.warn("[db] fetchDocsConfigOnce failed", e);
    return null;
  }
}

export function subscribeDocsConfig(onChange: (cfg: Record<string, unknown>) => void): () => void {
  if (!CONNECTED()) return () => {};
  try {
    return onSnapshot(
      doc(getDb(), "appState", "docs"),
      (snap) => { if (snap.exists()) onChange(snap.data() as Record<string, unknown>); },
      (e) => console.warn("[db] docsConfig listener", e),
    );
  } catch (e) {
    console.warn("[db] subscribeDocsConfig failed", e);
    return () => {};
  }
}

// Publish the config globally. Requires Firebase sign-in (appState write rule). Returns whether
// the write was accepted so the admin UI can show success / "sign in to publish" feedback.
export async function publishDocsConfig(cfg: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  if (!CONNECTED()) return { ok: false, error: "Firebase not configured" };
  try {
    await setDoc(doc(getDb(), "appState", "docs"), clean(cfg) as DocumentData, { merge: true });
    return { ok: true };
  } catch (e: any) {
    const msg = e?.code || e?.message || String(e);
    console.error("[db] publishDocsConfig failed", msg);
    return { ok: false, error: msg };
  }
}

export function writeLegibility(rec: LegibilityRecord): void {
  safeWrite(() => setDoc(doc(getDb(), "legibilityScores", rec.bmdc), clean(rec) as DocumentData, { merge: true }), "legibility");
}

export function writePatientRating(rec: PatientRatingRecord): void {
  safeWrite(() => setDoc(doc(getDb(), "patientRatings", rec.bmdc), clean(rec) as DocumentData, { merge: true }), "patientRating");
}

export function writeDoctorAccount(d: DoctorProfile): void {
  safeWrite(() => setDoc(doc(getDb(), "doctorAccounts", d.id), clean(d) as DocumentData), "doctorAccount");
}

export function writeAuditSample(s: AuditSample): void {
  safeWrite(() => setDoc(doc(getDb(), "auditSamples", s.id), clean(s) as DocumentData), "auditSample");
}

export function writeCertification(c: Certification): void {
  safeWrite(() => setDoc(doc(getDb(), "certifications", c.id), clean(c) as DocumentData), "certification");
}

// ── One-time seed ──────────────────────────────────────────────────────────
// Pushes the demo doctors, audit samples, and example certification into Firestore exactly once.
// Idempotent — the `appState/seeded` doc is set after the run so subsequent launches skip.
export async function seedOnceIfNeeded(seedData: {
  doctorAccounts: DoctorProfile[];
  auditSamples: AuditSample[];
  certifications: Certification[];
  publicDoctors: ExternalDoctor[];
}): Promise<{ seeded: boolean; reason?: string }> {
  if (!CONNECTED()) return { seeded: false, reason: "not_connected" };
  try {
    const flag = await getDoc(doc(getDb(), "appState", "seeded"));
    if (flag.exists()) return { seeded: false, reason: "already_seeded" };
    for (const d of seedData.doctorAccounts) await setDoc(doc(getDb(), "doctorAccounts", d.id), d as DocumentData);
    for (const s of seedData.auditSamples) await setDoc(doc(getDb(), "auditSamples", s.id), s as DocumentData);
    for (const c of seedData.certifications) await setDoc(doc(getDb(), "certifications", c.id), c as DocumentData);
    for (const d of seedData.publicDoctors) await setDoc(doc(getDb(), "doctors", d.bmdc), d as DocumentData);
    await setDoc(doc(getDb(), "appState", "seeded"), { at: serverTimestamp() });
    return { seeded: true };
  } catch (e: any) {
    console.warn("[db] seed failed", e);
    return { seeded: false, reason: e?.message };
  }
}
