// Detects what this device/browser can actually run, then maps to a tier.
// Tiers (best → worst):
//   3 = Cloud (Groq)          — needs network
//   2 = WebLLM + Qwen 1.5B    — needs WebGPU with workgroup ≥512
//   1 = Transformers.js Qwen 0.5B (WASM/CPU) — works almost everywhere
//   0 = Decision tree + rules  — always available, no model

export type Tier = 0 | 1 | 2 | 3;

export interface DeviceCapabilities {
  webgpu: boolean;
  webgpuAdapter?: string;
  workgroupLimit: number;       // 0 if no WebGPU
  ramGb: number;                 // navigator.deviceMemory, defaults to 4
  network: "online" | "offline";
  effectiveType?: string;        // "2g" | "3g" | "4g" | "slow-2g"
  saveData?: boolean;
  cores: number;
  recommendedOfflineTier: 0 | 1 | 2;   // Tier 3 (cloud) is decided by online state, not device
}

const WORKGROUP_TIER2_MIN = 512;
const RAM_TIER1_MIN = 1.5;     // GB — below this, Tier 1 model will OOM on a phone

let cached: DeviceCapabilities | null = null;

export async function detectCapabilities(force = false): Promise<DeviceCapabilities> {
  if (cached && !force) return cached;

  let webgpu = false;
  let workgroupLimit = 0;
  let adapterDesc: string | undefined;

  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        webgpu = true;
        workgroupLimit =
          adapter.limits?.maxComputeInvocationsPerWorkgroup ?? 0;
        const info = await adapter.requestAdapterInfo?.();
        adapterDesc = info ? `${info.vendor || ""} ${info.architecture || ""}`.trim() : undefined;
      }
    } catch {
      /* ignore */
    }
  }

  const ramGb = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const conn = (navigator as any).connection;
  const network: "online" | "offline" = navigator.onLine ? "online" : "offline";

  // Tier selection for the OFFLINE path. Cloud (Tier 3) is decided at request time.
  let recommendedOfflineTier: 0 | 1 | 2 = 0;
  if (webgpu && workgroupLimit >= WORKGROUP_TIER2_MIN && ramGb >= 3) {
    recommendedOfflineTier = 2;
  } else if (ramGb >= RAM_TIER1_MIN) {
    recommendedOfflineTier = 1;
  } else {
    recommendedOfflineTier = 0;
  }

  cached = {
    webgpu,
    webgpuAdapter: adapterDesc,
    workgroupLimit,
    ramGb,
    network,
    effectiveType: conn?.effectiveType,
    saveData: conn?.saveData,
    cores,
    recommendedOfflineTier,
  };
  return cached;
}

export function describeTier(tier: Tier): { en: string; bn: string; short: string } {
  switch (tier) {
    case 3: return { en: "Cloud AI (Groq)", bn: "ক্লাউড AI (Groq)", short: "cloud" };
    case 2: return { en: "On-device AI (WebLLM, Qwen 1.5B)", bn: "অন-ডিভাইস AI (WebLLM, Qwen 1.5B)", short: "webllm" };
    case 1: return { en: "On-device AI (Transformers.js, Qwen 0.5B)", bn: "অন-ডিভাইস AI (Transformers.js, Qwen 0.5B)", short: "wasm" };
    case 0: return { en: "Decision tree + rule set", bn: "ডিসিশন ট্রি + নিয়ম-সেট", short: "rules" };
  }
}
