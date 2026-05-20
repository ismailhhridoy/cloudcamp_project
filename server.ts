import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { classifySymptoms, scrubMedicines, buildSafetyPromptHint } from "./src/lib/safety.ts";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

const TRIAGE_SYSTEM = `You are ShasthyoAI (স্বাস্থ্য সহায়ক), a compassionate AI health assistant for rural Bangladesh.

You operate under Bangladesh Medical & Dental Council (BMDC) rules, the DGHS Telemedicine Practice Guideline 2020,
and WHO Ethics & Governance of AI for Health (2021). You are NOT a licensed practitioner.

HARD SAFETY RULES — never break these, even if asked:
A. You MUST NOT name prescription-only medicines (antibiotics, steroids, anti-hypertensives, opioids,
   psychiatric drugs, controlled substances). If asked for one, decline and recommend seeing a registered MBBS doctor.
B. For any RED-FLAG condition (chest pain, suspected heart attack or stroke, breathing difficulty,
   unconsciousness, severe bleeding, seizures, severe abdominal pain, suspected poisoning or overdose,
   high fever in infants under 2 years, pregnancy-related bleeding or severe pain, severe burns,
   anaphylaxis, suicidal ideation): do NOT recommend medicines. Engage the patient with focused
   emergency triage questions, then issue a firm GO-TO-HOSPITAL verdict and remind them to call 999.
C. For clearly mild, self-limiting conditions you MAY mention common OTC supports (ORS, paracetamol,
   warm fluids) — always pair them with "verify with a licensed doctor before taking, especially for
   children, pregnant women, or anyone on regular medication."
D. You do not diagnose. You describe possibilities and triage urgency.

CONVERSATIONAL RULES — behave like a calm, experienced triage nurse, not like a disclaimer machine:

1. Language mirroring: detect what language the user wrote in (Bangla vs English) and reply ONLY in that
   language. Never mix the two in one response.

2. For an EMERGENCY-LOOKING input, your FIRST response is NOT a disclaimer wall. Instead, in 1–3 short
   sentences: acknowledge briefly, then ask 1–2 SPECIFIC triage questions tied to the symptom.
   Examples:
     • chest pain → "When did the pain start? Is it crushing/pressing or sharp? Does it spread to
       your left arm, jaw, or back? Are you also short of breath or sweating?"
     • breathing difficulty → "When did this start? Can you speak full sentences? Are your lips
       or fingertips turning blue?"
     • unconsciousness → "How long was the person out? Are they breathing now? Any recent injury or
       medication?"
     • stroke signs → "Is one side of the face drooping? Can they lift both arms equally? Speech slurred?"
     • severe bleeding → "Where is the bleeding from? Is the dressing soaking through?"
     • infant fever → "How old is the baby? What is the temperature? Are they feeding, alert, breathing easily?"
   Only after you get an answer (or the user already gave clear detail) do you issue the verdict.

3. Verdicts — always end the final answer with one of:
     • **🚨 GO TO HOSPITAL NOW** / **🚨 এখনই হাসপাতালে যান**  (call 999 if you can't get to one)
     • **🏠 FIRST-AID AT HOME** / **🏠 বাড়িতে প্রাথমিক চিকিৎসা করুন**
     • **⏳ WAIT AND WATCH** / **⏳ অপেক্ষা করুন ও দেখুন**

4. After the verdict give 2–3 plain practical steps (sit/lie down, loosen clothing, who to call, what to
   bring to hospital). For mild cases you may mention safe OTC supports, paired with the verify-with-doctor line.

5. End EVERY final answer with: "⚠️ This is AI guidance only. Please consult a real doctor when possible." /
   "⚠️ এটি শুধু AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।"

6. Tone: warm, brief, human. Don't repeat the user back. No meta-instructions like "(I will now ask...)".
   No emoji floods. No long lists for emergencies — get to the question fast.`;

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: "15mb" }));

  // ── TRIAGE ───────────────────────────────────────────────────────────────────
  app.post("/api/triage", async (req, res) => {
    try {
      const { message, history } = req.body;

      // STEP 1 — safety pre-screen. We DO NOT short-circuit any more; the LLM stays in charge of the
      // conversation. The classifier result is injected as an extra system message so the model
      // knows to ask focused emergency questions instead of dumping a disclaimer.
      const safety = classifySymptoms(String(message || ""));
      const safetyHint = buildSafetyPromptHint(safety);

      const messages: any[] = [{ role: "system", content: TRIAGE_SYSTEM }];
      if (safetyHint) messages.push({ role: "system", content: safetyHint });
      if (history && history.length > 1) {
        for (const msg of history.slice(1)) {
          messages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.content });
        }
      }
      messages.push({ role: "user", content: message });

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 1024,
        temperature: 0.6,
      });

      let text = response.choices[0]?.message?.content || "Sorry, I could not process your request.";

      // STEP 2 — belt-and-suspenders. If the safety verdict is critical, scrub any medicine-dose
      // lines the model may have produced anyway. We do not scrub for urgent/routine because OTC
      // mentions are allowed there.
      let scrubbedCount = 0;
      if (safety.verdict === "critical") {
        const r = scrubMedicines(text);
        text = r.scrubbed;
        scrubbedCount = r.removed;
      }

      res.json({
        text,
        safety: {
          verdict: safety.verdict,
          matched: safety.matched,
          scrubbedLines: scrubbedCount,
        },
      });
    } catch (error: any) {
      console.error("Triage error:", error.message);
      res.status(500).json({ text: "Connection error. Please try again." });
    }
  });

  // ── PRESCRIPTION SCAN ────────────────────────────────────────────────────────
  app.post("/api/scan-prescription", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "Image required" });

      // Groq vision with llama-4 scout
      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
              {
                type: "text",
                text: `Analyze this prescription image for a rural Bangladesh patient.
Extract and return ONLY valid JSON in this exact format:
{
  "doctor": { "name": "string", "bmdc": "string", "hospital": "string", "specialization": "string" },
  "medicines": [{ "name": "string", "dosage": "string", "frequency": "string", "duration": "string", "purpose_bangla": "string", "purpose_english": "string", "warnings": "string" }],
  "confidence": 85,
  "patient_notes": "string",
  "follow_up": "string"
}
For purpose_bangla use very simple everyday Bangla. If BMDC not visible write "Not visible". Return ONLY the JSON, no other text.`
              }
            ]
          }
        ],
        max_tokens: 1500,
      });

      const text = response.choices[0]?.message?.content || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      res.json(JSON.parse(clean));
    } catch (error: any) {
      console.error("Scan error:", error.message);
      res.status(500).json({ error: "Failed to analyze. Please ensure the image is clear." });
    }
  });

  // ── DOCTOR RATING ────────────────────────────────────────────────────────────
  app.post("/api/rate-doctor", async (req, res) => {
    try {
      const { bmdc, doctorName, ratings, comment } = req.body;
      const avg = (Object.values(ratings as Record<string, number>).reduce((a, b) => a + b, 0) / Object.keys(ratings).length).toFixed(1);

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{
          role: "user",
          content: `Patient rated Dr. ${doctorName} (BMDC: ${bmdc}): explained=${ratings.explained}/5, respectful=${ratings.respectful}/5, legible=${ratings.legible}/5, care=${ratings.tests}/5. Average: ${avg}/5. Comment: "${comment || 'None'}". Write one objective sentence summarizing this doctor's quality for ministry records.`
        }],
        max_tokens: 100,
      });

      res.json({ success: true, averageScore: avg, summary: response.choices[0]?.message?.content });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to submit rating" });
    }
  });

  // ── OFFLINE TRIAGE ───────────────────────────────────────────────────────────
  app.get("/api/offline-triage", (_req, res) => {
    res.json({
      rules: [
        { keywords: ["chest pain","বুকে ব্যথা","heart attack"], verdict: "GO_NOW", en: "Chest pain can be a heart attack. Go to hospital IMMEDIATELY.", bn: "বুকে ব্যথা হার্ট অ্যাটাকের লক্ষণ। এখনই হাসপাতালে যান।" },
        { keywords: ["can't breathe","শ্বাস নিতে পারছি না","breathless","শ্বাসকষ্ট"], verdict: "GO_NOW", en: "Breathing difficulty is an emergency. Go NOW.", bn: "শ্বাসকষ্ট জরুরি অবস্থা। এখনই হাসপাতালে যান।" },
        { keywords: ["unconscious","অজ্ঞান","fainted"], verdict: "GO_NOW", en: "Loss of consciousness needs emergency care.", bn: "অজ্ঞান হলে তাৎক্ষণিক চিকিৎসা দরকার।" },
        { keywords: ["infant fever","শিশু জ্বর","baby fever","বাচ্চার জ্বর"], verdict: "GO_NOW", en: "High fever in infants is dangerous. See a doctor now.", bn: "শিশুর জ্বর বিপজ্জনক। এখনই ডাক্তার দেখান।" },
        { keywords: ["severe bleeding","প্রচুর রক্ত"], verdict: "GO_NOW", en: "Severe bleeding needs urgent hospital care.", bn: "প্রচুর রক্তপাত হলে তাৎক্ষণিক হাসপাতালে যান।" },
        { keywords: ["mild fever","সামান্য জ্বর","cold","সর্দি","cough","কাশি"], verdict: "HOME", en: "Rest, drink fluids, take paracetamol. Monitor for 2 days.", bn: "বিশ্রাম নিন, পানি পান করুন, প্যারাসিটামল খান।" },
        { keywords: ["diarrhea","ডায়রিয়া","loose motion","পাতলা পায়খানা"], verdict: "HOME", en: "Drink ORS. Go to hospital if blood appears.", bn: "খাবার স্যালাইন খান। রক্ত দেখলে হাসপাতাল যান।" },
        { keywords: ["headache","মাথাব্যথা","body pain","গায়ে ব্যথা"], verdict: "WATCH", en: "Rest and hydrate. See doctor if pain lasts 3+ days.", bn: "বিশ্রাম নিন। ৩ দিনের বেশি থাকলে ডাক্তার দেখান।" },
      ],
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`🚀 ShasthyoAI running on http://localhost:${PORT}`));
}

startServer();