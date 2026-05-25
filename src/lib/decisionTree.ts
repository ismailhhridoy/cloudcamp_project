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
  critical: "**🚨 GO TO HOSPITAL NOW**",
  urgent: "**⚠️ See a doctor today**",
  mild: "**🏠 FIRST-AID AT HOME**",
};
const HEADER_BN: Record<KbEntry["severity"], string> = {
  critical: "**🚨 এখনই হাসপাতালে যান**",
  urgent: "**⚠️ আজই ডাক্তার দেখান**",
  mild: "**🏠 বাড়িতে প্রাথমিক চিকিৎসা**",
};

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
    `**${lang === "bn" ? "কখন ডাক্তার দেখাবেন:" : "When to see a doctor:"}**`,
    entry.seeDoctor[lang],
  ].join("\n");
}

// First-turn clarifying questions tied to a KB entry id. If a match isn't in this map we fall
// back to a generic onset / severity question.
const CLARIFY_QUESTIONS: Record<string, { en: string; bn: string }> = {
  "fever-adult-mild": { en: "How many days have you had the fever? What is the temperature? Any rash, vomiting, or breathing difficulty?", bn: "কত দিন ধরে জ্বর? তাপমাত্রা কত? র‍্যাশ, বমি বা শ্বাসকষ্ট আছে?" },
  "fever-child-high": { en: "How old is the child? What is the temperature? Are they alert and feeding? Any rash or neck stiffness?", bn: "শিশুর বয়স কত? তাপমাত্রা কত? সচেতন আছে ও খাচ্ছে কি? র‍্যাশ বা ঘাড় শক্ত?" },
  "fever-infant": { en: "How many months old? What is the temperature? Is the baby alert and feeding normally?", bn: "শিশুর বয়স কত মাস? তাপমাত্রা কত? শিশু সচেতন ও স্বাভাবিক খাচ্ছে?" },
  "cold-runny-nose": { en: "How many days? Any fever, ear pain, or thick coloured discharge?", bn: "কত দিন ধরে? জ্বর, কানে ব্যথা, বা ঘন রঙিন শ্লেষ্মা আছে?" },
  "cough-persistent": { en: "How long have you had this cough? Any blood, weight loss, or night sweats?", bn: "কত দিন ধরে কাশি? রক্ত, ওজন কমা, বা রাতে ঘাম আছে?" },
  "headache-mild": { en: "How long does each headache last? On a scale of 1–10 how bad? Anything that brings it on?", bn: "প্রতিবার মাথাব্যথা কতক্ষণ থাকে? ১-১০-এ কত তীব্র? কী কারণে শুরু হয়?" },
  "headache-severe-sudden": { en: "Did it start suddenly like an explosion? Any vomiting, neck stiffness, vision change, or weakness on one side?", bn: "হঠাৎ বিস্ফোরণের মতো শুরু হয়েছে কি? বমি, ঘাড় শক্ত, দৃষ্টি পরিবর্তন, বা এক পাশ দুর্বল?" },
  "diarrhea-adult": { en: "How many loose motions today? Any blood, fever, or signs of dehydration?", bn: "আজ কতবার পাতলা পায়খানা হয়েছে? রক্ত, জ্বর, বা পানিশূন্যতার লক্ষণ আছে?" },
  "chest-pain": { en: "When did the pain start? Is it crushing/pressing or sharp? Does it spread to your arm, jaw, or back? Are you sweating or short of breath?", bn: "ব্যথা কখন শুরু হয়েছে? চাপ-চাপ নাকি ছুরির মতো? হাত, চোয়াল বা পিঠে ছড়াচ্ছে? ঘাম বা শ্বাসকষ্ট আছে?" },
  "stroke": { en: "Is one side of the face drooping? Can the person raise both arms equally? Is their speech slurred? When did it start?", bn: "মুখের এক পাশ বাঁকা? দুই হাত সমানভাবে তুলতে পারছে? কথা জড়াচ্ছে? কখন শুরু হয়েছে?" },
  "breathing-difficulty": { en: "When did it start? Can you speak full sentences? Are your lips or fingertips turning blue?", bn: "কখন শুরু হয়েছে? পুরো বাক্য বলতে পারছেন? ঠোঁট বা আঙুল নীল হয়ে যাচ্ছে?" },
  "asthma-attack": { en: "Have you used your reliever inhaler? How many puffs already? Any change after 10 minutes?", bn: "রিলিভার ইনহেলার ব্যবহার করেছেন? কতবার নিয়েছেন? ১০ মিনিট পর কোনো পরিবর্তন?" },
  "dengue": { en: "How many days of fever? Any pain behind the eyes, joint pain, rash, gum bleeding, or vomiting?", bn: "কত দিন ধরে জ্বর? চোখের পিছনে ব্যথা, জয়েন্টে ব্যথা, র‍্যাশ, মাড়ি দিয়ে রক্ত, বা বমি আছে?" },
  "snake-bite": { en: "Where on the body was the bite? When did it happen? Did you see the snake?", bn: "শরীরের কোথায় কামড়েছে? কখন হয়েছে? সাপটি দেখেছেন?" },
  "pregnancy-bleeding": { en: "How many weeks pregnant? How heavy is the bleeding — spotting or soaking a pad? Any pain?", bn: "কত সপ্তাহ গর্ভবতী? রক্তক্ষরণ কত — সামান্য নাকি প্যাড ভেজানো? ব্যথা আছে?" },
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
