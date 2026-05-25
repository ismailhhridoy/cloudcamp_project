// Firebase bootstrap — Auth + Firestore with offline IndexedDB persistence.
// Reads firebase-applet-config.json at build time; if values are still "MOCK", we surface a
// clear banner via `firebaseConfigStatus` instead of crashing the app.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth, type Auth, onAuthStateChanged, signOut as authSignOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  GoogleAuthProvider, signInWithPopup,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export type FirebaseConfigStatus = "ok" | "mock" | "error";

function isMock(): boolean {
  return Object.values(firebaseConfig).some((v) => v === "MOCK");
}

let app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
export let firebaseConfigStatus: FirebaseConfigStatus = "ok";

if (isMock()) {
  firebaseConfigStatus = "mock";
  console.warn("[firebase] config still contains 'MOCK' placeholders — Firebase is disabled. Update firebase-applet-config.json.");
} else {
  try {
    app = initializeApp(firebaseConfig);
    _auth = getAuth(app);
    // Enable offline IndexedDB cache + multi-tab sync. Falls back silently in browsers without
    // IndexedDB (rare on modern phones / desktops).
    // ignoreUndefinedProperties = true: Firestore otherwise throws on any `undefined` field,
    // which the Scanner save path emits for optional fields (followUp, diagnosisHint, etc.).
    _db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e: any) {
    firebaseConfigStatus = "error";
    console.error("[firebase] initialisation failed", e);
  }
}

// Helpers — non-null exports require Firebase to be configured. Callers should branch on
// firebaseConfigStatus first.
export function getDb(): Firestore {
  if (!_db) throw new Error("Firestore is not initialised. Check firebase-applet-config.json.");
  return _db;
}
export function getAuthSafe(): Auth {
  if (!_auth) throw new Error("Firebase Auth is not initialised. Check firebase-applet-config.json.");
  return _auth;
}

// Legacy compat exports — keep these named the way the rest of the app already imports them.
export const db = _db as Firestore;
export const auth = _auth as Auth;

// ── Real Firebase Auth (email/password) helpers ──────────────────────────
export interface AuthUserLite {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export function firebaseUserToLite(u: FirebaseUser): AuthUserLite {
  return {
    uid: u.uid,
    email: u.email || "",
    displayName: u.displayName || u.email?.split("@")[0] || "Patient",
    createdAt: u.metadata.creationTime || new Date().toISOString(),
  };
}

export async function fbSignUp(name: string, email: string, password: string): Promise<AuthUserLite> {
  if (firebaseConfigStatus !== "ok") throw new Error("FIREBASE_NOT_CONFIGURED");
  const cred = await createUserWithEmailAndPassword(getAuthSafe(), email.trim(), password);
  if (name?.trim()) {
    try { await updateProfile(cred.user, { displayName: name.trim() }); } catch { /* non-fatal */ }
  }
  return firebaseUserToLite(cred.user);
}

export async function fbSignIn(email: string, password: string): Promise<AuthUserLite> {
  if (firebaseConfigStatus !== "ok") throw new Error("FIREBASE_NOT_CONFIGURED");
  const cred = await signInWithEmailAndPassword(getAuthSafe(), email.trim(), password);
  return firebaseUserToLite(cred.user);
}

export async function fbSignInWithGoogle(): Promise<AuthUserLite> {
  if (firebaseConfigStatus !== "ok") throw new Error("FIREBASE_NOT_CONFIGURED");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(getAuthSafe(), provider);
  return firebaseUserToLite(cred.user);
}

export async function fbSignOut(): Promise<void> {
  if (firebaseConfigStatus !== "ok") return;
  await authSignOut(getAuthSafe()).catch(() => {});
}

export function onAuthChange(cb: (u: AuthUserLite | null) => void): () => void {
  if (firebaseConfigStatus !== "ok") {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(getAuthSafe(), (u) => cb(u ? firebaseUserToLite(u) : null));
}
