// KB-FIRST router. Designed for low-end devices where a 0.5–1.5B LLM is slow or unstable.
//
// Strategy:
//   1. If online and cloud is allowed, use Groq — best quality, fast.
//   2. Otherwise: try the curated KB (BM25) FIRST. If the top result clears a confidence threshold,
//      return that answer immediately (sub-10ms). The KB is curated, accurate, and bilingual —
//      this is the right answer for the common case on a weak device.
//   3. Only if the KB has no confident match do we engage the LLM tiers (WebLLM → Transformers.js).
//      The LLM acts as the natural-language wrapper for the long tail.
//   4. If all else fails, return a polite "couldn't help" message.

import { getLLMSettings, getLocalLLMState, chatLocal, type LocalChatMessage } from "./llm.ts";
import { getTfState, chatTf, type TfChatMessage } from "./transformersEngine.ts";
import { retrieveWithScore, snippetForPrompt } from "./rag.ts";
import { answerFromTree } from "./decisionTree.ts";
import { classifySymptoms, buildSafetyPromptHint } from "./safety.ts";

export type ChatSource = "cloud" | "kb" | "webllm" | "wasm" | "rules";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  source: ChatSource;
  safety?: { verdict: string; matched: string[] };
  ragHits?: string[];
  kbScore?: number;
}

interface ChatOptions {
  onChunk?: (chunk: string, full: string, source: ChatSource) => void;
  lang: "en" | "bn";
}

// BM25 score threshold above which we trust the KB to answer directly. Tuned for 42 entries +
// short patient inputs. Numbers below this go to the LLM (if available) for free-form handling.
const KB_CONFIDENCE_THRESHOLD = 1.5;

function pickLang(text: string, current: "en" | "bn"): "en" | "bn" {
  if (/[ঀ-৿]/.test(text)) return "bn";
  return /^[\x00-\x7F]+$/.test(text) ? "en" : current;
}

function buildSystemFromRag(snippet: string, lang: "en" | "bn"): string {
  const base = `You are ShasthyoAI, a calm Bangla/English health-triage assistant for rural Bangladesh.
You are NOT a doctor. Follow BMDC and DGHS Telemedicine Guideline 2020 rules:
1. Reply ONLY in ${lang === "bn" ? "Bangla" : "English"}.
2. NEVER name prescription-only medicines (antibiotics, steroids, anti-hypertensives, opioids).
3. For RED-FLAG symptoms ask ONE focused triage question, then issue **GO TO HOSPITAL NOW** /
   **এখনই হাসপাতালে যান** and remind them to call 999.
4. Mention OTC supports (ORS, paracetamol) only for mild cases, paired with "verify dose with a
   licensed doctor".
5. End with: "⚠️ This is AI guidance only. Please consult a real doctor when possible." /
   "⚠️ এটি শুধু AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।"
6. Keep replies under 120 words. Warm, brief.`;
  return snippet ? `${base}\n\n${snippet}` : base;
}

export async function chat(
  history: ChatTurn[],
  userMessage: string,
  opts: ChatOptions
): Promise<ChatResult> {
  const lang = pickLang(userMessage, opts.lang);
  const safety = classifySymptoms(userMessage);

  const settings = getLLMSettings();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  // ── Tier 3: Cloud (online, not force-local) ──────────────────────────────
  if (online && !settings.forceLocal) {
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history }),
      });
      if (res.ok) {
        const data = await res.json();
        opts.onChunk?.(data.text, data.text, "cloud");
        return { text: data.text, source: "cloud", safety: data.safety };
      }
    } catch (e) {
      console.warn("[router] cloud failed, falling back to offline tiers", e);
    }
  }

  // ── KB-first: instant, accurate, bilingual ──────────────────────────────
  // Run RAG. If top result is confident, return KB answer immediately. Otherwise keep snippets
  // for the LLM tiers as grounding context.
  const scored = await retrieveWithScore(userMessage, 3);
  const topScore = scored[0]?.score ?? 0;
  const ragIds = scored.map((s) => s.entry.id);

  if (topScore >= KB_CONFIDENCE_THRESHOLD) {
    const tree = await answerFromTree(userMessage, lang);
    opts.onChunk?.(tree.text, tree.text, "kb");
    return {
      text: tree.text,
      source: "kb",
      safety: { verdict: safety.verdict, matched: safety.matched },
      ragHits: tree.matchedEntryIds,
      kbScore: topScore,
    };
  }

  // ── KB had no confident match — try the LLM tiers with KB snippets as grounding ─
  const ragSnippet = snippetForPrompt(
    scored.map((s) => s.entry),
    lang
  );
  const webllm = getLocalLLMState();
  const tf = getTfState();

  if (webllm.status === "ready") {
    try {
      const sys = buildSystemFromRag(ragSnippet, lang);
      const safetyHint = buildSafetyPromptHint(safety);
      const seed: LocalChatMessage[] = [{ role: "system", content: sys }];
      if (safetyHint) seed.push({ role: "system", content: safetyHint });
      for (const m of history) seed.push({ role: m.role, content: m.content });
      const text = await chatLocal(seed, userMessage, (chunk, full) =>
        opts.onChunk?.(chunk, full, "webllm")
      );
      return {
        text,
        source: "webllm",
        safety: { verdict: safety.verdict, matched: safety.matched },
        ragHits: ragIds,
        kbScore: topScore,
      };
    } catch (e) {
      console.warn("[router] webllm failed, falling back", e);
    }
  }

  if (tf.status === "ready") {
    try {
      const sys = buildSystemFromRag(ragSnippet, lang);
      const safetyHint = buildSafetyPromptHint(safety);
      const seed: TfChatMessage[] = [{ role: "system", content: sys }];
      if (safetyHint) seed.push({ role: "system", content: safetyHint });
      for (const m of history) seed.push({ role: m.role, content: m.content });
      seed.push({ role: "user", content: userMessage });
      const text = await chatTf(seed, (chunk, full) => opts.onChunk?.(chunk, full, "wasm"));
      return {
        text,
        source: "wasm",
        safety: { verdict: safety.verdict, matched: safety.matched },
        ragHits: ragIds,
        kbScore: topScore,
      };
    } catch (e) {
      console.warn("[router] transformers.js failed, falling back", e);
    }
  }

  // ── Last resort: best-effort KB answer even at low confidence + apology ─
  const tree = await answerFromTree(userMessage, lang);
  opts.onChunk?.(tree.text, tree.text, "rules");
  return {
    text: tree.text,
    source: "rules",
    safety: { verdict: safety.verdict, matched: safety.matched },
    ragHits: tree.matchedEntryIds,
    kbScore: topScore,
  };
}
