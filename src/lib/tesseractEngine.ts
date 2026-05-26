// Singleton wrapper around tesseract.js — used as the tier-3 offline OCR fallback when the
// Gemini and Groq cloud paths are unavailable (no network / quota exhausted).
//
// Lifecycle mirrors llm.ts and transformersEngine.ts:
//   - status pub/sub + `useTesseract` hook so the UI can show progress and "ready" state
//   - `prefetch()` downloads + caches the WASM core and the eng + ben language packs
//     so a single Settings button (next to the LLM download) gets both engines ready offline
//   - `recognize(dataUrl)` runs OCR with both languages enabled and returns the raw text
//   - `purgeCache()` deletes the cached language packs (used by Settings "Delete")
//
// Why both languages always? Prescriptions in Bangladesh mix Bengali instructions with English
// drug names. Tesseract supports loading multiple languages into a single recognize() call via
// the `eng+ben` syntax — accuracy is better than running each language separately.
//
// Honest caveat: Tesseract is trained on printed text. Doctor handwriting accuracy is low. We
// surface that limitation in the Scanner UI when this path is used.

import { useEffect, useState } from "react";

export type OcrStatus = "idle" | "loading" | "ready" | "error";

export interface OcrState {
  status: OcrStatus;
  progress: number;        // 0–1
  progressText: string;
  error?: string;
  cached: boolean;
}

const LANGS = "eng+ben";
const CACHE_FLAG_KEY = "shasthyo_tesseract_cached_v1";
// Self-hosted tesseract.js core + worker live under `/public/tesseract-core/` and are served
// from our origin (precached by the PWA service worker so they're available offline). The
// `langPath` is intentionally left at tesseract.js v7's default, which points at the working
// jsdelivr CDN — workbox runtime-caches those response so the traineddata is offline-ready
// after the first download.
const CORE_PATH = "/tesseract-core";
const WORKER_PATH = "/tesseract-core/worker.min.js";

let workerRef: any | null = null;

let state: OcrState = {
  status: "idle",
  progress: 0,
  progressText: "",
  cached: typeof window !== "undefined" && window.localStorage.getItem(CACHE_FLAG_KEY) === "1",
};

type Listener = (s: OcrState) => void;
const listeners = new Set<Listener>();

function emit() { for (const l of listeners) l(state); }
function setState(patch: Partial<OcrState>) { state = { ...state, ...patch }; emit(); }

export function getOcrState(): OcrState { return state; }

export function subscribeOcr(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useTesseract(): OcrState {
  const [s, setS] = useState<OcrState>(state);
  useEffect(() => subscribeOcr(setS), []);
  return s;
}

// ── Engine lifecycle ──────────────────────────────────────────────────────
async function ensureWorker(): Promise<any> {
  if (workerRef) return workerRef;
  const Tesseract = await import("tesseract.js");
  // First-time download is heavy (~20MB combined); allow up to 3 minutes before bailing.
  const TIMEOUT_MS = 180_000;
  const create = Tesseract.createWorker(LANGS, undefined, {
    // All paths self-hosted on our origin — the SW precaches these so offline boot works.
    // langPath is left at tesseract.js default (jsdelivr) — the URL I used previously was
    // wrong and silently 404'd, which is what caused the 5-minute hang the user saw.
    corePath: CORE_PATH,
    workerPath: WORKER_PATH,
    logger: (m: { status: string; progress?: number }) => {
      console.log("[ocr]", m.status, typeof m.progress === "number" ? `${Math.round(m.progress * 100)}%` : "");
      setState({
        progress: typeof m.progress === "number" ? m.progress : state.progress,
        progressText: m.status || state.progressText,
      });
    },
    errorHandler: (e: any) => {
      console.error("[ocr] worker error:", e?.message || e);
    },
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("OCR download timed out. Check connection and try again.")), TIMEOUT_MS)
  );

  const w = await Promise.race([create, timeout]);
  // Tune parameters for prescription pages: uniform block of text, preserve spacing so the
  // shaper can split into medicine rows, and blacklist tilde/pipe noise that frequently
  // appears in handwritten output and never belongs in a real medicine name.
  try {
    await w.setParameters({
      // SINGLE_BLOCK ('6') — treat the page as a single uniform block of text, which works
      // best for prescription pads (lines stacked top-to-bottom). The TypeScript types expect
      // the PSM enum; cast via `any` to avoid pulling the full enum import.
      tessedit_pageseg_mode: "6" as any,
      preserve_interword_spaces: "1",
      tessedit_char_blacklist: "~|<>",
      user_defined_dpi: "300",
    });
  } catch (e) {
    console.warn("[ocr] setParameters failed (non-fatal)", e);
  }
  workerRef = w;
  try { window.localStorage.setItem(CACHE_FLAG_KEY, "1"); } catch { /* ignore */ }
  setState({ cached: true });
  return w;
}

// First-time download. After this, the language packs live in IndexedDB and recognize() is
// fully offline.
export async function prefetch(): Promise<void> {
  if (state.status === "loading" || state.status === "ready") return;
  setState({ status: "loading", progress: 0, progressText: "Starting OCR download…", error: undefined });
  try {
    await ensureWorker();
    setState({ status: "ready", progress: 1, progressText: "Ready" });
  } catch (e: any) {
    setState({ status: "error", error: e?.message || String(e) });
    workerRef = null;
    throw e;
  }
}

// Re-create the worker silently on next call if it was terminated.
export async function unload(): Promise<void> {
  try { await workerRef?.terminate?.(); } catch { /* ignore */ }
  workerRef = null;
  setState({ status: "idle", progress: 0, progressText: "" });
}

// Delete cached language packs so the next prefetch downloads them again. The library stores
// them in IndexedDB under the database name "keyval-store" by default.
export async function purgeCache(): Promise<void> {
  await unload();
  try { window.localStorage.removeItem(CACHE_FLAG_KEY); } catch { /* ignore */ }
  setState({ cached: false });
  try {
    if (typeof indexedDB !== "undefined" && "deleteDatabase" in indexedDB) {
      // tesseract.js v5 uses "keyval-store" for the .traineddata cache.
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("keyval-store");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
    }
  } catch (e) {
    console.warn("[ocr] purgeCache: IndexedDB delete failed", e);
  }
}

// ── Image preprocessing ───────────────────────────────────────────────────
// Tesseract accuracy on phone photos of prescriptions improves dramatically with three steps:
//   1. Upscale to ≥1500px on the long edge (Tesseract is trained on 300dpi-equivalent inputs)
//   2. Convert to grayscale
//   3. Binarize with an adaptive threshold (Otsu-style — pick the value that best separates
//      ink from paper). This collapses the colour variation in real photos (yellowed paper,
//      uneven lighting, ink bleed) to clean black-on-white.
//
// The result is encoded back to a PNG data URL and fed to recognize(). For prescriptions
// where the cloud LLM normally wins, this preprocessing is what gives Tesseract a fighting
// chance to read names like "Napa" or "Sergel" through the noise.

async function loadImage(src: string | Blob | File): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for preprocessing"));
    img.src = url;
  });
  return img;
}

function otsuThreshold(histogram: Uint32Array, total: number): number {
  // Standard Otsu — pick the t that maximises between-class variance.
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0, wB = 0, wF = 0, maxVar = 0, threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; threshold = i; }
  }
  return threshold;
}

export async function preprocessForOcr(src: string | Blob | File): Promise<string> {
  const img = await loadImage(src);
  // Upscale so the long edge is at least 1800px — Tesseract is happier with larger inputs.
  const longEdge = Math.max(img.width, img.height);
  const scale = longEdge < 1800 ? Math.min(2.5, 1800 / longEdge) : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const id = ctx.getImageData(0, 0, w, h);
  const px = id.data;
  // First pass: grayscale + histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = px[i + 1] = px[i + 2] = g;
    hist[g]++;
  }
  const total = (px.length / 4) | 0;
  // Bias the threshold slightly so we keep more ink (faint pen strokes survive).
  const t = Math.max(80, otsuThreshold(hist, total) - 15);
  // Second pass: binarize
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] < t ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(id, 0, 0);
  return canvas.toDataURL("image/png");
}

// ── Recognition ───────────────────────────────────────────────────────────
export interface OcrResult {
  text: string;
  confidence: number; // 0–100 average per tesseract
}

export interface RecognizeOptions {
  preprocess?: boolean; // default true
}

export async function recognize(
  image: string | Blob | File,
  opts: RecognizeOptions = {},
): Promise<OcrResult> {
  const w = await ensureWorker();
  if (state.status !== "ready") setState({ status: "ready" });
  let input: string | Blob | File = image;
  if (opts.preprocess !== false) {
    try {
      input = await preprocessForOcr(image);
      console.log("[ocr] preprocessing applied");
    } catch (e) {
      console.warn("[ocr] preprocessing failed, falling back to raw image", e);
    }
  }
  const { data } = await w.recognize(input);
  return {
    text: String(data?.text || "").trim(),
    confidence: typeof data?.confidence === "number" ? data.confidence : 0,
  };
}

// Idempotent — call on app boot. If the user already downloaded the packs once, this rewarms
// the worker so the first recognize() call is fast.
export async function autoLoadIfCached(): Promise<void> {
  if (state.status === "loading" || state.status === "ready") return;
  if (!state.cached) return;
  try { await ensureWorker(); setState({ status: "ready" }); }
  catch (e) { console.warn("[ocr] autoLoadIfCached failed", e); }
}

// ── OCR → ExtractedPrescription ───────────────────────────────────────────
// Tesseract returns raw text. The cloud path (Gemini/Groq) returns structured JSON. To keep
// the Scanner UI unchanged we shape the raw text into the same `ExtractedPrescription` shell.
//
// Scope: PRINTED prescriptions only (computer-generated, pharmacy printouts, lab reports).
// Tesseract on cursive handwriting produces unusable text; the Scanner banner makes that
// limit clear. For printed text the pipeline is:
//   1. Tesseract → clean OCR text
//   2. Local LLM (WebLLM 1.5B or Transformers.js 0.5B) → structured JSON
//   3. Without an LLM → return a text-only shell with the raw OCR in patient_notes

import type { ExtractedPrescription, ExtractedMedicine } from "./types.ts";

// ── Structured parsing prompt for the local LLM ───────────────────────────
// Designed for PRINTED prescriptions where Tesseract output is clean. The LLM's job is just
// to convert that clean text into the structured ExtractedPrescription JSON shape — no drug-
// name memorisation needed, because typed prescriptions already spell drugs correctly.
const OCR_PARSE_SYSTEM = `You parse Bangladesh prescriptions transcribed by OCR into structured JSON.

Input is OCR text from a typed/printed prescription. Treat the text as-is — do NOT correct medicine names you don't recognise.

Output ONLY this JSON object — no prose, no markdown fences:
{
  "doctor": {"name": "Dr. Name", "bmdc": "A-12345", "hospital": "Hospital name", "specialization": "Internal Medicine"},
  "chief_complaint": "patient's complaint or null",
  "diagnosis_hint": "doctor's diagnosis or null",
  "medicines": [
    {"name": "Drug name as written", "strength": "500 mg", "form": "tablet", "schedule": {"morning": 1, "noon": 0, "night": 1, "after_food": true}, "duration": "5 days", "purpose_english": "what it treats", "purpose_bangla": "বাংলায় ব্যবহার"}
  ],
  "tests": ["CBC", "X-ray chest"],
  "follow_up": "Return in 1 week or null",
  "patient_notes": "extra notes or null"
}

Rules:
- Use empty string "" or empty array [] when something isn't in the OCR. Never invent.
- Schedules like "1+0+1" / "1-0-1" mean morning + noon + night counts. "BD"=1+0+1, "TDS"=1+1+1, "OD"=1+0+0.
- Keep medicine names exactly as the OCR has them (don't auto-correct).
- Output the JSON object only. Nothing before, nothing after.`;

interface LlmExtraction {
  doctor?: { name?: string; bmdc?: string; hospital?: string; specialization?: string };
  chief_complaint?: string;
  diagnosis_hint?: string;
  medicines?: Array<{
    name?: string; strength?: string; form?: string;
    schedule?: { morning?: number; noon?: number; night?: number; before_food?: boolean; after_food?: boolean };
    duration?: string; purpose_english?: string; purpose_bangla?: string; warnings?: string;
  }>;
  tests?: string[];
  follow_up?: string;
  patient_notes?: string;
}

// The model sometimes wraps JSON in ```json fences or prefaces it with an apology. Grab the
// first balanced { ... } block so the parse still works.
function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === "{") depth++;
    else if (candidate[i] === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

async function tryLlmParse(ocrText: string): Promise<LlmExtraction | null> {
  const trimmed = ocrText.slice(0, 4000); // keep prompt budget manageable for the small model
  const userMsg = `OCR text from the prescription:\n"""\n${trimmed}\n"""\n\nReturn the JSON object only.`;

  try {
    const tf = await import("./transformersEngine.ts");
    if (tf.isTfReady()) {
      console.log("[ocr] parsing via Transformers.js (single offline LLM tier)");
      const raw = await tf.chatTf([
        { role: "system", content: OCR_PARSE_SYSTEM },
        { role: "user", content: userMsg },
      ]);
      const block = extractJsonBlock(raw);
      if (block) return JSON.parse(block) as LlmExtraction;
      console.warn("[ocr] Transformers.js returned no parseable JSON");
    }
  } catch (e) {
    console.warn("[ocr] Transformers.js parse failed", e);
  }

  return null;
}

// Fallback for the no-LLM case — wrap raw OCR text as a text-only result so the user
// still sees something in the Scanner UI. The Scanner's "used offline OCR" banner already
// explains the limitation; here we just shape the bare minimum to fill ExtractedPrescription.
function shapeRawOcrFallback(ocr: OcrResult): ExtractedPrescription {
  return {
    doctor: { name: undefined, bmdc: undefined, hospital: undefined, specialization: undefined },
    chief_complaint: undefined,
    diagnosis_hint: undefined,
    medicines: [],
    tests: [],
    follow_up: undefined,
    patient_notes: (ocr.text || "").slice(0, 2000),
    confidence: Math.min(30, Math.max(10, Math.round(ocr.confidence || 0))),
    legibility_score: 1,
    legibility_reason:
      "Offline OCR captured raw text only — no Local AI loaded to structure it into medicines/dosage. Download Offline AI in Settings, or read the raw text in the notes below.",
    nutrition_guidelines: [],
    nutrition_guidelines_bn: [],
    provider: "tesseract",
  };
}

// Default export the Scanner calls. Always async — uses the local LLM when available, else
// returns a raw-text shell so users on no-LLM devices still see the OCR result.
export async function shapeOcrToPrescription(ocr: OcrResult): Promise<ExtractedPrescription> {
  const llmResult = await tryLlmParse(ocr.text);
  if (!llmResult) return shapeRawOcrFallback(ocr);

  const meds: ExtractedMedicine[] = (Array.isArray(llmResult.medicines) ? llmResult.medicines : [])
    .slice(0, 15)
    .map((m) => ({
      name: String(m.name || "").trim() || "Unknown",
      strength: m.strength || undefined,
      form: m.form as any || undefined,
      schedule: {
        morning: Number(m.schedule?.morning) || 0,
        noon: Number(m.schedule?.noon) || 0,
        night: Number(m.schedule?.night) || 0,
        before_food: m.schedule?.before_food,
        after_food: m.schedule?.after_food,
      },
      duration: m.duration || undefined,
      purpose_english: m.purpose_english || undefined,
      purpose_bangla: m.purpose_bangla || undefined,
      warnings: m.warnings || undefined,
    }))
    .filter((m) => m.name && m.name !== "Unknown");

  // Confidence + legibility — cap so the offline path never out-claims cloud results.
  const conf = Math.min(75, Math.max(20, Math.round(ocr.confidence || 0) + (meds.length >= 2 ? 10 : 0)));
  const legibility = meds.length >= 2 ? 3 : meds.length === 1 ? 2 : 1;

  return {
    doctor: {
      name: llmResult.doctor?.name || undefined,
      bmdc: llmResult.doctor?.bmdc || undefined,
      hospital: llmResult.doctor?.hospital || undefined,
      specialization: llmResult.doctor?.specialization || undefined,
    },
    chief_complaint: llmResult.chief_complaint || undefined,
    diagnosis_hint: llmResult.diagnosis_hint || undefined,
    medicines: meds,
    tests: Array.isArray(llmResult.tests) ? llmResult.tests.slice(0, 8) : [],
    follow_up: llmResult.follow_up || undefined,
    patient_notes: llmResult.patient_notes || ocr.text.slice(0, 1500),
    confidence: conf,
    legibility_score: legibility,
    legibility_reason:
      "Offline OCR + on-device AI extracted this from a printed prescription. Verify every medicine name and dose with a doctor — the local model is small and can miss details.",
    nutrition_guidelines: [],
    nutrition_guidelines_bn: [],
    provider: "tesseract",
  };
}

// Legacy alias kept so the Scanner.tsx import path doesn't break. Same behaviour.
export const shapeOcrToPrescriptionSmart = shapeOcrToPrescription;
