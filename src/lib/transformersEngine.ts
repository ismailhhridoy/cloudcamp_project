// Tier 1 engine — Transformers.js + Qwen 2.5 0.5B ONNX.
// Runs on CPU (WASM) or WebGPU (if available). Universal compatibility on any browser ≥2019.

import { pipeline, TextStreamer, env } from "@huggingface/transformers";
import { useEffect, useState } from "react";

export type TfStatus = "idle" | "loading" | "ready" | "error";

export interface TfState {
  status: TfStatus;
  modelId: string | null;
  progress: number;       // 0–1
  progressText: string;
  error?: string;
  device: "wasm" | "webgpu" | null;
}

// Default model — SmolLM2-360M ONNX (~200 MB q4). Half the size of Qwen 2.5 0.5B and tested
// to load successfully on Android phones with 3 GB RAM. SmolLM2 was specifically trained for
// on-device deployment by HuggingFaceTB; quality is comparable to Qwen 0.5B for short
// structured tasks (triage Q&A, prescription JSON shaping). Bangla quality is weaker than
// Qwen but acceptable — for richer Bangla we lean on the curated KB + decision tree.
const DEFAULT_MODEL_ID = "HuggingFaceTB/SmolLM2-360M-Instruct";
const SETTINGS_KEY = "shasthyo_tf_settings_v1";
const OPT_IN_KEY = "shasthyo_tf_opted_in_v1";

// Allow ORT to download WASM artefacts from the HF CDN. Browser only.
env.allowLocalModels = false;
env.useBrowserCache = true;

let generator: any = null;
let state: TfState = {
  status: "idle",
  modelId: null,
  progress: 0,
  progressText: "",
  device: null,
};

type Listener = (s: TfState) => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(state);
}

function setState(patch: Partial<TfState>) {
  state = { ...state, ...patch };
  emit();
}

export function getTfState(): TfState {
  return state;
}

export function subscribeTf(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTfEngine(): TfState {
  const [s, setS] = useState<TfState>(state);
  useEffect(() => subscribeTf(setS), []);
  return s;
}

// ── Settings ──────────────────────────────────────────────────────────────
interface TfSettings {
  preferredModelId: string;
  device: "auto" | "wasm" | "webgpu";
}

export function getTfSettings(): TfSettings {
  if (typeof window === "undefined") return { preferredModelId: DEFAULT_MODEL_ID, device: "auto" };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { preferredModelId: DEFAULT_MODEL_ID, device: "auto", ...JSON.parse(raw) };
  } catch {}
  return { preferredModelId: DEFAULT_MODEL_ID, device: "auto" };
}

export function setTfSettings(patch: Partial<TfSettings>): void {
  const merged = { ...getTfSettings(), ...patch };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

// Check how much device RAM we can reasonably allocate. Chrome on Android exposes
// `navigator.deviceMemory` in GB, capped at 8 (rounded down). The Qwen 0.5B q4 weights need
// ~280MB of contiguous heap, and WASM allocations on 2-3GB phones often fail because the
// browser can't find that much contiguous virtual memory. We bail out cleanly with a clear
// error before kicking off a 280MB download that will fail at the last step.
function checkDeviceMemorySufficient(): { ok: true } | { ok: false; gb: number } {
  if (typeof navigator === "undefined" || !("deviceMemory" in navigator)) return { ok: true };
  const gb = (navigator as any).deviceMemory as number;
  if (typeof gb !== "number") return { ok: true };
  // SmolLM2-360M q4 needs ~200 MB contiguous heap. 2 GB phones usually have enough free heap
  // for that after the OS and a Chrome tab; only block on 1 GB or less.
  if (gb < 2) return { ok: false, gb };
  return { ok: true };
}

function isOomError(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return msg.includes("array buffer allocation failed")
    || msg.includes("out of memory")
    || msg.includes("memory access out of bounds")
    || msg.includes("rangeerror")
    || msg.includes("maximum call stack");
}

// ── Load / unload ─────────────────────────────────────────────────────────
export async function loadTfModel(modelId: string = DEFAULT_MODEL_ID): Promise<void> {
  if (state.status === "loading") return;
  if (generator && state.modelId === modelId && state.status === "ready") return;

  // Pre-flight RAM check — abort early if the device almost certainly can't hold the weights.
  const mem = checkDeviceMemorySufficient();
  if (mem.ok === false) {
    const err = `Your device only reports ${mem.gb} GB of RAM. The offline AI needs ~2 GB+ of free memory to load. The download would fail at the final step.`;
    setState({ status: "error", error: err });
    throw new Error(err);
  }

  // Remember opt-in so the next page load can auto-restore the engine without another click.
  try {
    window.localStorage.setItem(OPT_IN_KEY, "1");
  } catch {
    /* ignore */
  }
  setState({ status: "loading", modelId, progress: 0, progressText: "Loading…", error: undefined });

  const preferred = getTfSettings().device;
  // Prefer WebGPU if available AND user hasn't pinned wasm. Most low-end devices fall back to wasm
  // automatically inside transformers.js.
  let device: "wasm" | "webgpu" = "wasm";
  if (preferred !== "wasm" && typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) device = "webgpu";
    } catch {
      /* keep wasm */
    }
  }

  try {
    generator = await pipeline("text-generation", modelId, {
      device,
      // Quantised dtype keeps the download small on CPU; q4f16 is fastest on WebGPU.
      dtype: device === "webgpu" ? "q4f16" : "q4",
      progress_callback: (p: any) => {
        if (p.status === "progress") {
          setState({
            progress: p.progress != null ? p.progress / 100 : state.progress,
            progressText: `${p.file || "weights"} · ${Math.round(p.progress || 0)}%`,
          });
        } else if (p.status === "ready" || p.status === "done") {
          setState({ progress: 1, progressText: p.file ? `${p.file} done` : "Loaded" });
        } else if (p.status === "initiate") {
          setState({ progressText: `fetching ${p.file || ""}` });
        }
      },
    } as any);
    setState({ status: "ready", progress: 1, progressText: "Ready", device });
  } catch (e: any) {
    generator = null;
    // OOM is the dominant failure mode on low-RAM Android. Detect it and surface an actionable
    // message instead of the raw stack ("Array buffer allocation failed" tells the user nothing).
    // Also clear the opt-in flag so the next page reload doesn't auto-retry and re-OOM.
    if (isOomError(e)) {
      try { window.localStorage.removeItem(OPT_IN_KEY); } catch { /* ignore */ }
      const friendly = "Your device ran out of memory while loading the offline AI. The app will still triage symptoms offline using the curated medical knowledge base and decision tree — you just won't get free-form AI conversation offline. (You can also try closing other browser tabs and apps, then retry.)";
      setState({ status: "error", error: friendly });
      throw new Error(friendly);
    }
    setState({ status: "error", error: e?.message || String(e) });
    throw e;
  }
}

export async function unloadTfModel(): Promise<void> {
  try {
    await generator?.dispose?.();
  } catch {
    /* ignore */
  }
  generator = null;
  setState({ status: "idle", modelId: null, progress: 0, progressText: "", device: null });
}

// Forget that the user opted in (used by Settings delete).
export function clearTfOptIn(): void {
  try {
    window.localStorage.removeItem(OPT_IN_KEY);
  } catch {
    /* ignore */
  }
}

// Auto-restore on page load. We can't probe the Transformers.js cache cheaply, so we use a
// localStorage opt-in flag: once the user has successfully loaded Tier 1 at least once, we
// quietly re-warm the engine on every subsequent boot. If the user explicitly unloaded, the
// flag is cleared.
export async function autoLoadTfIfOptedIn(): Promise<void> {
  if (state.status !== "idle") return;
  let opted = false;
  try {
    opted = window.localStorage.getItem(OPT_IN_KEY) === "1";
  } catch {
    /* ignore */
  }
  if (!opted) return;
  try {
    await loadTfModel();
  } catch (e) {
    console.warn("[tf] autoLoadTfIfOptedIn failed", e);
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────
export interface TfChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatTf(
  messages: TfChatMessage[],
  onChunk?: (chunk: string, full: string) => void
): Promise<string> {
  if (!generator || state.status !== "ready") {
    throw new Error("Transformers.js model is not loaded.");
  }
  let full = "";
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    callback_function: (text: string) => {
      if (!text) return;
      full += text;
      onChunk?.(text, full);
    },
  });
  try {
    await generator(messages, {
      // Tightened from 500 → 200 for snappier responses on weak CPUs.
      max_new_tokens: 200,
      temperature: 0.6,
      do_sample: true,
      streamer,
    });
    return full;
  } catch (e) {
    // ORT sessions sometimes get disposed mid-generation on lower-end devices. Reset our state so
    // a retry creates a fresh session instead of reusing the corrupted one.
    console.warn("[tf] chat error, resetting engine", e);
    generator = null;
    setState({ status: "idle", modelId: null, progress: 0, progressText: "", device: null });
    throw e;
  }
}

export const TF_DEFAULTS = { DEFAULT_MODEL_ID };

export function isTfReady(): boolean {
  return state.status === "ready";
}
