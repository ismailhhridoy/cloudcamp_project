import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

const TRIAGE_SYSTEM = `You are ShasthyoAI (স্বাস্থ্য সহায়ক), a compassionate AI health assistant for rural Bangladesh.

RULES:
1. Detect the language the user wrote in. If they wrote in Bangla, respond ONLY in Bangla. If they wrote in English, respond ONLY in English. Never mix both in the same response.
2. Ask at most 1 clarifying follow-up question naturally — like a caring doctor would. Never add meta-instructions like "(Please respond...)" or "(I'll ask one more question)".
3. After enough information, ALWAYS end with one of these verdicts in bold:
   - **🚨 এখনই হাসপাতালে যান** (if user spoke Bangla) or **🚨 GO TO HOSPITAL NOW** (if English)
   - **🏠 বাড়িতে প্রাথমিক চিকিৎসা করুন** or **🏠 FIRST-AID AT HOME**
   - **⏳ অপেক্ষা করুন ও দেখুন** or **⏳ WAIT AND WATCH**
4. After verdict give 2-3 simple practical steps.
5. Emergency triggers (immediate GO TO HOSPITAL): chest pain, breathing difficulty, severe bleeding, unconsciousness, infant high fever, stroke signs.
6. End every final verdict response with: "⚠️ এটি শুধু AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।" or "⚠️ This is AI guidance only. Please consult a real doctor when possible."
7. Be warm, brief, and human. Never robotic. Never repeat what the user said back to them.`;

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: "15mb" }));

  // ── TRIAGE ───────────────────────────────────────────────────────────────────
  app.post("/api/triage", async (req, res) => {
    try {
      const { message, history } = req.body;

      const messages: any[] = [{ role: "system", content: TRIAGE_SYSTEM }];
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
        temperature: 0.7,
      });

      const text = response.choices[0]?.message?.content || "Sorry, I could not process your request.";
      res.json({ text });
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