// Haversine + nearest-hospital lookup. Falls back to district matching when geolocation isn't
// granted (which is the common case in our use case — most rural users won't enable it).

import type { Hospital, NearestHospital } from "./types.ts";

let cached: Hospital[] | null = null;

export async function loadHospitals(): Promise<Hospital[]> {
  if (cached) return cached;
  try {
    const res = await fetch("/hospitals.json", { cache: "force-cache" });
    if (!res.ok) return [];
    const data = await res.json();
    cached = data.hospitals as Hospital[];
    return cached;
  } catch {
    return [];
  }
}

// Haversine — distance in km between two lat/lng points.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

interface FindOpts {
  userLat?: number;
  userLng?: number;
  district?: string;
  needEmergency?: boolean;
  needObstetric?: boolean;
  needCardiac?: boolean;
  needStrokeUnit?: boolean;
  topN?: number;
}

// Approximate centre coordinates for each BD district — used as a "near district" fallback when
// the browser hasn't given us geolocation. Keeps the hospital ranking sensible.
const DISTRICT_CENTRES: Record<string, [number, number]> = {
  Dhaka: [23.8103, 90.4125],
  Chittagong: [22.3569, 91.7832],
  Sylhet: [24.8949, 91.8687],
  Rajshahi: [24.3636, 88.6241],
  Khulna: [22.8456, 89.5403],
  Barisal: [22.7010, 90.3535],
  Mymensingh: [24.7471, 90.4203],
  Rangpur: [25.7439, 89.2752],
  Cumilla: [23.4607, 91.1809],
  Noakhali: [22.8324, 91.0976],
  Tangail: [24.2513, 89.9167],
  Jashore: [23.1664, 89.2086],
  Kushtia: [23.9013, 89.1208],
  Dinajpur: [25.6217, 88.6354],
  Bogura: [24.8484, 89.3713],
  Faridpur: [23.6070, 89.8429],
  Satkhira: [22.7185, 89.0708],
  Gaibandha: [25.3284, 89.5417],
  Narsingdi: [23.9322, 90.7152],
};

export async function findNearestHospitals(opts: FindOpts): Promise<NearestHospital[]> {
  const all = await loadHospitals();
  if (all.length === 0) return [];

  // Filter by required capability.
  const candidates = all.filter((h) => {
    if (opts.needEmergency && !h.emergency) return false;
    if (opts.needObstetric && !h.obstetric) return false;
    if (opts.needCardiac && !h.cardiac) return false;
    if (opts.needStrokeUnit && !h.stroke_unit) return false;
    return true;
  });
  if (candidates.length === 0) return [];

  // Pick origin: explicit lat/lng > district centre > Dhaka centre.
  let origin: { lat: number; lng: number; source: NearestHospital["source"] };
  if (opts.userLat != null && opts.userLng != null) {
    origin = { lat: opts.userLat, lng: opts.userLng, source: "geolocation" };
  } else if (opts.district && DISTRICT_CENTRES[opts.district]) {
    const [lat, lng] = DISTRICT_CENTRES[opts.district];
    origin = { lat, lng, source: "district" };
  } else {
    const [lat, lng] = DISTRICT_CENTRES.Dhaka;
    origin = { lat, lng, source: "fallback" };
  }

  const ranked = candidates
    .map((h) => ({
      hospital: h,
      distanceKm: Math.round(haversineKm(origin.lat, origin.lng, h.lat, h.lng) * 10) / 10,
      source: origin.source,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return ranked.slice(0, opts.topN || 3);
}

// Request browser geolocation once; resolve with null on denial / unavailable.
export function requestGeolocation(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(null);
      },
      { maximumAge: 5 * 60 * 1000, timeout: timeoutMs, enableHighAccuracy: false }
    );
  });
}
