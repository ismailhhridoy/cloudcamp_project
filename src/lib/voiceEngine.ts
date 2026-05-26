// Offline voice transcription using Whisper-tiny via Transformers.js.
//
// Why this exists: the browser's Web Speech API requires an internet connection on most
// implementations (Chrome streams audio to Google's cloud). For our offline-first rural-BD
// target, we need fully on-device STT. Whisper-tiny is ~40-75 MB int8/q4, multilingual,
// supports Bangla, and runs comfortably on a 2 GB phone in WASM.
//
// Lifecycle mirrors the other engines:
//   prefetch()  → downloads + warms the model (one-time)
//   transcribe(audio, lang) → returns transcribed text
//   unload()    → releases the pipeline
//
// Online users still get Web Speech API (faster, free, no model download). The voice helper
// component checks online status and routes accordingly.

import { pipeline, type PipelineType } from "@huggingface/transformers";
import { useEffect, useState } from "react";

export type VoiceStatus = "idle" | "loading" | "ready" | "error";

export interface VoiceState {
  status: VoiceStatus;
  progress: number;
  progressText: string;
  error?: string;
  cached: boolean;
}

// Whisper-tiny multilingual: 39M params, ~40 MB at int8. Supports Bangla + English well
// enough for short symptom utterances ("আমার বাচ্চার জ্বর", "I have chest pain").
const MODEL_ID = "onnx-community/whisper-tiny";
const CACHE_FLAG_KEY = "shasthyo_voice_cached_v1";

let asrPipeline: any = null;

let state: VoiceState = {
  status: "idle",
  progress: 0,
  progressText: "",
  cached: typeof window !== "undefined" && window.localStorage.getItem(CACHE_FLAG_KEY) === "1",
};

type Listener = (s: VoiceState) => void;
const listeners = new Set<Listener>();

function emit() { for (const l of listeners) l(state); }
function setState(patch: Partial<VoiceState>) { state = { ...state, ...patch }; emit(); }

export function getVoiceState(): VoiceState { return state; }
export function subscribeVoice(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function useVoiceEngine(): VoiceState {
  const [s, setS] = useState<VoiceState>(state);
  useEffect(() => subscribeVoice(setS), []);
  return s;
}

async function ensurePipeline(): Promise<any> {
  if (asrPipeline) return asrPipeline;
  asrPipeline = await pipeline("automatic-speech-recognition" as PipelineType, MODEL_ID, {
    dtype: "q4",
    progress_callback: (p: any) => {
      if (p.status === "progress") {
        setState({
          progress: p.progress != null ? p.progress / 100 : state.progress,
          progressText: `${p.file || "weights"} · ${Math.round(p.progress || 0)}%`,
        });
      } else if (p.status === "initiate") {
        setState({ progressText: `fetching ${p.file || ""}` });
      }
    },
  } as any);
  try { window.localStorage.setItem(CACHE_FLAG_KEY, "1"); } catch { /* ignore */ }
  setState({ cached: true });
  return asrPipeline;
}

export async function prefetch(): Promise<void> {
  if (state.status === "loading" || state.status === "ready") return;
  setState({ status: "loading", progress: 0, progressText: "Starting voice model download…", error: undefined });
  try {
    await ensurePipeline();
    setState({ status: "ready", progress: 1, progressText: "Ready" });
  } catch (e: any) {
    setState({ status: "error", error: e?.message || String(e) });
    asrPipeline = null;
    throw e;
  }
}

export async function autoLoadIfCached(): Promise<void> {
  if (state.status === "loading" || state.status === "ready") return;
  if (!state.cached) return;
  try { await ensurePipeline(); setState({ status: "ready" }); }
  catch (e) { console.warn("[voice] autoLoadIfCached failed", e); }
}

export async function unload(): Promise<void> {
  try { await asrPipeline?.dispose?.(); } catch { /* ignore */ }
  asrPipeline = null;
  setState({ status: "idle", progress: 0, progressText: "" });
}

export async function purgeCache(): Promise<void> {
  await unload();
  try { window.localStorage.removeItem(CACHE_FLAG_KEY); } catch { /* ignore */ }
  setState({ cached: false });
}

// ── Transcription ─────────────────────────────────────────────────────────
// Accepts a Float32Array of mono 16kHz audio samples (the format Whisper expects).
// The helper in `recordToAudio()` below handles MediaRecorder → resampling automatically.
export async function transcribe(
  audio: Float32Array,
  lang: "en" | "bn" = "en",
): Promise<string> {
  const asr = await ensurePipeline();
  // Whisper's `language` option steers decoding. For Bangla we pass "bengali"; English uses
  // "english". `task: transcribe` keeps original language (vs `translate` which would force EN).
  const result = await asr(audio, {
    language: lang === "bn" ? "bengali" : "english",
    task: "transcribe",
    return_timestamps: false,
    chunk_length_s: 30,
  });
  const text = Array.isArray(result) ? result.map((r: any) => r.text).join(" ") : String(result?.text || "");
  return text.trim();
}

// Convert a recorded Blob (from MediaRecorder) into a 16kHz mono Float32Array suitable for
// Whisper. We decode via WebAudio (universal browser support), downsample, and average to mono.
export async function blobToWhisperAudio(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
  if (!AudioCtx) throw new Error("AudioContext not supported in this browser.");
  // Decode at the browser's native sample rate, then resample to 16k ourselves — more reliable
  // than asking the AudioContext to use 16k directly (some Android browsers reject that).
  const decodeCtx = new AudioCtx();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  await decodeCtx.close();

  const sourceRate = decoded.sampleRate;
  const channelCount = decoded.numberOfChannels;
  const length = decoded.length;
  // Average channels → mono.
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channelCount; ch++) {
    const data = decoded.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channelCount;
  }
  if (sourceRate === 16000) return mono;
  // Linear resample to 16 kHz. Quality is fine for speech.
  const ratio = sourceRate / 16000;
  const outLength = Math.floor(length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, length - 1);
    const frac = idx - i0;
    out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  return out;
}

// One-shot helper: request mic, record for up to `maxSeconds`, return transcribed text.
// Uses MediaRecorder so we get a clean Blob regardless of platform audio quirks.
export async function recordAndTranscribe(
  lang: "en" | "bn",
  maxSeconds = 15,
  onStateChange?: (state: "recording" | "transcribing") => void,
): Promise<string> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone API not available in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    onStateChange?.("recording");
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start();
    await new Promise((r) => setTimeout(r, maxSeconds * 1000));
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    onStateChange?.("transcribing");
    const audio = await blobToWhisperAudio(blob);
    return await transcribe(audio, lang);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// Manually-controlled recording (Triage uses this so the user taps to stop). Returns an
// object with `.stop()` that returns the transcription Promise.
export interface ManualRecorder {
  stop: () => Promise<string>;
  abort: () => void;
}

export async function startManualRecording(
  lang: "en" | "bn",
  onStateChange?: (state: "recording" | "transcribing") => void,
): Promise<ManualRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone API not available in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  onStateChange?.("recording");
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start();
  return {
    stop: async () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
        await stopped;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        onStateChange?.("transcribing");
        const audio = await blobToWhisperAudio(blob);
        return await transcribe(audio, lang);
      } finally {
        stream.getTracks().forEach((t) => t.stop());
      }
    },
    abort: () => {
      try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* ignore */ }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export function isVoiceReady(): boolean {
  return state.status === "ready";
}

export const VOICE_DEFAULTS = { MODEL_ID };
