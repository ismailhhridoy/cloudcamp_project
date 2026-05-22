// Consent storage utility. Version-bumped so material policy changes can re-prompt.

export const CONSENT_KEY = "shasthyo_consent_v1";

export interface ConsentRecord {
  acceptedAt: string;
  version: number;
  acknowledgements: {
    aiNotDoctor: boolean;
    doctorVerification: boolean;
    dataHandling: boolean;
    emergencyDisclaimer: boolean;
  };
}

export function getConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as ConsentRecord) : null;
  } catch {
    return null;
  }
}

export function saveConsent(record: ConsentRecord): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
}

export function clearConsent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONSENT_KEY);
}
