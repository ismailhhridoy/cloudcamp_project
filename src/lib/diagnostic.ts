// Rule-based multi-factor diagnostic engine. Runs entirely offline (no LLM dependency) so it can
// fire instantly alongside whatever chat tier is answering.
//
// Inputs:
//   - symptom text (latest user message)
//   - patient profile (age, conditions, district)
//   - regional disease snapshot (cached JSON)
//   - retrieved KB entries (BM25)
// Output: risk score + reasoning + factor list + nearest hospital(s).

import { retrieveWithScore, type KbEntry } from "./rag.ts";
import { classifySymptoms } from "./safety.ts";
import { findNearestHospitals, requestGeolocation } from "./distance.ts";
import type {
  DiagnosticResult,
  DiagnosticFactor,
  PatientProfile,
  RegionalDiseaseSnapshot,
  RiskLevel,
} from "./types.ts";

let cachedRegional: RegionalDiseaseSnapshot | null = null;

export async function loadRegional(): Promise<RegionalDiseaseSnapshot> {
  if (cachedRegional) return cachedRegional;
  try {
    const res = await fetch("/regional-disease.json", { cache: "force-cache" });
    if (!res.ok) throw new Error("unreachable");
    cachedRegional = (await res.json()) as RegionalDiseaseSnapshot;
    return cachedRegional;
  } catch {
    cachedRegional = { updatedAt: "", source: "", trends: [] };
    return cachedRegional;
  }
}

function severityBase(s: KbEntry["severity"]): number {
  if (s === "critical") return 75;
  if (s === "urgent") return 50;
  return 25;
}

function riskLevelOf(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

interface RunOpts {
  symptoms: string;
  profile: PatientProfile;
  lang: "en" | "bn";
}

export async function runDiagnostic(opts: RunOpts): Promise<DiagnosticResult> {
  const { symptoms, profile, lang } = opts;
  const regional = await loadRegional();
  const safety = classifySymptoms(symptoms);

  // 1) Match against KB.
  const matches = await retrieveWithScore(symptoms, 3);
  const topEntry = matches[0]?.entry;
  const matchedKbIds = matches.map((m) => m.entry.id);

  let score = topEntry ? severityBase(topEntry.severity) : 20;
  let severity: DiagnosticResult["severity"] = topEntry?.severity || "mild";
  if (safety.verdict === "critical") {
    score = Math.max(score, 75);
    severity = "critical";
  } else if (safety.verdict === "urgent") {
    score = Math.max(score, 50);
    severity = severity === "mild" ? "urgent" : severity;
  }

  const factors: DiagnosticFactor[] = [];
  const reason_parts_en: string[] = [];
  const reason_parts_bn: string[] = [];

  // Symptom factor — show what the patient actually wrote so they can verify the AI heard
  // them correctly. The KB match goes into the "WHO guideline" row below.
  const reported = symptoms.trim().replace(/\s+/g, " ").slice(0, 110);
  const truncated = symptoms.trim().length > 110 ? "…" : "";
  factors.push({
    kind: "symptom",
    label_en: "Symptoms reported",
    label_bn: "জানানো লক্ষণ",
    value_en: reported + truncated,
    value_bn: reported + truncated,
  });
  if (topEntry) {
    reason_parts_en.push(topEntry.title.en.toLowerCase());
    reason_parts_bn.push(topEntry.title.bn);
  }

  // Profile factor + multipliers
  const profileBits_en: string[] = [];
  const profileBits_bn: string[] = [];
  if (profile.age != null) {
    profileBits_en.push(`Age ${profile.age}`);
    profileBits_bn.push(`বয়স ${profile.age}`);
    if (profile.age >= 65) {
      score += 10;
      reason_parts_en.push("age 65+");
      reason_parts_bn.push("৬৫+ বয়স");
    } else if (profile.age < 5) {
      score += 12;
      reason_parts_en.push("young child");
      reason_parts_bn.push("শিশু");
    }
  }
  if (profile.conditions.includes("diabetes")) {
    profileBits_en.push("Diabetic");
    profileBits_bn.push("ডায়াবেটিক");
    score += 12;
    reason_parts_en.push("diabetic profile");
    reason_parts_bn.push("ডায়াবেটিক প্রোফাইল");
  }
  if (profile.conditions.includes("hypertension")) {
    profileBits_en.push("Hypertensive");
    profileBits_bn.push("উচ্চ রক্তচাপ");
    score += 8;
  }
  if (profile.conditions.includes("heart_disease")) {
    profileBits_en.push("Cardiac");
    profileBits_bn.push("হৃদরোগী");
    score += 10;
  }
  if (profile.conditions.includes("pregnancy")) {
    profileBits_en.push("Pregnant" + (profile.pregnancyWeeks ? ` (${profile.pregnancyWeeks}w)` : ""));
    profileBits_bn.push("গর্ভবতী" + (profile.pregnancyWeeks ? ` (${profile.pregnancyWeeks} সপ্তাহ)` : ""));
    score += 10;
    reason_parts_en.push("pregnancy");
    reason_parts_bn.push("গর্ভাবস্থা");
  }
  if (profile.conditions.includes("immunocompromised")) {
    profileBits_en.push("Immunocompromised");
    profileBits_bn.push("কম রোগ প্রতিরোধ");
    score += 8;
  }
  if (profile.conditions.includes("kidney_disease") || profile.conditions.includes("tb_history") || profile.conditions.includes("asthma")) {
    score += 5;
  }
  if (profileBits_en.length > 0) {
    factors.push({
      kind: "profile",
      label_en: "Personal profile",
      label_bn: "ব্যক্তিগত প্রোফাইল",
      value_en: profileBits_en.join(", "),
      value_bn: profileBits_bn.join(", "),
    });
  }

  // Regional factor — if a trending disease in the user's district aligns with their symptoms,
  // boost the risk. This is the "Dhaka has Dengue +14%" signal.
  let regionalMatch: { disease: string; trendPercent: number } | null = null;
  if (profile.district) {
    const trends = regional.trends.filter((t) => t.district === profile.district);
    for (const trend of trends) {
      const symptomMatchesTrend = matches.some((m) =>
        trend.diseaseTags.some((tag) =>
          [...m.entry.tags_en, ...m.entry.tags_bn, m.entry.title.en, m.entry.title.bn]
            .join(" ").toLowerCase()
            .includes(tag.toLowerCase())
        )
      );
      if (symptomMatchesTrend && trend.trendPercent > 0) {
        regionalMatch = { disease: trend.disease, trendPercent: trend.trendPercent };
        score += Math.min(15, Math.round(trend.trendPercent / 2));
        reason_parts_en.push(`${trend.disease} +${trend.trendPercent}% in ${trend.district}`);
        reason_parts_bn.push(`${trend.district}-এ ${trend.disease} +${trend.trendPercent}%`);
        break;
      }
    }
    if (regionalMatch) {
      factors.push({
        kind: "regional",
        label_en: `Regional data (IEDCR)`,
        label_bn: `আঞ্চলিক ডেটা (IEDCR)`,
        value_en: `${profile.district}: +${regionalMatch.trendPercent}% ${regionalMatch.disease} this week`,
        value_bn: `${profile.district}: এই সপ্তাহে ${regionalMatch.disease} +${regionalMatch.trendPercent}%`,
      });
    }
  }

  // Guideline factor — synthesised from the matched KB entry name.
  if (topEntry) {
    const guidelineEn =
      profile.conditions.includes("diabetes") && /dengue|chikungunya|flu/i.test(topEntry.title.en)
        ? `${topEntry.title.en} in diabetic patients — high risk`
        : profile.conditions.includes("pregnancy")
        ? `${topEntry.title.en} in pregnancy — needs supervision`
        : profile.age != null && profile.age < 5
        ? `${topEntry.title.en} in young child — close monitoring`
        : `${topEntry.title.en} — follow standard care`;
    const guidelineBn =
      profile.conditions.includes("diabetes") && /dengue|chikungunya|flu|ডেঙ্গু/.test(topEntry.title.en + topEntry.title.bn)
        ? `ডায়াবেটিক রোগীর ${topEntry.title.bn} — উচ্চ ঝুঁকি`
        : profile.conditions.includes("pregnancy")
        ? `গর্ভাবস্থায় ${topEntry.title.bn} — তদারকি প্রয়োজন`
        : profile.age != null && profile.age < 5
        ? `ছোট শিশুর ${topEntry.title.bn} — কাছ থেকে পর্যবেক্ষণ`
        : `${topEntry.title.bn} — মানক চিকিৎসা অনুসরণ`;
    factors.push({
      kind: "guideline",
      label_en: "WHO / KB guideline",
      label_bn: "WHO / KB নির্দেশিকা",
      value_en: guidelineEn,
      value_bn: guidelineBn,
    });
  }

  // Clamp.
  score = Math.max(5, Math.min(95, Math.round(score)));
  const level = riskLevelOf(score);

  // Time-sensitive warning — tuned to known KB entries.
  let warning_en: string | undefined;
  let warning_bn: string | undefined;
  if (topEntry?.id === "dengue") {
    warning_en = "Risk of platelet drop in 24–48 hours.";
    warning_bn = "২৪-৪৮ ঘন্টার মধ্যে প্লাটিলেট কম হওয়ার ঝুঁকি।";
  } else if (topEntry?.id === "chest-pain") {
    warning_en = "Heart muscle damage is time-dependent — every minute matters.";
    warning_bn = "হৃদপেশীর ক্ষতি সময়-নির্ভর — প্রতি মিনিট গুরুত্বপূর্ণ।";
  } else if (topEntry?.id === "stroke") {
    warning_en = "Treatment within 4.5 hours of onset gives best recovery.";
    warning_bn = "শুরুর ৪.৫ ঘন্টার মধ্যে চিকিৎসায় সবচেয়ে ভালো ফল।";
  } else if (topEntry?.id === "pregnancy-bleeding") {
    warning_en = "Risk to mother and baby — minutes matter.";
    warning_bn = "মা ও শিশুর ঝুঁকি — সময় গুরুত্বপূর্ণ।";
  } else if (topEntry?.id === "snake-bite") {
    warning_en = "Anti-venom is most effective within 4 hours.";
    warning_bn = "৪ ঘন্টার মধ্যে অ্যান্টি-ভেনম সবচেয়ে কার্যকর।";
  }

  // CTA tuned to risk level.
  const cta_en =
    level === "high"
      ? "Go to hospital today"
      : level === "medium"
      ? "See a registered MBBS doctor within 24 hours"
      : "Monitor at home — see a doctor if symptoms worsen";
  const cta_bn =
    level === "high"
      ? "আজই হাসপাতালে যান"
      : level === "medium"
      ? "২৪ ঘন্টার মধ্যে নিবন্ধিত MBBS ডাক্তার দেখান"
      : "বাড়িতে পর্যবেক্ষণ করুন — অবস্থা খারাপ হলে ডাক্তার দেখান";

  // Nearest hospital with capability requirements.
  let geo: { lat: number; lng: number } | null = null;
  try {
    // Don't block diagnostic on geolocation prompt — quick attempt only.
    geo = await Promise.race([
      requestGeolocation(3000),
      new Promise<null>((r) => setTimeout(() => r(null), 3500)),
    ]);
  } catch {
    geo = null;
  }
  const nearestHospitals = await findNearestHospitals({
    userLat: geo?.lat,
    userLng: geo?.lng,
    district: profile.district,
    needEmergency: level !== "low",
    needCardiac: topEntry?.id === "chest-pain",
    needStrokeUnit: topEntry?.id === "stroke",
    needObstetric: topEntry?.id === "pregnancy-bleeding",
    topN: 3,
  });

  // Build reason paragraphs.
  const reason_en = reason_parts_en.length
    ? reason_parts_en.join(" + ") + "."
    : "Symptoms recorded; risk assessed at " + score + "%.";
  const reason_bn = reason_parts_bn.length
    ? reason_parts_bn.join(" + ") + "।"
    : `উপসর্গ নথিভুক্ত; ঝুঁকি অনুমান ${score}%।`;

  return {
    riskScore: score,
    riskLevel: level,
    severity,
    reason_en,
    reason_bn,
    warning_en,
    warning_bn,
    factors,
    cta_en,
    cta_bn,
    matchedKbIds,
    nearestHospitals,
  };
}
