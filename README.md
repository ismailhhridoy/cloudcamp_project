cat > README.md << 'EOF'
# ShasthyoAI — স্বাস্থ্য সহায়ক

> AI-powered Bangla health companion for rural Bangladesh

Built for **The Infinity AI BuildFest 2026** by **Team MindMatrix**

---

## The Problem

50 million rural Bangladeshis make life-or-death health decisions every day with:
- No doctor nearby
- No one to explain their prescription
- No way to evaluate if their treatment was correct

## Our Solution

ShasthyoAI is a voice-first, Bangla-language AI health companion with 4 modules:

| Module | What it does |
|---|---|
| 🎙️ Symptom Triage | Speak in Bangla — get "Go NOW" vs "Wait and watch" |
| 📋 Prescription Reader | Scan any handwritten prescription, explained in plain Bangla |
| ⭐ Doctor Registry | Verify BMDC license, rate doctors anonymously |
| 📊 Ministry Dashboard | Real-time disease heatmap sent to health ministry |

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS + Framer Motion
- **AI:** Groq API (LLaMA 3.3 70B + LLaMA 4 Scout Vision)
- **Voice:** Web Speech API (Bangla + English)
- **Backend:** Express.js + Node.js
- **Database:** Firebase Firestore
- **Auth:** Firebase Google Auth
- **Offline:** Cached decision tree — works without internet

## Getting Started

### Prerequisites
- Node.js v18+
- Groq API key (free at console.groq.com)


