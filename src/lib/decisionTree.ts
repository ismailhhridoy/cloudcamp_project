// Tier 0 — keyword-driven decision tree over the medical KB.
// Used when no LLM is available (offline + no model loaded). Picks the best matching KB entry
// and returns its advice formatted as a triage answer.

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

export async function answerFromTree(userInput: string, lang: "en" | "bn"): Promise<DecisionResult> {
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
