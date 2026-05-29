import { Cloud, Download, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { useTfEngine, loadTfModel } from "../lib/transformersEngine.ts";
import { prefetch as prefetchOcr } from "../lib/tesseractEngine.ts";
import { prefetch as prefetchVoice } from "../lib/voiceEngine.ts";

// Shared "Make the AI work offline" card — the one-tap download that fetches the on-device LLM
// (+ OCR + voice models) so the app keeps working with no internet. Used on both the Homepage
// and the Settings page so there's a single source of truth for the download flow.
export function OfflineAiCard() {
  const { t } = useLanguage();
  const tf = useTfEngine();
  const ready = tf.status === "ready";
  const loading = tf.status === "loading";
  const error = tf.status === "error";
  const progress = loading ? tf.progress : 0;
  const progressText = loading ? tf.progressText : "";

  const handleLoad = async () => {
    // One tap = all three offline engines (LLM + OCR + Whisper voice). Companion prefetches are
    // fire-and-forget; the LLM is the gating download.
    prefetchOcr().catch(() => {});
    prefetchVoice().catch(() => {});
    try {
      await loadTfModel();
    } catch (e) {
      console.error("[offline-ai] load failed", e);
    }
  };

  return (
    <section className="bg-gradient-to-br from-emerald-900 to-emerald-700 rounded-3xl p-5 sm:p-6 text-white shadow-lg">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center text-white shrink-0">
          <Cloud size={24} />
        </div>
        <div>
          <h2 className="text-lg font-black">{t("settings.simple.title")}</h2>
          <p className="text-xs text-emerald-100/80 mt-0.5 leading-relaxed">{t("settings.simple.intro")}</p>
        </div>
      </div>

      <ol className="space-y-2 mb-5">
        <Step n="1" text={t("settings.simple.step1")} />
        <Step n="2" text={t("settings.simple.step2")} />
        <Step n="3" text={t("settings.simple.step3")} />
      </ol>

      {ready ? (
        <div className="bg-emerald-500/20 border border-emerald-300/40 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-200 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{t("settings.simple.ready")}</p>
            <p className="text-xs text-emerald-100/80 mt-1 leading-relaxed">{t("settings.simple.ready.body")}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <motion.div className="h-3 bg-emerald-300" animate={{ width: `${Math.round((progress || 0) * 100)}%` }} />
          </div>
          <p className="text-xs text-emerald-100/80">{progressText || t("settings.localai.downloading")} · {Math.round((progress || 0) * 100)}%</p>
          <p className="text-[11px] text-emerald-100/70 italic leading-relaxed mt-2">{t("settings.simple.downloading.note")}</p>
        </div>
      ) : (
        <>
          <button
            onClick={handleLoad}
            className="w-full bg-white text-emerald-700 py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors"
          >
            <Download size={20} />
            {t("settings.simple.cta")}
          </button>
          <p className="text-[11px] text-emerald-100/70 mt-2 text-center leading-relaxed">{t("settings.simple.hint")}</p>
          {error && (
            <p className="text-[11px] text-amber-200 mt-2 text-center leading-relaxed">{tf.error}</p>
          )}
        </>
      )}
    </section>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-xs font-black shrink-0">{n}</span>
      <span className="text-emerald-50/90 leading-relaxed">{text}</span>
    </li>
  );
}
