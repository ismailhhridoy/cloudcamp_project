// Singleton wrapper around WebLLM. Loads the model into IndexedDB on first request, then runs
// inference inside a Web Worker so the main thread stays responsive.
//
// State is exposed via a tiny pub/sub so any component can subscribe via the `useLocalLLM` hook.

import {
  CreateWebWorkerMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
  deleteModelInCache,
  deleteModelAllInfoInCache,
  hasModelInCache,
} from "@mlc-ai/web-llm";
import { useEffect, useState } from "react";

export type LocalLLMStatus = "idle" | "loading" | "ready" | "error";

export interface LocalLLMState {
  status: LocalLLMStatus;
  modelId: string | null;
  progress: number;        // 0–1
  progressText: string;
  error?: string;
  cachedModelIds: string[];
}

// q4f32 variant uses 32-bit shaders — broader GPU/driver compatibility than the smaller q4f16
// build (which needs the WebGPU `shader-f16` feature and fails on some Intel/AMD/Linux setups).
// Tradeoff: ~1.2 GB on disk instead of ~900 MB.
const DEFAULT_MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f32_1-MLC";
// Older f16 build kept here so we can detect and prompt the user to delete it after the switch.
const LEGACY_MODEL_IDS = ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC"];
const SETTINGS_KEY = "shasthyo_llm_settings_v1";

let engine: MLCEngineInterface | null = null;
let worker: Worker | null = null;

let state: LocalLLMState = {
  status: "idle",
  modelId: null,
  progress: 0,
  progressText: "",
  cachedModelIds: [],
};

type Listener = (s: LocalLLMState) => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(state);
}

function setState(patch: Partial<LocalLLMState>) {
  state = { ...state, ...patch };
  emit();
}

export function getLocalLLMState(): LocalLLMState {
  return state;
}

export function subscribeLocalLLM(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLocalLLM(): LocalLLMState {
  const [s, setS] = useState<LocalLLMState>(state);
  useEffect(() => subscribeLocalLLM(setS), []);
  return s;
}

// ── Capability checks ──────────────────────────────────────────────────────
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// ── Settings ───────────────────────────────────────────────────────────────
interface LLMSettings {
  forceLocal: boolean;
  preferredModelId: string;
}

export function getLLMSettings(): LLMSettings {
  if (typeof window === "undefined") return { forceLocal: false, preferredModelId: DEFAULT_MODEL_ID };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { forceLocal: false, preferredModelId: DEFAULT_MODEL_ID, ...JSON.parse(raw) };
  } catch {}
  return { forceLocal: false, preferredModelId: DEFAULT_MODEL_ID };
}

export function setLLMSettings(patch: Partial<LLMSettings>): void {
  const merged = { ...getLLMSettings(), ...patch };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

// ── Cache discovery ───────────────────────────────────────────────────────
export async function refreshCachedModels(candidates: string[] = [DEFAULT_MODEL_ID]): Promise<string[]> {
  const cached: string[] = [];
  for (const id of candidates) {
    try {
      if (await hasModelInCache(id)) cached.push(id);
    } catch {
      /* ignore */
    }
  }
  setState({ cachedModelIds: cached });
  return cached;
}

// ── Engine lifecycle ──────────────────────────────────────────────────────
function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./llmWorker.ts", import.meta.url), { type: "module" });
  return worker;
}

export async function loadModel(modelId: string = DEFAULT_MODEL_ID): Promise<void> {
  if (state.status === "loading") return;
  if (engine && state.modelId === modelId && state.status === "ready") return;

  setState({ status: "loading", modelId, progress: 0, progressText: "Initialising…", error: undefined });

  try {
    if (!isWebGPUSupported()) {
      throw new Error(
        "WebGPU is not available in this browser. The offline AI needs Chrome / Edge / Brave on a recent device."
      );
    }

    const w = ensureWorker();
    engine = await CreateWebWorkerMLCEngine(w, modelId, {
      initProgressCallback: (report: InitProgressReport) => {
        setState({
          progress: report.progress ?? 0,
          progressText: report.text ?? "",
        });
      },
    });
    setState({ status: "ready", progress: 1, progressText: "Ready" });
    await refreshCachedModels([modelId]);
  } catch (e: any) {
    setState({ status: "error", error: e?.message || String(e) });
    engine = null;
    throw e;
  }
}

export async function unloadModel(): Promise<void> {
  try {
    await engine?.unload();
  } catch {
    /* ignore */
  }
  engine = null;
  // Terminate the worker too so the next load gets a clean process. Without this, a previous bad
  // shader compile or partial state can carry over and cause hangs on the next attempt.
  try {
    worker?.terminate();
  } catch {
    /* ignore */
  }
  worker = null;
  setState({ status: "idle", modelId: null, progress: 0, progressText: "" });
}

export async function deleteModel(modelId: string = DEFAULT_MODEL_ID): Promise<void> {
  await unloadModel();
  try {
    await deleteModelInCache(modelId);
    await deleteModelAllInfoInCache(modelId);
  } catch (e) {
    console.warn("deleteModel error", e);
  }
  await refreshCachedModels([modelId]);
}

// ── Inference ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are ShasthyoAI, a calm Bangla/English health-triage assistant for rural Bangladesh.

You are NOT a doctor. You operate under Bangladesh Medical & Dental Council and DGHS Telemedicine Practice Guideline 2020.

RULES:
1. Detect the user's language (Bangla vs English) and reply ONLY in that language. Do not mix.
2. NEVER prescribe prescription-only medicines (antibiotics, steroids, anti-hypertensives, opioids, psychiatric drugs).
3. For RED-FLAG symptoms (chest pain, breathing difficulty, unconsciousness, severe bleeding, seizure,
   infant fever, severe abdominal pain, pregnancy bleeding, suspected stroke, suicidal ideation,
   anaphylaxis), behave like a triage nurse: in 1–3 sentences acknowledge briefly and ask ONE focused
   emergency triage question. After the patient answers — or if they already gave clear detail —
   give a firm one-line verdict ending in **GO TO HOSPITAL NOW** / **এখনই হাসপাতালে যান** and remind
   them to call 999 if they can't reach a hospital. Do not list medicines.
4. For mild/self-limiting conditions you may mention common OTC supports (ORS, paracetamol, warm fluids)
   paired with "verify dose with a licensed doctor".
5. End every final answer with the verdict in bold (GO TO HOSPITAL NOW / FIRST-AID AT HOME / WAIT AND
   WATCH, in the matching language) and the line "⚠️ This is AI guidance only. Please consult a real
   doctor when possible." / "⚠️ এটি শুধু AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।"
6. Keep replies short — under ~200 words. Warm, direct, no robotic disclaimers, no echoing the user.`;

export interface LocalChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatLocal(
  history: LocalChatMessage[],
  userMessage: string,
  onChunk?: (chunk: string, full: string) => void
): Promise<string> {
  if (!engine || state.status !== "ready") {
    throw new Error("Local model is not loaded. Open Settings and download it first.");
  }
  const messages: LocalChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.filter((m) => m.role !== "system"),
    { role: "user", content: userMessage },
  ];

  console.log("[llm] chatLocal: requesting stream, msgs=", messages.length);
  const t0 = performance.now();
  try {
    const stream = await engine.chat.completions.create({
      messages: messages as any,
      temperature: 0.6,
      // Tightened from 600 → 200 for snappier responses on slow GPUs / weak workgroup limits.
      max_tokens: 200,
      stream: true,
    });
    console.log("[llm] chatLocal: got stream handle in", Math.round(performance.now() - t0), "ms");

    let full = "";
    let count = 0;
    for await (const part of stream as any) {
      const delta = part?.choices?.[0]?.delta?.content || "";
      if (!delta) continue;
      count += 1;
      if (count === 1) console.log("[llm] chatLocal: first token in", Math.round(performance.now() - t0), "ms");
      if (count % 20 === 0) console.log("[llm] chatLocal: streaming token", count);
      full += delta;
      onChunk?.(delta, full);
    }
    console.log("[llm] chatLocal: done,", count, "tokens, total", Math.round(performance.now() - t0), "ms");
    return full;
  } catch (e) {
    // GPU device lost (or any other generation crash) — fully reset so the next attempt isn't a
    // zombie engine pointing at a destroyed adapter.
    console.warn("[llm] chatLocal crashed, resetting engine", e);
    try { await unloadModel(); } catch { /* ignore */ }
    throw e;
  }
}

// ── Manifest check ────────────────────────────────────────────────────────
export interface ModelManifest {
  recommended: {
    modelId: string;
    label: string;
    revision: string;
    approxSizeMb: number;
    languages: string[];
    releasedAt: string;
  };
  minimumAppRevision: string;
}

export async function fetchModelManifest(): Promise<ModelManifest | null> {
  try {
    const res = await fetch("/model-manifest.json", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ModelManifest;
  } catch {
    return null;
  }
}

// Auto-load the model into the engine on app boot IF its weights are already cached in IndexedDB.
// Without this, the user has to click "Load" in Settings after every page reload before the offline
// AI can answer in Triage. Idempotent — safe to call repeatedly.
export async function autoLoadIfCached(modelId: string = DEFAULT_MODEL_ID): Promise<void> {
  if (state.status === "loading" || state.status === "ready") return;
  try {
    const cached = await hasModelInCache(modelId);
    if (!cached) return;
    await loadModel(modelId);
  } catch (e) {
    console.warn("autoLoadIfCached failed", e);
  }
}

// Detect any previously-downloaded legacy variants so the Settings UI can prompt cleanup.
export async function findLegacyCachedModels(): Promise<string[]> {
  const out: string[] = [];
  for (const id of LEGACY_MODEL_IDS) {
    try {
      if (await hasModelInCache(id)) out.push(id);
    } catch {
      /* ignore */
    }
  }
  return out;
}

export const DEFAULTS = { DEFAULT_MODEL_ID, LEGACY_MODEL_IDS };
