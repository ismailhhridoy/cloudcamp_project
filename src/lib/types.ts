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
