import { useEffect, useState } from "react";
import {
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Cloud,
  ShieldCheck,
  RefreshCw,
  Layers,
} from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import {
  useLocalLLM,
  loadModel,
  deleteModel,
  refreshCachedModels,
  isWebGPUSupported,
  fetchModelManifest,
  getLLMSettings,
  setLLMSettings,
  findLegacyCachedModels,
  DEFAULTS,
  type ModelManifest,
} from "../lib/llm.ts";
import {
  useTfEngine,
  loadTfModel,
  unloadTfModel,
  clearTfOptIn,
  TF_DEFAULTS,
} from "../lib/transformersEngine.ts";
import { useOnlineStatus } from "../lib/connectivity.ts";
import { detectCapabilities, describeTier, type DeviceCapabilities } from "../lib/capabilities.ts";

export function SettingsPage() {
  const { t, lang } = useLanguage();
  const llm = useLocalLLM();
  const tf = useTfEngine();
  const online = useOnlineStatus();
  const [manifest, setManifest] = useState<ModelManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [settings, setSettings] = useState(() => getLLMSettings());
  const [confirmDelete, setConfirmDelete] = useState<null | "webllm" | "tf">(null);
  const [legacy, setLegacy] = useState<string[]>([]);
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null);
  const webgpu = isWebGPUSupported();

  useEffect(() => {
    refreshCachedModels([DEFAULTS.DEFAULT_MODEL_ID]);
    findLegacyCachedModels().then(setLegacy);
    detectCapabilities().then(setCaps);
  }, []);

  const cleanupLegacy = async () => {
    for (const id of legacy) {
      try { await deleteModel(id); } catch { /* ignore */ }
    }
    setLegacy(await findLegacyCachedModels());
  };

  useEffect(() => {
    if (!online) return;
    fetchModelManifest()
      .then((m) => {
        setManifest(m);
        setManifestError(m ? null : "manifest_unreachable");
      })
      .catch(() => setManifestError("manifest_unreachable"));
  }, [online]);

  const recommendedId = manifest?.recommended.modelId || DEFAULTS.DEFAULT_MODEL_ID;
  const recommendedLabel = manifest?.recommended.label || "Qwen 2.5 (1.5B)";
  const recommendedSizeMb = manifest?.recommended.approxSizeMb || 900;
  const cached = llm.cachedModelIds.includes(recommendedId);
  const isUpdateAvailable =
    cached && manifest && llm.modelId === recommendedId && false; // placeholder; revision tracking lives client-side later

  const handleDownload = async () => {
    try {
      await loadModel(recommendedId);
    } catch (e: any) {
      console.error("loadModel failed", e);
    }
  };

  const handleDelete = async () => {
    if (confirmDelete === "webllm") await deleteModel(recommendedId);
    if (confirmDelete === "tf") {
      await unloadTfModel();
      clearTfOptIn(); // user wants this off — stop auto-loading on next boot
    }
    setConfirmDelete(null);
  };

  const handleLoadTf = async () => {
    try {
      await loadTfModel();
    } catch (e: any) {
      console.error("loadTfModel failed", e);
    }
  };

  const updateForceLocal = (v: boolean) => {
    setLLMSettings({ forceLocal: v });
    setSettings(getLLMSettings());
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:max-w-4xl lg:mx-auto space-y-6">
      <header>
        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t("settings.tag")}</p>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{t("settings.title")}</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{t("settings.intro")}</p>
      </header>

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

      {/* Network + WebGPU status row */}
      <section className="grid sm:grid-cols-2 gap-3">
        <StatusCard
          icon={online ? <Wifi className="text-emerald-600" size={20} /> : <WifiOff className="text-orange-500" size={20} />}
          label={t("settings.network")}
          value={online ? t("settings.network.online") : t("settings.network.offline")}
          tone={online ? "emerald" : "orange"}
        />
        <StatusCard
          icon={
            webgpu ? (
              <Cpu className="text-emerald-600" size={20} />
            ) : (
              <AlertTriangle className="text-orange-500" size={20} />
            )
          }
          label={t("settings.webgpu")}
          value={webgpu ? t("settings.webgpu.yes") : t("settings.webgpu.no")}
          tone={webgpu ? "emerald" : "orange"}
        />
      </section>

      {/* Offline AI section — Tier 2 (WebLLM) */}
      <section className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
        <header className="flex items-start gap-3">
          <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <Cloud size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Tier 2 · WebGPU</p>
            <h2 className="text-lg font-bold text-gray-900">{t("settings.localai.title")}</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-relaxed">{t("settings.localai.intro")}</p>
          </div>
        </header>

        {/* Model info */}
        <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-1">
          <p className="font-bold text-gray-900">{recommendedLabel}</p>
          <p className="text-xs text-gray-500">{recommendedId}</p>
          <p className="text-xs text-gray-600">
            ~{recommendedSizeMb} MB · {(manifest?.recommended.languages || ["bn", "en"]).join(", ").toUpperCase()}
          </p>
        </div>

        {/* Status pill */}
        <ModelStatusPill llmStatus={llm.status} cached={cached} t={t} />

        {/* Download progress */}
        {llm.status === "loading" && (
          <div className="space-y-2">
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-2 bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(llm.progress * 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              {llm.progressText || t("settings.localai.downloading")} · {Math.round(llm.progress * 100)}%
            </p>
          </div>
        )}

        {/* Error */}
        {llm.status === "error" && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t("settings.localai.error")}</p>
              <p className="text-xs mt-0.5 leading-relaxed">{llm.error}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {llm.status !== "ready" && (
            <button
              onClick={handleDownload}
              disabled={!webgpu || llm.status === "loading"}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={16} />
              {cached ? t("settings.localai.load") : t("settings.localai.download")}
            </button>
          )}
          {(cached || llm.status === "ready") && (
            <button
              onClick={() => setConfirmDelete("webllm")}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-700 text-sm font-bold hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} /> {t("settings.localai.delete")}
            </button>
          )}
        </div>

        {/* Disclosure for first-time users */}
        {llm.status === "idle" && !cached && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-sm">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-amber-900">
              <p className="font-bold">{t("settings.localai.disclaim.title")}</p>
              <p className="text-xs leading-relaxed">{t("settings.localai.disclaim.body")}</p>
            </div>
          </div>
        )}

        {/* Legacy variant cleanup — shown only if an older f16 variant is still cached */}
        {legacy.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-sm">
            <AlertTriangle size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2 text-blue-900">
              <p className="font-bold">{t("settings.localai.legacy.title")}</p>
              <p className="text-xs leading-relaxed">{t("settings.localai.legacy.body")}</p>
              <p className="text-[11px] font-mono opacity-70 break-all">{legacy.join(", ")}</p>
              <button
                onClick={cleanupLegacy}
                className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500"
              >
                <Trash2 size={12} /> {t("settings.localai.legacy.cta")}
              </button>
            </div>
          </div>
        )}

        {/* Force-local toggle */}
        <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            className="mt-1 w-4 h-4 accent-emerald-600 shrink-0"
            checked={settings.forceLocal}
            onChange={(e) => updateForceLocal(e.target.checked)}
          />
          <div>
            <p className="text-sm font-medium text-gray-800">{t("settings.localai.force.label")}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{t("settings.localai.force.sub")}</p>
          </div>
        </label>

        {/* Manifest check */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t("settings.manifest.title")}</p>
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              {!online
                ? t("settings.manifest.offline")
                : manifestError
                ? t("settings.manifest.error")
                : manifest
                ? `${t("settings.manifest.recommended")}: ${manifest.recommended.modelId} (rev ${manifest.recommended.revision})`
                : t("settings.manifest.checking")}
            </p>
          </div>
          <button
            onClick={() =>
              fetchModelManifest().then((m) => {
                setManifest(m);
                setManifestError(m ? null : "manifest_unreachable");
              })
            }
            disabled={!online}
            className="text-emerald-600 disabled:opacity-30 p-2 hover:bg-emerald-50 rounded-lg"
            title={t("settings.manifest.recheck")}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {isUpdateAvailable && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
            {t("settings.manifest.update_available")}
          </div>
        )}
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
          <p className="font-bold text-gray-900">Qwen 2.5 (0.5B, ONNX)</p>
          <p className="text-xs text-gray-500">{TF_DEFAULTS.DEFAULT_MODEL_ID}</p>
          <p className="text-xs text-gray-600">~300 MB · BN, EN · {tf.device || "device picked at load"}</p>
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

function ModelStatusPill({
  llmStatus,
  cached,
  t,
}: {
  llmStatus: string;
  cached: boolean;
  t: (k: string) => string;
}) {
  let label = "";
  let cls = "";
  let icon: React.ReactNode = null;
  if (llmStatus === "ready") {
    label = t("settings.localai.status.ready");
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    icon = <CheckCircle2 size={12} />;
  } else if (llmStatus === "loading") {
    label = t("settings.localai.status.loading");
    cls = "bg-blue-50 text-blue-700 border-blue-200";
    icon = <Download size={12} />;
  } else if (llmStatus === "error") {
    label = t("settings.localai.status.error");
    cls = "bg-red-50 text-red-700 border-red-200";
    icon = <AlertTriangle size={12} />;
  } else if (cached) {
    label = t("settings.localai.status.cached");
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    icon = <CheckCircle2 size={12} />;
  } else {
    label = t("settings.localai.status.idle");
    cls = "bg-gray-100 text-gray-600 border-gray-200";
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${cls}`}
    >
      {icon} {label}
    </span>
  );
}
