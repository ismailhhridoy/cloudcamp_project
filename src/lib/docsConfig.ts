// Access control + content config for the /docs pitch-deck + technical-documentation module.
//
// Visibility model:
//   - `enabled`: master ON/OFF switch (admin toggle).
//   - `startISO` / `endISO`: scheduled public window. Outside this window /docs shows "Not
//     Available" unless the viewer is an admin.
//   - Default window: June 10 2026 00:00 → June 14 2026 23:59 (the judging window).
//   - Admins always see /docs regardless of window, and can edit everything inline.
//
// Persistence: localStorage (instant, offline-friendly). Mirrored to Firestore `appState/docs`
// when signed in so the schedule survives across devices/judges.

// Bump this key whenever the default window changes — it forces every browser (including the
// live Render site) to drop any stale saved config and pick up the new default. Critical because
// the config lives in per-browser localStorage and does NOT propagate between visitors.
const CONFIG_KEY = "shasthyo_docs_config_v2";
const ADMIN_KEY = "shasthyo_docs_admin_v1";
// Shared admin unlock secret — visit /docs?admin=<this> once to unlock the admin panel on a
// device. Hackathon-grade gating (not a real auth boundary).
export const ADMIN_SECRET = "careaid2026";

export interface TeamMember {
  name: string;
  role: string;
  email: string;
  photoUrl?: string;   // optional; falls back to an initials avatar
  isNRB?: boolean;     // non-resident Bangladeshi (submission scoring)
  isFemale?: boolean;
}

export interface DocsConfig {
  enabled: boolean;
  startISO: string;
  endISO: string;
  teamName: string;
  team: TeamMember[];
  updatedAt: string;
}

// Default public window. Opens NOW (well before judging) and runs through the end of June so the
// site is publicly live immediately for everyone — not just the admin's own browser. The strict
// judging window (June 10 → June 14) can be set anytime from the admin panel; this default just
// makes sure /docs isn't dark for visitors before then.
const DEFAULT_START = new Date(2026, 4, 1, 0, 0, 0).toISOString();    // May 1 2026 (month 4 = May)
const DEFAULT_END = new Date(2026, 5, 30, 23, 59, 59).toISOString();  // June 30 2026 23:59

export const DEFAULT_CONFIG: DocsConfig = {
  enabled: true,
  startISO: DEFAULT_START,
  endISO: DEFAULT_END,
  teamName: "Team CareAid AI",
  team: [
    { name: "Add your name", role: "Founder / Full-stack", email: "you@example.com", isNRB: false, isFemale: false },
  ],
  updatedAt: new Date().toISOString(),
};

export function getDocsConfig(): DocsConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export function saveDocsConfig(patch: Partial<DocsConfig>): DocsConfig {
  const merged = { ...getDocsConfig(), ...patch, updatedAt: new Date().toISOString() };
  try { window.localStorage.setItem(CONFIG_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  return merged;
}

// ── Admin unlock ────────────────────────────────────────────────────────────
export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(ADMIN_KEY) === "1"; } catch { return false; }
}

// Call on /docs load: if ?admin=<secret> is present, unlock admin on this device.
export function maybeUnlockAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const key = params.get("admin");
  if (key === ADMIN_SECRET) {
    try { window.localStorage.setItem(ADMIN_KEY, "1"); } catch { /* ignore */ }
    return true;
  }
  return isAdmin();
}

export function lockAdmin(): void {
  try { window.localStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ }
}

// ── Visibility decision ──────────────────────────────────────────────────────
export interface Visibility {
  visible: boolean;
  reason: "admin" | "in_window" | "disabled" | "before_window" | "after_window";
  startISO: string;
  endISO: string;
}

export function getVisibility(config: DocsConfig, admin: boolean): Visibility {
  const base = { startISO: config.startISO, endISO: config.endISO };
  if (admin) return { visible: true, reason: "admin", ...base };
  if (!config.enabled) return { visible: false, reason: "disabled", ...base };
  const now = Date.now();
  const start = new Date(config.startISO).getTime();
  const end = new Date(config.endISO).getTime();
  if (now < start) return { visible: false, reason: "before_window", ...base };
  if (now > end) return { visible: false, reason: "after_window", ...base };
  return { visible: true, reason: "in_window", ...base };
}
