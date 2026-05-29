import { useEffect, useState } from "react";
import {
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import {
  useTfEngine,
  loadTfModel,
  unloadTfModel,
  clearTfOptIn,
  TF_DEFAULTS,
} from "../lib/transformersEngine.ts";
import {
  useTesseract,
  prefetch as prefetchOcr,
  purgeCache as purgeOcrCache,
} from "../lib/tesseractEngine.ts";
import {
  useVoiceEngine,
  prefetch as prefetchVoice,
  purgeCache as purgeVoiceCache,
} from "../lib/voiceEngine.ts";
import { useFontScale, type FontScale } from "../lib/fontSize.ts";
import { Type as TypeIcon } from "lucide-react";
import { useOnlineStatus } from "../lib/connectivity.ts";
import { detectCapabilities, describeTier, type DeviceCapabilities } from "../lib/capabilities.ts";
import { OfflineAiCard } from "../components/OfflineAiCard.tsx";

export function SettingsPage() {
  const { t, lang } = useLanguage();
  const tf = useTfEngine();
  const ocr = useTesseract();
  const voice = useVoiceEngine();
  const online = useOnlineStatus();
  const [confirmDelete, setConfirmDelete] = useState<null | "tf">(null);
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null);

  useEffect(() => {
    detectCapabilities().then(setCaps);
  }, []);

  const handleDelete = async () => {
    if (confirmDelete === "tf") {
      await unloadTfModel();
      clearTfOptIn();
      // All three offline engines are bundled with the LLM download — clean them up together
      // so the user has a fully-clean slate after deletion.
      try { await purgeOcrCache(); } catch (e) { console.warn("OCR purge failed", e); }
      try { await purgeVoiceCache(); } catch (e) { console.warn("Voice purge failed", e); }
    }
    setConfirmDelete(null);
  };

  const handleLoadTf = async () => {
    // Single offline AI tier (CPU/WASM). OCR + Voice prefetch run in parallel — one tap = all
    // three offline engines (LLM ~200MB + OCR ~30MB + Whisper-tiny ~75MB ≈ 305MB total).
    prefetchOcr().catch((e) => console.warn("OCR prefetch failed (non-fatal)", e));
    prefetchVoice().catch((e) => console.warn("Voice prefetch failed (non-fatal)", e));
    try {
      await loadTfModel();
    } catch (e: any) {
      console.error("loadTfModel failed", e);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:max-w-4xl lg:mx-auto space-y-6">
      <header>
        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t("settings.tag")}</p>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{t("settings.title")}</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{t("settings.intro")}</p>
      </header>

      {/* Font size — keep this near the top so low-vision users can find it fast. */}
      <FontSizeSection />

      {/* Beginner-friendly offline AI panel — plain language, one big tap. Shared with Homepage. */}
      <OfflineAiCard />

      {/* Device capability card */}
      {caps && (
        <section className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <Layers size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">{t("settings.caps.title")}</h2>
              <p className="text-xs text-gray-500 leading-relaxed">{t("settings.caps.intro")}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <CapsRow label={t("settings.caps.webgpu")} value={`${caps.webgpu ? "✓" : "✗"} ${caps.webgpuAdapter || ""}`} />
            <CapsRow label={t("settings.caps.workgroup")} value={String(caps.workgroupLimit || "–")} />
            <CapsRow label={t("settings.caps.ram")} value={`${caps.ramGb} GB`} />
            <CapsRow label={t("settings.caps.cores")} value={`${caps.cores} cores`} />
            <CapsRow label={t("settings.caps.network")} value={caps.network + (caps.effectiveType ? ` (${caps.effectiveType})` : "")} />
            <CapsRow label={t("settings.caps.recommended")} value={describeTier(caps.recommendedOfflineTier)[lang === "bn" ? "bn" : "en"]} highlight />
          </div>
        </section>
      )}

      {/* Network status — single card now that WebGPU is no longer in the offline path. */}
      <section>
        <StatusCard
          icon={online ? <Wifi className="text-emerald-600" size={20} /> : <WifiOff className="text-orange-500" size={20} />}
          label={t("settings.network")}
          value={online ? t("settings.network.online") : t("settings.network.offline")}
          tone={online ? "emerald" : "orange"}
        />
      </section>


      {/* Tier 1 — Transformers.js (CPU / WASM, universal) */}
      <section className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <header className="flex items-start gap-3">
          <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
            <Cpu size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Tier 1 · WASM / CPU</p>
            <h2 className="text-lg font-bold text-gray-900">{t("settings.tf.title")}</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-relaxed">{t("settings.tf.intro")}</p>
          </div>
        </header>

        <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-1">
          <p className="font-bold text-gray-900">SmolLM2 (360M, ONNX)</p>
          <p className="text-xs text-gray-500">{TF_DEFAULTS.DEFAULT_MODEL_ID}</p>
          <p className="text-xs text-gray-600">~200 MB · EN (BN limited) · {tf.device || "device picked at load"}</p>
          <p className="text-[11px] text-blue-700 mt-1">
            {lang === "bn"
              ? "+ অফলাইন স্ক্যানার (Tesseract OCR · ইংরেজি + বাংলা) ~৩০ MB"
              : "+ Offline scanner (Tesseract OCR · English + Bangla) ~30 MB"}
          </p>
          <p className="text-[11px] text-indigo-700 mt-0.5">
            {lang === "bn"
              ? "+ অফলাইন ভয়েস (Whisper-tiny · বাংলা + ইংরেজি) ~৭৫ MB"
              : "+ Offline voice input (Whisper-tiny · Bangla + English) ~75 MB"}
          </p>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
          tf.status === "ready" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
          tf.status === "loading" ? "bg-blue-50 text-blue-700 border-blue-200" :
          tf.status === "error" ? "bg-red-50 text-red-700 border-red-200" :
          "bg-gray-100 text-gray-600 border-gray-200"
        }`}>
          {tf.status === "ready" && <CheckCircle2 size={12} />}
          {tf.status === "loading" && <Download size={12} />}
          {tf.status === "error" && <AlertTriangle size={12} />}
          {t(`settings.tf.status.${tf.status}`)}
        </span>

        {tf.status === "loading" && (
          <div className="space-y-2">
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <motion.div className="h-2 bg-purple-500" animate={{ width: `${Math.round(tf.progress * 100)}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">{tf.progressText} · {Math.round(tf.progress * 100)}%</p>
          </div>
        )}

        {/* Companion engines (OCR + Whisper voice) — both prefetch alongside the LLM. */}
        {(ocr.status === "loading" || (ocr.status === "ready" && tf.status === "loading")) && (
          <OcrProgressStrip ocr={ocr} lang={lang} />
        )}
        {(voice.status === "loading" || (voice.status === "ready" && tf.status === "loading")) && (
          <VoiceProgressStrip voice={voice} lang={lang} />
        )}

        {tf.status === "error" && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t("settings.tf.error")}</p>
              <p className="text-xs mt-0.5 leading-relaxed">{tf.error}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {tf.status !== "ready" && (
            <button
              onClick={handleLoadTf}
              disabled={tf.status === "loading"}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={16} /> {t("settings.tf.download")}
            </button>
          )}
          {tf.status === "ready" && (
            <button
              onClick={() => setConfirmDelete("tf")}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-700 text-sm font-bold hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} /> {t("settings.tf.unload")}
            </button>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex gap-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t("settings.tf.disclaim")}</p>
        </div>
      </section>

      {/* Privacy reminder */}
      <section className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex gap-3 text-sm text-emerald-900">
        <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">{t("settings.privacy.title")}</p>
          <p className="text-xs leading-relaxed">{t("settings.privacy.body")}</p>
        </div>
      </section>

      {/* Confirm-delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-black text-gray-900">{t("settings.localai.deleteConfirm.title")}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t("settings.localai.deleteConfirm.body")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-500"
              >
                {t("settings.localai.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Shared OCR progress strip used by both Tier 1 (CPU/WASM) and Tier 2 (WebGPU) sections so
// users see the companion download in whichever section they tapped the button in.
function OcrProgressStrip({ ocr, lang }: { ocr: { status: string; progress: number; progressText: string }; lang: string }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
          {lang === "bn" ? "অফলাইন প্রেসক্রিপশন স্ক্যানার" : "Offline prescription OCR"}
        </p>
        <span className="text-[10px] font-bold text-blue-700">
          {ocr.status === "ready" ? (lang === "bn" ? "তৈরি" : "Ready") : `${Math.round(ocr.progress * 100)}%`}
        </span>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-1.5 bg-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(ocr.progress * 100)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-[10px] text-blue-800 leading-snug">
        {ocr.status === "ready"
          ? (lang === "bn" ? "Tesseract OCR (ইংরেজি + বাংলা) — ছাপা প্রেসক্রিপশনের জন্য প্রস্তুত।" : "Tesseract OCR (English + Bangla) — ready for printed prescriptions.")
          : (lang === "bn" ? `Tesseract OCR ডাউনলোড হচ্ছে — ${ocr.progressText || "ভাষা ফাইল"}` : `Downloading Tesseract OCR — ${ocr.progressText || "language data"}`)}
      </p>
    </div>
  );
}

function VoiceProgressStrip({ voice, lang }: { voice: { status: string; progress: number; progressText: string }; lang: string }) {
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
          {lang === "bn" ? "অফলাইন ভয়েস ইনপুট" : "Offline voice input"}
        </p>
        <span className="text-[10px] font-bold text-indigo-700">
          {voice.status === "ready" ? (lang === "bn" ? "তৈরি" : "Ready") : `${Math.round(voice.progress * 100)}%`}
        </span>
      </div>
      <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-1.5 bg-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(voice.progress * 100)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-[10px] text-indigo-800 leading-snug">
        {voice.status === "ready"
          ? (lang === "bn" ? "Whisper-tiny — ইন্টারনেট ছাড়াই বাংলা/ইংরেজি ভয়েস বোঝে।" : "Whisper-tiny — understands Bangla/English voice with no internet.")
          : (lang === "bn" ? `Whisper-tiny ডাউনলোড হচ্ছে — ${voice.progressText || "মডেল ফাইল"}` : `Downloading Whisper-tiny — ${voice.progressText || "model files"}`)}
      </p>
    </div>
  );
}

function CapsRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100"}`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${highlight ? "text-emerald-800" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "emerald" | "orange";
}) {
  const ring = tone === "emerald" ? "border-emerald-100" : "border-orange-100";
  return (
    <div className={`bg-white rounded-2xl border ${ring} p-4 flex items-center gap-3 shadow-sm`}>
      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function FontSizeSection() {
  const { t, lang } = useLanguage();
  const [scale, setScale] = useFontScale();
  const options: { v: FontScale; en: string; bn: string; previewPx: number }[] = [
    { v: "sm", en: "Small", bn: "ছোট", previewPx: 13 },
    { v: "md", en: "Medium", bn: "মাঝারি", previewPx: 15 },
    { v: "lg", en: "Large", bn: "বড়", previewPx: 18 },
    { v: "xl", en: "Extra Large", bn: "অতি বড়", previewPx: 22 },
  ];
  return (
    <section className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm">
      <header className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
          <TypeIcon size={22} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">{t("settings.font.title")}</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-relaxed">{t("settings.font.intro")}</p>
        </div>
      </header>
      <div className="grid grid-cols-4 gap-2">
        {options.map((o) => {
          const active = scale === o.v;
          return (
            <button
              key={o.v}
              onClick={() => setScale(o.v)}
              className={`rounded-xl border p-3 text-center transition-colors ${
                active ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <div style={{ fontSize: `${o.previewPx}px`, fontWeight: 800, lineHeight: 1 }}>Aa</div>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5">{lang === "bn" ? o.bn : o.en}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
