// Phase 2 — doctor verification & co-sign types.
// Shape is intentionally close to what Firestore documents will look like, so the localStorage
// adapter in `store.ts` can be replaced with the real Firestore SDK with minimal churn.

export type ApprovalStatus = "pending_admin" | "approved" | "rejected";

export interface DoctorProfile {
  id: string;
  fullName: string;
  email?: string;
  bmdcNumber: string;
  specialty: string;
  qualification: string;
  hospital: string;
  district: string;
  yearsExperience: number;
  approvalStatus: ApprovalStatus;
  hasUploadedLicense: boolean;
  appliedAt: string;
  approvedAt?: string;
  rejectedReason?: string;
}

// AI behaviour samples that MBBS auditors review during a periodic certification.
// Samples are seeded with representative dialogues; in production the server would also push
// real anonymised production outputs into this collection on a sampling cadence.

export type AuditKind = "triage" | "prescription";
export type AuditRating = "unrated" | "accurate" | "needs_revision" | "unsafe";

export interface AuditSample {
  id: string;
  kind: AuditKind;
  patientInput: string;
  aiOutput: string;
  aiSafetyVerdict?: "critical" | "urgent" | "routine";
  rating: AuditRating;
  reviewerNotes?: string;
  ratedByDoctorId?: string;
  ratedByDoctorName?: string;
  ratedByDoctorBmdc?: string;
  ratedAt?: string;
  sampledAt: string;
}

// Prescription extraction — schema returned by /api/scan-prescription.

export interface DoseSchedule {
  morning: number;   // count of units (tablets, ml)
  noon: number;
  night: number;
  before_food?: boolean;
  after_food?: boolean;
  notes?: string;    // e.g. "with warm water"
}

export interface ExtractedMedicine {
  name: string;
  generic?: string;
  strength?: string;          // e.g. "500 mg"
  form?: string;              // tablet, syrup, capsule, drops, injection
  schedule: DoseSchedule;
  duration?: string;          // e.g. "5 days"
  purpose_english?: string;
  purpose_bangla?: string;
  warnings?: string;
}

export interface ExtractedDoctor {
  name?: string;
  bmdc?: string;
  hospital?: string;
  specialization?: string;
}

export interface ExtractedPrescription {
  doctor: ExtractedDoctor;
  patient_age?: string;
  patient_sex?: string;
  chief_complaint?: string;
  diagnosis_hint?: string;
  medicines: ExtractedMedicine[];
  tests?: string[];
  follow_up?: string;
  patient_notes?: string;
  confidence: number;                          // 0–100
  legibility_score: number;                    // 1–5  (1 illegible, 5 perfectly readable)
  legibility_reason: string;
  nutrition_guidelines: string[];              // each item is a short bilingual-or-EN bullet
  nutrition_guidelines_bn?: string[];          // same bullets in Bangla
  provider: "gemini" | "groq";                 // which model produced this
}

// Per-doctor aggregated AI legibility from scans, keyed by BMDC number.
export interface LegibilityRecord {
  bmdc: string;
  doctorName?: string;
  scoreSum: number;
  scoreCount: number;
  avgScore: number;
  worstReason?: string;
  lastUpdated: string;
}

// A signed periodic certification. One per doctor per month.
export interface Certification {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorBmdc: string;
  doctorSpecialty: string;
  periodMonth: string; // ISO-ish "YYYY-MM"
  signedAt: string;
  validUntil: string;  // signedAt + ~31 days
  sampleScores: {
    total: number;
    accurate: number;
    needs_revision: number;
    unsafe: number;
  };
  summaryNotes?: string;
}
