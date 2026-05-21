// Browser-native Text-to-Speech using the Web Speech API.
// Works offline, supports many languages including bn-BD and en-US (voice availability depends
// on the OS). Falls back gracefully on browsers without speech synthesis support.

export type SpeechLang = "bn-BD" | "bn-IN" | "en-US" | "en-IN" | "en-GB";

export interface SpeakOptions {
  lang?: SpeechLang;
  rate?: number;     // 0.1–10, default 1
  pitch?: number;    // 0–2, default 1
  onEnd?: () => void;
  onError?: (e: SpeechSynthesisErrorEvent) => void;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Get the best available voice for a language, preferring native ones over remote.
function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang === lang);
  if (exact) return exact;
  const langPrefix = lang.split("-")[0];
  const looser = voices.find((v) => v.lang.startsWith(langPrefix));
  return looser || null;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!isTtsSupported() || !text.trim()) return;
  stop();
  const u = new SpeechSynthesisUtterance(text);
  const lang = opts.lang || "bn-BD";
  u.lang = lang;
  u.rate = opts.rate ?? 0.95;
  u.pitch = opts.pitch ?? 1;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  if (opts.onEnd) u.onend = () => opts.onEnd!();
  if (opts.onError) u.onerror = (e) => opts.onError!(e);
  activeUtterance = u;
  window.speechSynthesis.speak(u);
}

export function pause(): void {
  if (isTtsSupported()) window.speechSynthesis.pause();
}

export function resume(): void {
  if (isTtsSupported()) window.speechSynthesis.resume();
}

export function stop(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
  activeUtterance = null;
}

export function isSpeaking(): boolean {
  return isTtsSupported() && window.speechSynthesis.speaking;
}

// Ensure voices are loaded (Chrome lazy-loads them). Call once on app boot.
export function warmupVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTtsSupported()) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    const handler = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // Belt and braces — Chrome sometimes doesn't fire onvoiceschanged.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}
