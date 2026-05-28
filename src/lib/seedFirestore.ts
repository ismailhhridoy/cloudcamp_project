// One-time Firestore seed. Pulled into a separate module so App.tsx can lazy-import it (the
// content is only needed once per project lifetime).

import type {
  DoctorProfile, AuditSample, Certification, ExternalDoctor,
} from "./types.ts";

export function getSeedData() {
  return {
    doctorAccounts: SEED_DOCTOR_ACCOUNTS,
    auditSamples: SEED_AUDIT_SAMPLES,
    certifications: SEED_CERTIFICATIONS,
    // Public doctors directory is no longer seeded — the Doctors page now shows only doctors
    // auto-discovered from real prescription scans.
    publicDoctors: [] as ExternalDoctor[],
  };
}

// ── MBBS auditor demo account (Doctor Portal sign-in) ──────────────────────
const SEED_DOCTOR_ACCOUNTS: DoctorProfile[] = [
  {
    id: "doc_demo_seed",
    fullName: "Dr. Demo Verifier",
    email: "demo@careaid.local",
    bmdcNumber: "A-99999",
    specialty: "General Medicine",
    qualification: "MBBS, FCPS",
    hospital: "CareAid AI Demo Clinic",
    district: "Dhaka",
    yearsExperience: 8,
    approvalStatus: "approved",
    hasUploadedLicense: true,
    appliedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
  },
];

// ── Audit samples and example certification ───────────────────────────────
// These were previously seeded into localStorage by store.ts. Now they live in Firestore as real
// documents so MBBS auditors and the Compliance page work with persistent shared data.
const NOW = new Date().toISOString();
const SEED_AUDIT_SAMPLES: AuditSample[] = [
  {
    id: "sample_001", kind: "triage",
    patientInput: "I have mild fever and headache since yesterday afternoon",
    aiOutput: "Sorry to hear that. Is your temperature above 102°F? Any rash, body aches, or cough?\n\nFor mild fever and headache: rest, hydrate, paracetamol 500 mg if needed (verify dose with a doctor).\n\n**🏠 FIRST-AID AT HOME**\n\n1. Rest and drink fluids.\n2. Paracetamol every 6 hours if fever persists.\n3. Monitor 48 hours. If fever >102°F or rash/severe headache/vomiting, see a doctor.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
    aiSafetyVerdict: "routine", rating: "unrated", sampledAt: NOW,
  },
  {
    id: "sample_002", kind: "triage",
    patientInput: "My 10-month-old baby has high fever 103°F since last night, not feeding well",
    aiOutput: "I understand, this is concerning. Is the baby alert and crying, or unusually sleepy/floppy? Breathing fast? Any rash, vomiting, or seizure?\n\n**🚨 GO TO HOSPITAL NOW**\n\nIn an infant under 1 year, high fever with poor feeding can become serious quickly.\n\n1. Take the baby to the nearest hospital or call 999 immediately.\n2. Keep the baby cool — light clothing, sponging with lukewarm water (never cold).\n3. Bring any medication the baby has had.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
    aiSafetyVerdict: "critical", rating: "unrated", sampledAt: NOW,
  },
  {
    id: "sample_003", kind: "triage",
    patientInput: "আমার বুকে হঠাৎ ব্যথা শুরু হয়েছে, বাঁ হাতে ছড়াচ্ছে",
    aiOutput: "এটি শুনে দুঃখিত। ব্যথা কতক্ষণ ধরে? চাপ চাপ ভাব নাকি ছুরির মতো? ঘাম হচ্ছে বা শ্বাস নিতে কষ্ট হচ্ছে?\n\n**🚨 এখনই হাসপাতালে যান**\n\nবুকে ব্যথা বাঁ হাতে ছড়ালে এটি হার্ট অ্যাটাকের লক্ষণ হতে পারে।\n\n১. এখনই নিকটতম হাসপাতালে যান অথবা ৯৯৯-এ কল করুন।\n২. বসুন বা আধ-শোয়া অবস্থায় থাকুন, কাপড় ঢিলে করুন।\n৩. পরিচিত হার্টের ওষুধ থাকলে সাথে নিন।\n\n⚠️ এটি শুধু AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।",
    aiSafetyVerdict: "critical", rating: "unrated", sampledAt: NOW,
  },
  {
    id: "sample_004", kind: "triage",
    patientInput: "Diarrhea since this morning, 4 times, no blood",
    aiOutput: "Sorry to hear that. Any vomiting, fever, blood in stool, or signs of dehydration (dry mouth, dizziness)?\n\n**🏠 FIRST-AID AT HOME**\n\n1. ORS after every loose motion.\n2. Light foods — rice, banana, plain bread.\n3. If you develop blood in stool, persistent vomiting, high fever, or feel weak, see a doctor.\n\nORS is safe; verify with a licensed doctor before antibiotics or anti-diarrhoeal drugs.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
    aiSafetyVerdict: "routine", rating: "unrated", sampledAt: NOW,
  },
  {
    id: "sample_005", kind: "triage",
    patientInput: "I am pregnant 8 months and have bleeding for 1 hour",
    aiOutput: "I'm very worried — bleeding in late pregnancy needs immediate attention. How much bleeding? Any pain? Is the baby moving as usual?\n\n**🚨 GO TO HOSPITAL NOW**\n\n1. Go to the nearest hospital with a maternity unit immediately, or call 999.\n2. Take a family member, bring your antenatal card.\n3. Lie on your left side while travelling.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
    aiSafetyVerdict: "critical", rating: "unrated", sampledAt: NOW,
  },
  {
    id: "sample_006", kind: "triage",
    patientInput: "Mild dry cough and runny nose for 3 days",
    aiOutput: "Common cold symptoms — usually settles in 5–7 days. Any fever, breathing trouble, or chest pain?\n\n**🏠 FIRST-AID AT HOME**\n\n1. Warm fluids (water, soup, ginger tea).\n2. Steam inhalation 2–3 times a day.\n3. Rest; paracetamol for any fever (verify with doctor, especially for children).\n\nDo NOT take antibiotics for a viral cold. If cough lasts >10 days, fever >102°F, breathing trouble or coloured mucus, see a doctor.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
    aiSafetyVerdict: "routine", rating: "unrated", sampledAt: NOW,
  },
  {
    id: "sample_007", kind: "prescription",
    patientInput: "Prescription scan: Dr. Mahmud, BMDC A-44521 — Internal Medicine",
    aiOutput: "Confidence: 87%\n\nMedicines extracted:\n• Amoxicillin 500 mg — 1 capsule three times daily for 5 days\n• Paracetamol 500 mg — 1 tablet every 6 hours as needed for fever\n• Loratadine 10 mg — 1 tablet at night for 5 days\n\nDoctor's notes: Take amoxicillin with food. Complete the full 5-day course. Drink plenty of fluids.\n\nFollow-up: Return in 1 week if symptoms persist.",
    rating: "unrated", sampledAt: NOW,
  },
  {
    id: "sample_008", kind: "triage",
    patientInput: "I can't sleep and feel hopeless, sometimes think life is not worth it",
    aiOutput: "Thank you for telling me — what you're feeling is real and you are not alone. Have you been feeling this way for more than two weeks? Are you having thoughts of hurting yourself right now?\n\n**🚨 PLEASE TALK TO SOMEONE NOW**\n\n1. Call Kaan Pete Roi mental-health helpline: 9612119911 (Bangla, free).\n2. If you are about to harm yourself, go to the nearest hospital emergency or call 999.\n3. Tell one trusted person (family, friend, neighbour) how you are feeling today.\n\nDepression and suicidal thoughts are medical conditions that respond well to care — please reach out.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
    aiSafetyVerdict: "critical", rating: "unrated", sampledAt: NOW,
  },
];

// Example past certification — gives the Compliance page something to show on first launch.
const SIGNED_AT = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString();
const VALID_UNTIL = new Date(Date.now() + 19 * 24 * 60 * 60 * 1000).toISOString();
const PERIOD = `${new Date(SIGNED_AT).getFullYear()}-${String(new Date(SIGNED_AT).getMonth() + 1).padStart(2, "0")}`;
const SEED_CERTIFICATIONS: Certification[] = [
  {
    id: `cert_seed_${new Date(SIGNED_AT).getTime().toString(36)}`,
    doctorId: "doc_seed_aminul",
    doctorName: "Dr. Aminul Haque",
    doctorBmdc: "A-31207",
    doctorSpecialty: "Internal Medicine",
    periodMonth: PERIOD,
    signedAt: SIGNED_AT,
    validUntil: VALID_UNTIL,
    sampleScores: { total: 8, accurate: 7, needs_revision: 1, unsafe: 0 },
    summaryNotes: "AI triage flow handles common rural complaints well; emergency questioning is appropriate. Minor revision suggested on infant fever advice.",
  },
];
