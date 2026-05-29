// Tier 0 — keyword-driven decision tree over the medical KB.
// Used when no LLM is available (offline + no model loaded). On the first turn we always ask
// 1–2 clarifying questions before delivering a verdict. On subsequent turns we deliver the
// KB-grounded advice.

import { retrieve, type KbEntry } from "./rag.ts";

export interface DecisionResult {
  text: string;
  matchedEntryIds: string[];
  severity: "mild" | "urgent" | "critical";
}

const HEADER_EN: Record<KbEntry["severity"], string> = {
  critical: "**🚨 EMERGENCY: GO TO THE NEAREST HOSPITAL IMMEDIATELY**",
  urgent: "**⚠️ MEDICAL EVALUATION REQUIRED TODAY**",
  mild: "**🏠 REST & SUPPORTIVE FIRST-AID AT HOME**",
};
const HEADER_BN: Record<KbEntry["severity"], string> = {
  critical: "**🚨 জরুরি অবস্থা: অবিলম্বে নিকটস্থ হাসপাতালে যান**",
  urgent: "**⚠️ আজই ডাক্তারের পরামর্শ নিন**",
  mild: "**🏠 বাড়িতে প্রাথমিক পরিচর্যা ও পর্যবেক্ষণ**",
};

// The seeDoctor label is severity-aware: critical/urgent use emergency wording, but a mild entry
// (e.g. "consult if fever lasts >3 days") would be over-stated by "emergency" framing, so it gets
// the calmer "When to see a doctor" label.
function seeDoctorLabel(severity: KbEntry["severity"], lang: "en" | "bn"): string {
  if (severity === "mild") {
    return lang === "bn" ? "কখন ডাক্তার দেখাবেন:" : "When to see a doctor:";
  }
  return lang === "bn" ? "কখন অবিলম্বে জরুরি বিভাগে যাবেন:" : "When to seek immediate emergency care:";
}

function formatEntry(entry: KbEntry, lang: "en" | "bn"): string {
  const header = (lang === "bn" ? HEADER_BN : HEADER_EN)[entry.severity];
  return [
    `**${entry.title[lang]}**`,
    "",
    entry.summary[lang],
    "",
    header,
    "",
    entry.advice[lang],
    "",
    `**${seeDoctorLabel(entry.severity, lang)}**`,
    entry.seeDoctor[lang],
  ].join("\n");
}

// First-turn clarifying questions tied to a KB entry id. If a match isn't in this map we fall
// back to a generic onset / severity question.
const CLARIFY_QUESTIONS: Record<string, { en: string; bn: string }> = {
  "fever-adult-mild": { en: "How many days has the fever lasted? Is the temperature above 102°F? Are you experiencing an unexplained rash, persistent vomiting, or any chest discomfort/breathing issues?", bn: "জ্বর কতদিন ধরে? তাপমাত্রা কি ১০২°F এর বেশি? শরীরে কোনো র‍্যাশ, ক্রমাগত বমি, বা বুকে ব্যথা/শ্বাসকষ্ট আছে কি?" },
  "fever-child-high": { en: "How old is the child? What is the temperature? Are they alert and feeding? Any rash or neck stiffness?", bn: "শিশুর বয়স কত? তাপমাত্রা কত? সচেতন আছে ও খাচ্ছে কি? র‍্যাশ বা ঘাড় শক্ত?" },
  "fever-infant": { en: "How many months old? What is the temperature? Is the baby alert and feeding normally?", bn: "শিশুর বয়স কত মাস? তাপমাত্রা কত? শিশু সচেতন ও স্বাভাবিক খাচ্ছে?" },
  "cold-runny-nose": { en: "How many days? Any fever, ear pain, or thick coloured discharge?", bn: "কত দিন ধরে? জ্বর, কানে ব্যথা, বা ঘন রঙিন শ্লেষ্মা আছে?" },
  "cough-persistent": { en: "How long have you had this cough? Any blood, weight loss, or night sweats?", bn: "কত দিন ধরে কাশি? রক্ত, ওজন কমা, বা রাতে ঘাম আছে?" },
  "headache-mild": { en: "How long does each headache last? On a scale of 1–10 how bad? Anything that brings it on?", bn: "প্রতিবার মাথাব্যথা কতক্ষণ থাকে? ১-১০-এ কত তীব্র? কী কারণে শুরু হয়?" },
  "headache-severe-sudden": { en: "Did it start suddenly like an explosion? Any vomiting, neck stiffness, vision change, or weakness on one side?", bn: "হঠাৎ বিস্ফোরণের মতো শুরু হয়েছে কি? বমি, ঘাড় শক্ত, দৃষ্টি পরিবর্তন, বা এক পাশ দুর্বল?" },
  "diarrhea-adult": { en: "Are there signs of blood or mucus in the stool? Do you have a high fever? How many hours has it been since you last urinated?", bn: "মলে কি রক্ত বা আমাশয়ের লক্ষণ আছে? তীব্র জ্বর আছে কি? শেষ কত ঘণ্টা আগে প্রস্রাব হয়েছে?" },
  "chest-pain": { en: "Is the pain a crushing or heavy sensation? Does it radiate to your left arm, jaw, or back? Are you experiencing cold sweating, nausea, or shortness of breath?", bn: "ব্যথাটি কি বুকে ভারী চাপ বা মোচড় দেওয়ার মতো অনুভূত হচ্ছে? এটি কি বাম হাত, চোয়াল বা পিঠে ছড়িয়ে পড়ছে? সাথে অতিরিক্ত ঠান্ডা ঘাম, বমি ভাব বা শ্বাসকষ্ট আছে?" },
  "stroke": { en: "Is there sudden weakness/numbness on one side of the body? Is the face drooping when smiling? Is speech slurred or difficult to understand?", bn: "শরীরের কোনো এক পাশ কি হঠাৎ দুর্বল বা অবশ হয়ে গেছে? হাসতে গেলে মুখ কি একদিকে বেঁকে যাচ্ছে? কথা কি জড়িয়ে যাচ্ছে বা বলতে কষ্ট হচ্ছে?" },
  "breathing-difficulty": { en: "When did it start? Can you speak full sentences? Are your lips or fingertips turning blue?", bn: "কখন শুরু হয়েছে? পুরো বাক্য বলতে পারছেন? ঠোঁট বা আঙুল নীল হয়ে যাচ্ছে?" },
  "asthma-attack": { en: "Have you used your reliever inhaler? How many puffs already? Any change after 10 minutes?", bn: "রিলিভার ইনহেলার ব্যবহার করেছেন? কতবার নিয়েছেন? ১০ মিনিট পর কোনো পরিবর্তন?" },
  "dengue": { en: "How many days of fever? Any pain behind the eyes, joint pain, rash, gum bleeding, or vomiting?", bn: "কত দিন ধরে জ্বর? চোখের পিছনে ব্যথা, জয়েন্টে ব্যথা, র‍্যাশ, মাড়ি দিয়ে রক্ত, বা বমি আছে?" },
  "snake-bite": { en: "What time did the bite occur? Is the affected limb being kept completely still and positioned below heart level? Are there symptoms like droopy eyelids or difficulty swallowing?", bn: "সাপ কখন কামড়েছে? আক্রান্ত অঙ্গটি কি সম্পূর্ণ নাড়াচড়া না করে হার্টের স্তরের নিচে রাখা হয়েছে? চোখের পাতা নেমে আসা বা গিলতে কোনো সমস্যা হচ্ছে?" },
  "pregnancy-bleeding": { en: "How many weeks pregnant? How heavy is the bleeding — spotting or soaking a pad? Any pain?", bn: "কত সপ্তাহ গর্ভবতী? রক্তক্ষরণ কত — সামান্য নাকি প্যাড ভেজানো? ব্যথা আছে?" },
  // Newly added rural-BD protocols.
  "postpartum-bleeding": { en: "How long since delivery? How many pads soaked per hour? Is she dizzy, pale, or fainting?", bn: "প্রসবের কতক্ষণ পর? এক ঘণ্টায় কতটি প্যাড ভিজছে? মাথা ঘোরা, ফ্যাকাশে বা অজ্ঞান হচ্ছে?" },
  "choking-adult": { en: "Can the person make any sound or cough? How long has the airway been blocked? Is the skin or lips turning blue?", bn: "ব্যক্তি কোনো শব্দ করতে বা কাশতে পারছে? কতক্ষণ ধরে শ্বাসনালী বন্ধ? চামড়া বা ঠোঁট নীল হচ্ছে?" },
  "choking-infant": { en: "How old is the baby? Was the baby eating or playing with a small object? Is the baby making any sound, or turning blue?", bn: "শিশুর বয়স কত? খাচ্ছিল বা ছোট কোনো বস্তু নিয়ে খেলছিল? শিশু কোনো শব্দ করছে, নাকি নীল হয়ে যাচ্ছে?" },
  "food-poisoning": { en: "What did you eat in the last 48 hours? How many people who ate the same food are sick? Any blood in stool, high fever, or fainting?", bn: "গত ৪৮ ঘণ্টায় কী খেয়েছেন? একই খাবার খেয়ে আর কতজন অসুস্থ? পায়খানায় রক্ত, উচ্চ জ্বর, বা অজ্ঞান?" },
  "drowning-rescue": { en: "Is the person breathing now? How long were they underwater? Are they conscious and able to talk?", bn: "ব্যক্তি এখন শ্বাস নিচ্ছে? কতক্ষণ পানির নিচে ছিল? সচেতন ও কথা বলতে পারছে?" },
  "tb-suspected": { en: "How many weeks of cough? Any weight loss, evening fever, or night sweats? Any blood in sputum? Anyone in the family being treated for TB?", bn: "কত সপ্তাহ ধরে কাশি? ওজন কমেছে, সন্ধ্যায় জ্বর বা রাতে ঘাম হচ্ছে? কফে রক্ত আছে? পরিবারে কেউ TB-র চিকিৎসা নিচ্ছে?" },
  "meningitis": { en: "Can the person touch chin to chest without pain? Any rash? Are they drowsy or had a seizure? When did the fever and headache start?", bn: "চিবুক বুকে ঠেকাতে পারছেন ব্যথা ছাড়া? কোনো র‍্যাশ? ঘুম-ঘুম ভাব বা খিঁচুনি হয়েছে? জ্বর ও মাথাব্যথা কখন শুরু?" },
  "breastfeeding-trouble": { en: "How old is the baby? How many wet nappies per day? Is one breast red and painful, or just sore? Is the baby gaining weight?", bn: "শিশুর বয়স কত? দিনে কতটি ভেজা ন্যাপি? এক স্তন লাল ও ব্যথাযুক্ত, নাকি শুধু কষ্ট? শিশুর ওজন বাড়ছে?" },
  "newborn-breathing-fast": { en: "How old is the baby in months? Is the chest pulling in below the ribs with each breath? Is the baby feeding normally? Are the lips pink or blue?", bn: "শিশুর বয়স কত মাস? প্রতিটি শ্বাসে বুকের পাটা ভিতরে ঢুকছে? শিশু স্বাভাবিক খাচ্ছে? ঠোঁট গোলাপি না নীল?" },
  "arsenic-poisoning": { en: "How many years have you been using this tubewell? Has the water been tested? Anyone else in the family with skin spots or weakness?", bn: "এই নলকূপ কত বছর ব্যবহার করছেন? পানি পরীক্ষা করানো হয়েছে? পরিবারের আর কারো চামড়ায় দাগ বা দুর্বলতা আছে?" },
  "cholera-watery": { en: "How many loose stools today? Does it look like rice water? Any vomiting? Are the eyes sunken or the urine very low?", bn: "আজ কতবার পাতলা পায়খানা? চালের ধোয়া পানির মতো দেখাচ্ছে? বমি আছে? চোখ বসে গেছে বা প্রস্রাব খুব কম?" },
  "electric-shock": { en: "Is the person breathing now? Is the power switched off and safe to touch? Where on the body was the contact?", bn: "ব্যক্তি এখন শ্বাস নিচ্ছে? পাওয়ার বন্ধ ও ছোঁয়া নিরাপদ? শরীরের কোথায় কারেন্ট লেগেছে?" },
  "head-injury-adult": { en: "Did the person lose consciousness even briefly? Any vomiting, severe headache, confusion, or weakness on one side? How tall was the fall?", bn: "ব্যক্তি অল্প সময়ের জন্যও অজ্ঞান হয়েছে? বমি, তীব্র মাথাব্যথা, বিভ্রান্তি, বা এক পাশ দুর্বল? কত উঁচু থেকে পড়েছে?" },
  "panic-attack-acute": { en: "How long has this been going on? Is this the first time, or has it happened before? Any chest pressure spreading to the arm or jaw?", bn: "কতক্ষণ ধরে চলছে? এই প্রথম, নাকি আগেও হয়েছে? বুকে চাপ হাত বা চোয়ালে ছড়াচ্ছে কি?" },
  "eye-foreign-body": { en: "What went into the eye — dust, eyelash, metal, chemical? Did it splash from a power tool? Has your vision changed?", bn: "চোখে কী পড়েছে — ধুলো, পাপড়ি, ধাতু, কেমিক্যাল? কোনো পাওয়ার যন্ত্র থেকে ছিটেছে? দৃষ্টিতে পরিবর্তন হয়েছে?" },
};

function genericClarify(lang: "en" | "bn"): string {
  return lang === "bn"
    ? "আপনাকে আরো ভালো পরামর্শ দিতে কিছু তথ্য দরকার: কত দিন ধরে এই সমস্যা? অবস্থা ভালো হচ্ছে, একই, না কি খারাপ হচ্ছে? অন্য কোনো লক্ষণ আছে?"
    : "To advise you better I need a bit more detail: how long have you had this? Is it getting better, same, or worse? Any other symptoms?";
}

interface AnswerOpts {
  isFirstTurn?: boolean;
}

export async function answerFromTree(userInput: string, lang: "en" | "bn", opts: AnswerOpts = {}): Promise<DecisionResult> {
  const matches = await retrieve(userInput, 1);
  if (matches.length === 0) {
    return {
      text:
        lang === "bn"
          ? "আপনার লক্ষণের সাথে মেলে এমন তথ্য আমার অফলাইন বইয়ে পেলাম না। অনুগ্রহ করে নিকটতম স্বাস্থ্য কমপ্লেক্সে যান বা ৯৯৯-এ কল করুন।\n\n⚠️ এটি শুধু AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।"
          : "I couldn't match your symptoms to my offline reference. Please visit the nearest health complex or call 999.\n\n⚠️ This is AI guidance only. Please consult a real doctor when possible.",
      matchedEntryIds: [],
      severity: "urgent",
    };
  }
  const top = matches[0];

  // First-turn behaviour: ask 1–2 clarifying questions tied to the matched condition before
  // committing to a verdict. This mirrors the cloud + local LLM tier behaviour so the patient
  // experience stays consistent across tiers.
  if (opts.isFirstTurn) {
    const tailored = CLARIFY_QUESTIONS[top.id];
    const question = tailored ? tailored[lang] : genericClarify(lang);
    const ack = lang === "bn"
      ? `**${top.title.bn}** নিয়ে কথা বলছি। উত্তর দিন যাতে আরো ভালো পরামর্শ দিতে পারি:\n\n${question}`
      : `Looking at this as a possible **${top.title.en}** picture. To advise you better, please answer:\n\n${question}`;
    return {
      text: ack,
      matchedEntryIds: [top.id],
      severity: top.severity,
    };
  }

  const disclaimer =
    lang === "bn"
      ? "\n\n⚠️ এটি AI পরামর্শ ও অফলাইন রেফারেন্স। সম্ভব হলে একজন ডাক্তার দেখান।"
      : "\n\n⚠️ This is AI guidance and an offline reference. Please consult a real doctor when possible.";
  return {
    text: formatEntry(top, lang) + disclaimer,
    matchedEntryIds: [top.id],
    severity: top.severity,
  };
}
