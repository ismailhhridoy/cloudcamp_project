# CareAid AI — স্বাস্থ্য সহায়ক

> **AI-powered bilingual health companion for rural Bangladesh**
> Offline-first · Voice-enabled · DGHS-compliant · MCP-ready

Built for **The Infinity AI BuildFest 2026** by **Team MindMatrix**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-CareAid%20AI-emerald)](https://careaid-ai.onrender.com)
[![MCP Server](https://img.shields.io/badge/MCP-Clinical%20Tools-blue)](./mcp-server.ts)
[![License](https://img.shields.io/badge/License-Apache%202.0-green)](./LICENSE)

---

## The Problem

**50 million rural Bangladeshis** make life-or-death health decisions every day with:

- No doctor within reach — nearest qualified physician may be hours away
- No one to explain their prescription — handwritten Bengali prescriptions are unreadable to most patients
- No way to verify if their treatment is correct — no BMDC doctor registry accessible to the public
- No connectivity guarantee — 2G/3G dropout is common in rural upazilas

When a mother's infant has a 103°F fever at midnight, she needs guidance in 10 seconds — not a 2-hour trip to a district hospital.

---

## Our Solution

CareAid AI is a **voice-first, Bangla/English AI health companion** that works even without internet. It combines cloud AI quality with complete offline fallback — so rural patients always get a response, even with zero signal.

| Module | What it does |
|---|---|
| 🎙️ **AI Symptom Triage** | Speak or type symptoms in Bangla or English — get a color-coded verdict: HOME-CARE / SEE DOCTOR / GO TO HOSPITAL NOW with bilingual action steps |
| 📋 **Prescription Scanner** | Photograph any handwritten prescription — AI extracts medicines, doses, doctor BMDC, and reads it aloud in plain Bangla |
| 🏥 **Doctor Registry** | Verify BMDC license, view AI legibility scores, submit anonymous prescription-readability ratings |
| 📊 **Patient Dashboard** | Personal health history, saved prescriptions, triage chat archive, dose reminders |
| 👨‍⚕️ **MBBS Audit Portal** | Licensed doctors review AI outputs, rate accuracy, sign monthly compliance certifications |
| ⚙️ **MCP Clinical Server** | Exposes all clinical tools as MCP-callable endpoints for Claude Desktop, Cursor, and n8n workflows |

---

## Architecture — Graceful Degradation by Design

Every feature has a complete fallback chain. **No single point of failure can leave a patient without guidance.**

```
User Message
     │
     ▼
Safety Classifier (safety.ts) ← 30+ bilingual red-flag keywords
     │ CRITICAL → "GO TO HOSPITAL NOW" (overrides everything)
     │ SAFE ↓
     ▼
BM25 RAG Retrieval (rag.ts) ← medical-kb.json (42 clinical entries)
     │
     ▼
Tier Router (tierRouter.ts)
     │
     ├─── Online? ──→ Groq Cloud API (Llama/Mixtral) ← best quality
     │                      │ fail ↓
     ├─── WASM LLM ready? → SmolLM2-360M ONNX (in-browser CPU) ← offline
     │                      │ fail ↓
     ├─── KB confident? ──→ BM25 Decision Tree (decisionTree.ts) ← sub-10ms
     │                      │ fail ↓
     └─── Last resort ────→ Offline keyword rules ← always works
```

### Prescription Scan Fallback Chain
```
Upload Image
     │
     ├─── Online? ──→ Gemini 2.5 Flash Vision API ← structured JSON
     │                      │ fail ↓
     └─── Offline ────────→ Tesseract.js v7 LSTM (WASM, eng+ben) ← on-device OCR
                                   │
                                   └→ SmolLM2 shapes raw OCR text → ExtractedPrescription
```

---

## AI Stack

### Cloud Models (online preferred)
| Model | Provider | Role |
|---|---|---|
| Llama-3 / Mixtral | Groq API | Triage inference — low latency, free tier |
| Gemini 2.5 Flash | Google AI | Prescription OCR → structured JSON |

### On-Device Models (offline, zero cost)
| Model | Size | Role | Runtime |
|---|---|---|---|
| SmolLM2-360M-Instruct | ~200 MB (q4 ONNX) | Conversational triage | Transformers.js / ONNX Runtime Web (WASM) |
| Whisper-tiny | ~75 MB (q4 ONNX) | Bangla + English STT | Transformers.js / ONNX Runtime Web (WASM) |
| Tesseract LSTM | ~15 MB | Prescription OCR (eng+ben) | Tesseract.js v7 |

### Retrieval (BM25, no vector DB)
- Custom in-browser BM25 engine (`src/lib/rag.ts`)
- 42-entry curated medical KB (`public/medical-kb.json`) — WHO IMCI + DGHS Telemedicine Guideline 2020 + icddr,b protocols
- Sub-10ms retrieval, zero infrastructure cost
- Confidence threshold (1.5) gates KB-direct vs LLM escalation

---

## MCP Server — Clinical Tools for AI Agents

CareAid AI exposes its full clinical intelligence as an MCP server, allowing Claude Desktop, Cursor, n8n, and any MCP-compatible agent to call vetted medical tools directly.

```bash
# Run MCP server (Streamable HTTP)
npm run mcp

# Run MCP server (SSE legacy)
npm run mcp:sse
```

### Available Tools

| Tool | Description |
|---|---|
| `triage_symptoms` | Assess symptom urgency — returns verdict + bilingual action steps |
| `scan_prescription` | Extract structured data from prescription image (base64) |
| `find_nearby_hospitals` | Nearest hospitals + free test centers by district/GPS |
| `get_health_tips` | Personalised health tips by patient profile |
| `rate_doctor_legibility` | Submit prescription legibility rating for a BMDC doctor |

### Connect via Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "careaid-ai": {
      "url": "https://careaid-ai.onrender.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

---

## Tech Stack

### Frontend
- **React 19** — component architecture, hooks-based state
- **TypeScript** — strict type safety, `src/lib/types.ts` (293-line domain interfaces)
- **Vite 6** — build tool, HMR, PWA bundler
- **Tailwind CSS 4** — utility-first, responsive mobile-first design
- **Framer Motion** — page transitions, AnimatePresence
- **react-markdown** — renders LLM Markdown responses in chat UI
- **Lucide React** — icon system

### AI & ML
- **Transformers.js** (@huggingface/transformers ^4.2.0) — ONNX Runtime Web for SmolLM2 + Whisper
- **Tesseract.js v7** — in-browser OCR (WASM LSTM, eng+ben)
- **Groq SDK** — cloud triage inference
- **@google/genai** — Gemini prescription OCR
- **@modelcontextprotocol/sdk** — MCP server implementation

### Backend & Data
- **Express.js 4** — REST API + MCP server
- **Firebase JS SDK v12** — Firestore (offline-persistent), Auth
- **Firestore** — document-per-entity, offline IndexedDB cache
- **localStorage** — KV cache with pub/sub for offline-first reactivity
- **Zod** — runtime schema validation

### PWA & Offline
- **vite-plugin-pwa** — service worker, offline asset caching, installable manifest
- All 3 AI models cached in browser IndexedDB after first opt-in download
- Full triage + prescription scan + voice input work with zero connectivity

---

## Data Sources

| Source | Description |
|---|---|
| `public/medical-kb.json` | 42-entry clinical KB (WHO IMCI, DGHS 2020, icddr,b) |
| `public/hospitals.json` | Bangladesh public hospital directory |
| `public/free-test-locations.json` | Free diagnostic test centers by district |
| `public/regional-disease.json` | Regional disease prevalence + weekly trend data |
| Firebase Firestore | Patient profiles, prescriptions, triage history, doctor accounts |
| Groq API | Cloud LLM inference |
| Gemini API | Multimodal prescription OCR |

---

## Getting Started

### Prerequisites
- Node.js v18+
- Groq API key — free at [console.groq.com](https://console.groq.com)
- Google AI API key — free at [aistudio.google.com](https://aistudio.google.com) (for prescription scan)
- Firebase project (optional — app works fully in mock/offline mode without it)

### Installation

```bash
git clone https://github.com/your-org/cloudcamp_project.git
cd cloudcamp_project
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here
```

For Firebase (optional), update `firebase-applet-config.json`:
```json
{
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "your-sender-id",
  "appId": "your-app-id"
}
```
> Leave as `"MOCK"` values to run fully offline without Firebase.

### Run Development Server

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Run MCP Server

```bash
npm run mcp          # Streamable HTTP
npm run mcp:sse      # SSE legacy mode
```

### Production Build

```bash
npm run build
npm start
```

---

## Offline AI Models

Download AI models for fully offline operation via the **Settings** page in the app:

| Model | Size | Feature unlocked |
|---|---|---|
| SmolLM2-360M | ~200 MB | Offline triage chat |
| Whisper-tiny | ~75 MB | Voice input without internet |
| Tesseract (eng+ben) | ~15 MB | Offline prescription OCR |

Models are cached in browser IndexedDB and persist across sessions.

---

## Safety & Compliance

- **DGHS Telemedicine Practice Guideline 2020** — all triage protocols follow Bangladesh national guidelines
- **BMDC verification** — doctor registry cross-references Bangladesh Medical & Dental Council numbers
- **30+ bilingual safety patterns** — cardiac, respiratory, neurological, obstetric, psychiatric, paediatric emergencies in English + Bangla
- **Hard medicine restrictions** — LLM cannot name prescription-only medicines (antibiotics, steroids, opioids)
- **Monthly MBBS audit** — licensed doctors review and certify AI outputs every 30 days
- **Mandatory disclaimer** — every AI response ends with bilingual "consult a real doctor" notice
- **Consent gate** — explicit user consent required before any data collection

---

## Firestore Security Rules

Per-owner data isolation enforced at the database level:

```
users/{uid}/* → readable/writable by owner only
doctors/* → readable by all, writable by authenticated users
legibilityScores/* → readable by all, writable by authenticated users
auditSamples/* → readable/writable by authenticated doctors
certifications/* → readable by all, writable by verified MBBS doctors
```

---

## Project Structure

```
├── src/
│   ├── components/          # AppShell, AuthModal, DiagnosticPanel, DoseGrid...
│   ├── pages/               # Home, Triage, Scanner, Doctors, Dashboard, DoctorPortal...
│   └── lib/
│       ├── tierRouter.ts    # Multi-model cascade orchestrator
│       ├── safety.ts        # Bilingual safety classifier
│       ├── rag.ts           # Custom BM25 retrieval engine
│       ├── decisionTree.ts  # 82-entry clinical decision tree
│       ├── store.ts         # localStorage KV store with pub/sub
│       ├── db.ts            # Firestore ↔ localStorage sync layer
│       ├── firebase.ts      # Firebase Auth + Firestore bootstrap
│       ├── tesseractEngine.ts  # In-browser OCR pipeline
│       ├── transformersEngine.ts # SmolLM2 WASM inference
│       ├── voiceEngine.ts   # Whisper-tiny STT pipeline
│       ├── diagnostic.ts    # Risk scoring engine (0–100)
│       └── types.ts         # 293-line domain interface definitions
├── public/
│   ├── medical-kb.json      # 42-entry curated clinical knowledge base
│   ├── hospitals.json       # Bangladesh hospital directory
│   ├── regional-disease.json # Regional disease prevalence data
│   └── free-test-locations.json # Free diagnostic test centers
├── server.ts                # Express.js backend (5 REST endpoints + webhooks)
├── mcp-server.ts            # MCP server (5 clinical tools)
├── firestore.rules          # Firestore security rules
├── firebase-blueprint.json  # Firestore schema reference
└── mcp-config.json          # MCP client configuration
```

---

## n8n Webhook Integration

CareAid AI fires structured JSON webhooks compatible with n8n, Zapier, or any automation platform:

**`POST /api/webhooks/prescription-scanned`**
```json
{
  "doctorName": "Dr. Rahman",
  "bmdc": "A-54321",
  "medicineCount": 3,
  "legibilityScore": 7,
  "severity": "routine",
  "userId": "pat_abc123"
}
```

**`POST /api/webhooks/triage-completed`**
```json
{
  "verdict": "GO_TO_HOSPITAL",
  "symptomSummary": "Chest pain radiating to left arm",
  "actionRecommended": "Call 999 immediately",
  "district": "Feni"
}
```

---

## Team

**Team MindMatrix** — Built for The Infinity AI BuildFest 2026

---

## License

Apache 2.0 — see [LICENSE](./LICENSE)

---

> ⚠️ CareAid AI provides AI-assisted health guidance only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a licensed doctor for medical decisions.
