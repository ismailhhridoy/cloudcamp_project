// Dynamic "Today's Health Tip" — picks a relevant tip based on:
//   1. current weather (Open-Meteo, free, no API key)
//   2. season / month
//   3. user district + age + chronic conditions (from profile)
//
// Falls back gracefully to a seasonal tip if network / geolocation isn't available.

import { getPatientProfile } from "./profile.ts";

export interface DailyTip {
  en: string;
  bn: string;
  source: string;
  weather?: { temp: number; humidity: number; precip: number };
  weatherCode?: number;
  trigger: string;
}

const DISTRICT_CENTRES: Record<string, [number, number]> = {
  Dhaka: [23.8103, 90.4125], Chittagong: [22.3569, 91.7832], Sylhet: [24.8949, 91.8687],
  Rajshahi: [24.3636, 88.6241], Khulna: [22.8456, 89.5403], Barisal: [22.7010, 90.3535],
  Mymensingh: [24.7471, 90.4203], Rangpur: [25.7439, 89.2752], Cumilla: [23.4607, 91.1809],
  Noakhali: [22.8324, 91.0976], Tangail: [24.2513, 89.9167], Jashore: [23.1664, 89.2086],
};

async function maybeGeolocation(timeoutMs = 2500): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (!done) { done = true; clearTimeout(t); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); } },
      () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
      { maximumAge: 30 * 60 * 1000, timeout: timeoutMs, enableHighAccuracy: false }
    );
  });
}

async function fetchWeather(lat: number, lng: number): Promise<{ temp: number; humidity: number; precip: number; code: number } | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      temp: j.current?.temperature_2m ?? 0,
      humidity: j.current?.relative_humidity_2m ?? 0,
      precip: j.current?.precipitation ?? 0,
      code: j.current?.weather_code ?? 0,
    };
  } catch {
    return null;
  }
}

// Bilingual tip library keyed by trigger.
const TIPS: Record<string, { en: string; bn: string }> = {
  heat: {
    en: "It's very hot today. Drink at least 8 glasses of safe water, take ORS if working in the sun, and rest in the shade every hour.",
    bn: "আজ অনেক গরম। নিরাপদ পানি দিনে অন্তত ৮ গ্লাস পান করুন, রোদে কাজ করলে খাবার স্যালাইন নিন, প্রতি ঘণ্টায় ছায়ায় বিশ্রাম নিন।",
  },
  heat_extreme: {
    en: "Heatwave alert. Avoid outdoor work between 11 AM and 4 PM. Sponge with cool water if you feel dizzy. Children and elderly are most at risk.",
    bn: "তীব্র দাবদাহ। সকাল ১১টা থেকে বিকাল ৪টা বাইরের কাজ এড়িয়ে চলুন। মাথা ঘুরলে ঠান্ডা পানিতে গা মুছুন। শিশু ও বৃদ্ধরা সবচেয়ে ঝুঁকিতে।",
  },
  humid: {
    en: "High humidity today. Keep skin folds dry to prevent fungal infections; change sweaty clothes. Wash hands with soap before eating.",
    bn: "আজ আর্দ্রতা বেশি। ত্বকের ভাঁজ শুকনো রাখুন — ফাঙ্গাল সংক্রমণ এড়াতে; ঘামাট কাপড় বদলান। খাওয়ার আগে সাবান দিয়ে হাত ধুয়ে নিন।",
  },
  rain: {
    en: "Rain today. Empty any standing water around your home — bottle caps, pots, tyres — to break the mosquito breeding cycle. Dengue rises during monsoon.",
    bn: "আজ বৃষ্টি। বাড়ির চারপাশের জমে থাকা পানি (বোতলের ছিপি, পাত্র, টায়ার) ফেলে দিন — মশার বংশবৃদ্ধি বন্ধ করুন। বর্ষায় ডেঙ্গু বাড়ে।",
  },
  storm: {
    en: "Storm warning. Stay indoors, away from windows. Keep emergency contacts (999, nearest hospital) and a battery-powered light ready.",
    bn: "ঝড়ের সতর্কতা। ঘরে থাকুন, জানালা থেকে দূরে। জরুরি নম্বর (৯৯৯, নিকটতম হাসপাতাল) ও ব্যাটারিচালিত আলো প্রস্তুত রাখুন।",
  },
  cool: {
    en: "Cooler day. Cover your nose and mouth in dust or crowded places to reduce respiratory infections. Asthma and COPD patients keep your inhaler nearby.",
    bn: "ঠান্ডা দিন। ধুলায় বা ভিড়ে নাক-মুখ ঢেকে রাখুন — শ্বাসনালীর সংক্রমণ কমে। হাঁপানি ও COPD রোগীরা ইনহেলার সাথে রাখুন।",
  },
  monsoon: {
    en: "Monsoon season — drink only boiled or sealed bottled water. Eat freshly cooked food, avoid roadside fried snacks. Dengue and typhoid peak now.",
    bn: "বর্ষাকাল — শুধু ফোটানো বা সিল করা বোতলের পানি পান করুন। সদ্য রান্না খাবার খান, রাস্তার ভাজা খাবার এড়িয়ে চলুন। এই সময় ডেঙ্গু ও টাইফয়েড বেড়ে যায়।",
  },
  winter: {
    en: "Winter season — wash hands often. Flu and pneumonia rise; infants and elderly should get their pneumococcal and flu vaccines if eligible.",
    bn: "শীতকাল — ঘন ঘন হাত ধুয়ে নিন। ফ্লু ও নিউমোনিয়া বাড়ে; যোগ্য হলে শিশু ও বৃদ্ধদের নিউমোকোক্কাল ও ফ্লু টিকা দিন।",
  },
  spring: {
    en: "Pollen and dust rise in spring. Asthma and allergy patients keep your prescribed inhaler/cetirizine handy. Wash face after coming home.",
    bn: "বসন্তে ধুলা ও পরাগ বাড়ে। হাঁপানি ও এলার্জির রোগীরা ইনহেলার/সেটিরিজিন সাথে রাখুন। বাইরে থেকে এসে মুখ ধুয়ে নিন।",
  },
  diabetic: {
    en: "Diabetic tip: check your sugar after a meal occasionally. If you ever feel shaky, sweaty, or confused — eat 3 teaspoons of sugar or sweet juice immediately.",
    bn: "ডায়াবেটিক টিপ: কখনো কখনো খাওয়ার পর সুগার পরীক্ষা করুন। কাঁপুনি, ঘাম বা বিভ্রান্তি হলে তৎক্ষণাত ৩ চা চামচ চিনি বা মিষ্টি রস খেয়ে নিন।",
  },
  hypertension: {
    en: "Blood pressure tip: keep your daily salt under one teaspoon (5 g). Take your BP medicine every day — never stop when you feel well.",
    bn: "রক্তচাপ টিপ: প্রতিদিন লবণ এক চা চামচের (৫ গ্রাম) কম রাখুন। BP ওষুধ প্রতিদিন নিন — ভাল লাগলেও বন্ধ করবেন না।",
  },
  pregnancy: {
    en: "Pregnancy tip: take your iron + folic acid tablet daily. Note your baby's movements after 28 weeks — fewer than 10 in 12 hours, see a doctor.",
    bn: "গর্ভাবস্থা টিপ: প্রতিদিন আয়রন ও ফলিক অ্যাসিড ট্যাবলেট নিন। ২৮ সপ্তাহের পর শিশুর নড়াচড়া হিসাব করুন — ১২ ঘণ্টায় ১০-এর কম হলে ডাক্তার দেখান।",
  },
  child: {
    en: "Children: make sure all EPI vaccines (BCG, Pentavalent, MR, Measles) are up to date — they are free at every upazila and community clinic.",
    bn: "শিশু: সব EPI টিকা (BCG, পেন্টাভ্যালেন্ট, MR, হাম) ঠিকঠাক আছে কিনা দেখুন — সব উপজেলা ও কমিউনিটি ক্লিনিকে বিনামূল্যে দেওয়া হয়।",
  },
  hydration: {
    en: "Drink at least 8 glasses of safe (boiled or filtered) water today. Carry ORS for any loose motion or vomiting.",
    bn: "আজ অন্তত ৮ গ্লাস নিরাপদ (ফোটানো বা ফিল্টার) পানি পান করুন। পাতলা পায়খানা বা বমির জন্য ORS সাথে রাখুন।",
  },
};

function pickSeasonalTip(month: number): { trigger: string } {
  // Bangladesh seasons:
  // Mar-May (2-4): spring/pre-monsoon, dust + heat starts
  // Jun-Sep (5-8): monsoon, dengue/typhoid
  // Oct-Nov (9-10): autumn, mild
  // Dec-Feb (11-1): winter, flu/asthma
  if (month >= 5 && month <= 8) return { trigger: "monsoon" };
  if (month === 11 || month <= 1) return { trigger: "winter" };
  if (month >= 2 && month <= 4) return { trigger: "spring" };
  return { trigger: "hydration" };
}

function pickWeatherTip(w: { temp: number; humidity: number; precip: number; code: number }): string | null {
  if (w.temp >= 38) return "heat_extreme";
  if (w.temp >= 33) return "heat";
  if (w.code >= 95 && w.code <= 99) return "storm";
  if (w.precip >= 2 || (w.code >= 51 && w.code <= 67)) return "rain";
  if (w.code >= 71 && w.code <= 77) return "cool"; // snow/sleet (rare in BD)
  if (w.humidity >= 80) return "humid";
  if (w.temp <= 18) return "cool";
  return null;
}

export async function getDailyTip(): Promise<DailyTip> {
  const profile = getPatientProfile();
  let lat: number | undefined, lng: number | undefined;

  // Prefer browser geolocation, fall back to profile district centre.
  const geo = await maybeGeolocation();
  if (geo) {
    lat = geo.lat; lng = geo.lng;
  } else if (profile.district && DISTRICT_CENTRES[profile.district]) {
    [lat, lng] = DISTRICT_CENTRES[profile.district];
  } else {
    [lat, lng] = DISTRICT_CENTRES.Dhaka;
  }

  const weather = lat != null && lng != null ? await fetchWeather(lat, lng) : null;

  // 1) Weather-driven tip
  if (weather) {
    const wTrigger = pickWeatherTip(weather);
    if (wTrigger) {
      const t = TIPS[wTrigger];
      return {
        ...t,
        weather: { temp: weather.temp, humidity: weather.humidity, precip: weather.precip },
        weatherCode: weather.code,
        trigger: wTrigger,
        source: "Open-Meteo current weather",
      };
    }
  }

  // 2) Profile-driven tip — alternate by day of month so it varies
  const day = new Date().getDate();
  if (profile.conditions.includes("pregnancy") && day % 4 === 0) {
    return { ...TIPS.pregnancy, trigger: "pregnancy", source: "Profile-personalised" };
  }
  if (profile.conditions.includes("diabetes") && day % 4 === 1) {
    return { ...TIPS.diabetic, trigger: "diabetic", source: "Profile-personalised" };
  }
  if (profile.conditions.includes("hypertension") && day % 4 === 2) {
    return { ...TIPS.hypertension, trigger: "hypertension", source: "Profile-personalised" };
  }
  if (profile.age != null && profile.age < 12 && day % 3 === 0) {
    return { ...TIPS.child, trigger: "child", source: "Profile-personalised" };
  }

  // 3) Seasonal default
  const seasonal = pickSeasonalTip(new Date().getMonth());
  return { ...TIPS[seasonal.trigger], trigger: seasonal.trigger, source: "Seasonal default" };
}
