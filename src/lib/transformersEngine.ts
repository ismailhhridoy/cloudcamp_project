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

// Default model — small enough for any device, multilingual enough for basic Bangla.
const DEFAULT_MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
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

// ── Load / unload ─────────────────────────────────────────────────────────
export async function loadTfModel(modelId: string = DEFAULT_MODEL_ID): Promise<void> {
  if (state.status === "loading") return;
  if (generator && state.modelId === modelId && state.status === "ready") return;

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
    setState({ status: "error", error: e?.message || String(e) });
    generator = null;
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
