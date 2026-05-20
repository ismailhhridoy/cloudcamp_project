// Shared red-flag classifier + medicine-name scrubber.
// Used server-side to harden AI output; can also be imported client-side for offline path.

export type SafetyVerdict = "critical" | "urgent" | "routine";

export interface SafetyResult {
  verdict: SafetyVerdict;
  matched: string[];
  reason_en: string;
  reason_bn: string;
}

// Critical = "no AI medicine recommendation allowed, must see a licensed MBBS doctor immediately"
// Patterns are lowercase substrings; Bangla and English mixed.
const CRITICAL_PATTERNS: { keyword: string; tag: string }[] = [
  { keyword: "chest pain", tag: "cardiac" },
  { keyword: "heart attack", tag: "cardiac" },
  { keyword: "বুকে ব্যথা", tag: "cardiac" },
  { keyword: "হার্ট অ্যাটাক", tag: "cardiac" },
  { keyword: "stroke", tag: "neuro" },
  { keyword: "স্ট্রোক", tag: "neuro" },
  { keyword: "can't breathe", tag: "respiratory" },
  { keyword: "cannot breathe", tag: "respiratory" },
  { keyword: "shortness of breath", tag: "respiratory" },
  { keyword: "breathing difficulty", tag: "respiratory" },
  { keyword: "শ্বাসকষ্ট", tag: "respiratory" },
  { keyword: "শ্বাস নিতে পারছি না", tag: "respiratory" },
  { keyword: "unconscious", tag: "neuro" },
  { keyword: "fainted", tag: "neuro" },
  { keyword: "অজ্ঞান", tag: "neuro" },
  { keyword: "জ্ঞান হারিয়ে", tag: "neuro" },
  { keyword: "severe bleeding", tag: "trauma" },
  { keyword: "heavy bleeding", tag: "trauma" },
  { keyword: "প্রচুর রক্ত", tag: "trauma" },
  { keyword: "রক্তপাত", tag: "trauma" },
  { keyword: "seizure", tag: "neuro" },
  { keyword: "convulsion", tag: "neuro" },
  { keyword: "খিঁচুনি", tag: "neuro" },
  { keyword: "severe pain", tag: "general" },
  { keyword: "তীব্র ব্যথা", tag: "general" },
  { keyword: "poison", tag: "tox" },
  { keyword: "overdose", tag: "tox" },
  { keyword: "বিষ", tag: "tox" },
  { keyword: "ওভারডোজ", tag: "tox" },
  { keyword: "infant fever", tag: "pediatric" },
  { keyword: "baby fever", tag: "pediatric" },
  { keyword: "শিশু জ্বর", tag: "pediatric" },
  { keyword: "বাচ্চার জ্বর", tag: "pediatric" },
  { keyword: "pregnancy bleeding", tag: "obstetric" },
  { keyword: "pregnant bleeding", tag: "obstetric" },
  { keyword: "গর্ভবতী রক্ত", tag: "obstetric" },
  { keyword: "suicide", tag: "psych" },
  { keyword: "kill myself", tag: "psych" },
  { keyword: "আত্মহত্যা", tag: "psych" },
  { keyword: "anaphylaxis", tag: "allergic" },
  { keyword: "allergic reaction", tag: "allergic" },
  { keyword: "এলার্জি", tag: "allergic" },
  { keyword: "burn", tag: "trauma" },
  { keyword: "পোড়া", tag: "trauma" },
];

const URGENT_PATTERNS = [
  "high fever",
  "vomiting blood",
  "blood in stool",
  "rash spreading",
  "persistent vomiting",
  "উচ্চ জ্বর",
  "রক্ত বমি",
  "মলে রক্ত",
];

export function classifySymptoms(text: string): SafetyResult {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const p of CRITICAL_PATTERNS) {
    if (lower.includes(p.keyword)) matched.push(p.keyword);
  }
  if (matched.length > 0) {
    return {
      verdict: "critical",
      matched,
      reason_en:
        "Your symptoms suggest a potentially life-threatening condition. AI cannot prescribe medicines for this. Please see a registered MBBS doctor or go to the nearest hospital NOW.",
      reason_bn:
        "আপনার লক্ষণ জীবনের ঝুঁকির ইঙ্গিত দিচ্ছে। AI এই অবস্থায় ওষুধ সুপারিশ করতে পারে না। অনুগ্রহ করে অবিলম্বে একজন নিবন্ধিত MBBS ডাক্তার দেখান অথবা নিকটতম হাসপাতালে যান।",
    };
  }

  for (const k of URGENT_PATTERNS) {
    if (lower.includes(k)) matched.push(k);
  }
  if (matched.length > 0) {
    return {
      verdict: "urgent",
      matched,
      reason_en:
        "These symptoms need a doctor's review within 24 hours. AI guidance is not enough — please consult a licensed MBBS doctor.",
      reason_bn:
        "এই লক্ষণগুলো ২৪ ঘণ্টার মধ্যে ডাক্তার দেখানো দরকার। AI পরামর্শ যথেষ্ট নয় — অনুগ্রহ করে একজন নিবন্ধিত MBBS ডাক্তার দেখান।",
    };
  }

  return { verdict: "routine", matched, reason_en: "", reason_bn: "" };
}

// Common medicine name fragments we never want the AI to autonomously suggest in a critical context.
// This is a guard, not a comprehensive list. It intentionally errs on the side of stripping.
const MEDICINE_FRAGMENTS = [
  "mg", "tablet", "capsule", "syrup", "injection", "iv", "im", "paracetamol", "acetaminophen",
  "ibuprofen", "aspirin", "amoxicillin", "azithromycin", "ciprofloxacin", "metformin",
  "atenolol", "amlodipine", "losartan", "omeprazole", "ranitidine", "metronidazole",
  "cetirizine", "diclofenac", "naproxen", "prednisolone", "salbutamol", "albuterol",
  "warfarin", "heparin", "insulin", "diazepam", "alprazolam", "tramadol", "morphine",
  "নাপা", "প্যারাসিটামল", "অ্যামক্সিসিলিন", "অ্যাজিথ্রোমাইসিন",
];

// Strip lines that look like prescription instructions (dose patterns like "500mg twice daily").
export function scrubMedicines(text: string): { scrubbed: string; removed: number } {
  let removed = 0;
  const lines = text.split(/\n/);
  const kept: string[] = [];

  const dosePattern = /\b\d+\s?(mg|ml|mcg|gm|g|iu)\b/i;
  const freqPattern = /\b(once|twice|thrice|every\s+\d+\s*hour|three\s+times|two\s+times)\b/i;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasDose = dosePattern.test(line) || freqPattern.test(line);
    const hasMedName = MEDICINE_FRAGMENTS.some((m) => lower.includes(m.toLowerCase()));
    if (hasDose && hasMedName) {
      removed += 1;
      continue;
    }
    kept.push(line);
  }

  return { scrubbed: kept.join("\n"), removed };
}

// Build a prompt-injection system message based on the safety verdict. The LLM stays in charge
// of the conversation; this hint just steers tone and required behaviors.
export function buildSafetyPromptHint(safety: SafetyResult): string | null {
  if (safety.verdict === "routine") return null;

  if (safety.verdict === "critical") {
    return [
      `[SAFETY PRE-SCREEN — verdict: CRITICAL. matched keywords: ${safety.matched.join(", ")}]`,
      "This patient input may indicate a life-threatening situation. Behave like an experienced triage nurse on the phone:",
      "1. Stay calm and warm, in the patient's language.",
      "2. Ask 1–2 SHORT, SPECIFIC emergency triage questions to narrow the danger (e.g. for chest pain: onset, character, radiation to arm/jaw, sweating, breathing; for breathing trouble: onset, ability to speak full sentences, lips/finger color; for unconsciousness: how long, breathing now, recent injury/medication; for stroke signs: face/arm/speech onset; for severe bleeding: source, soaking through dressing; for infant fever: age, temperature, lethargy/feeding; for pregnancy: weeks, bleeding amount, pain location; for poisoning: substance, time, current state).",
      "3. After the patient answers — or if they already gave enough detail — give a firm, ONE-line verdict in bold ending with **GO TO HOSPITAL NOW** / **এখনই হাসপাতালে যান** and tell them to call 999 if they cannot reach a hospital.",
      "4. Give 2 practical immediate steps appropriate to the symptom (e.g. sit/lie down, loosen clothing, chew aspirin ONLY if you previously took one for known heart disease — otherwise no medicines).",
      "5. NEVER name prescription-only medicines (antibiotics, blood pressure meds, opioids, psychiatric drugs). NEVER suggest dosages for this critical episode.",
      "Do NOT respond with a generic 'see a doctor' disclaimer first — the patient needs you to engage, ask, and decide quickly.",
    ].join("\n");
  }

  // urgent
  return [
    `[SAFETY PRE-SCREEN — verdict: URGENT. matched keywords: ${safety.matched.join(", ")}]`,
    "Treat this as a serious but not immediately life-threatening situation.",
    "1. Ask at most 1 focused clarifying question to confirm severity.",
    "2. Then advise the patient to see a registered MBBS doctor within 24 hours — sooner if symptoms worsen.",
    "3. Do NOT recommend prescription medicines, antibiotics, or steroids. Only safe OTC supportive measures (ORS, paracetamol for fever) are allowed and must be paired with 'verify with a licensed doctor before taking'.",
  ].join("\n");
}

export function buildCriticalReferralResponse(reason_en: string, reason_bn: string): string {
  return [
    "**🚨 REFER TO A LICENSED MBBS DOCTOR — DO NOT SELF-MEDICATE**",
    "",
    reason_en,
    "",
    "**Immediate steps:**",
    "1. Call your nearest hospital or an ambulance (national: 999 in Bangladesh).",
    "2. Do NOT take any medicine that has not been prescribed for this specific episode.",
    "3. If possible, bring any past prescriptions, current medicines, and a relative who can describe symptoms.",
    "",
    "---",
    "",
    "**🚨 নিবন্ধিত MBBS ডাক্তার দেখান — নিজে ওষুধ খাবেন না**",
    "",
    reason_bn,
    "",
    "**এখনই করণীয়:**",
    "১. নিকটতম হাসপাতালে অথবা অ্যাম্বুলেন্সে কল করুন (জাতীয় নম্বর: ৯৯৯)।",
    "২. এই সমস্যার জন্য যে ওষুধ লেখা নেই, সেটি খাবেন না।",
    "৩. সম্ভব হলে পুরোনো প্রেসক্রিপশন, বর্তমান ওষুধ এবং সাথে একজন আত্মীয় নিন যিনি লক্ষণ বলতে পারবেন।",
    "",
    "⚠️ This response was generated by automated safety rules because your symptoms appear critical. AI guidance alone is not enough. / এই বার্তাটি স্বয়ংক্রিয় সতর্কতা নিয়ম থেকে তৈরি, কারণ আপনার লক্ষণ গুরুতর। শুধু AI পরামর্শ যথেষ্ট নয়।",
  ].join("\n");
}
