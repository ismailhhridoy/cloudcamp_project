#!/usr/bin/env npx tsx
// ShasthyoAI MCP Server — exposes the medical knowledge base, clinical triage, prescription
// scanning, and diagnostic scoring as Model Context Protocol tools. This lets any MCP-capable
// client (Claude Desktop, Cursor, n8n, custom agents) tap into ShasthyoAI's clinical
// intelligence without running the full web app.
//
// Transports:
//   - stdio  (default, for CLI / Claude Desktop / Cursor integration)
//   - SSE    (--sse flag, for browser / n8n / remote agents)
//
// Usage:
//   npx tsx mcp-server.ts           # stdio transport
//   npx tsx mcp-server.ts --sse     # SSE transport on port 3001

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import http from "http";
import { classifySymptoms } from "./src/lib/safety.ts";

// ── Load the medical KB at startup ────────────────────────────────────────
const KB_PATH = path.resolve("public/medical-kb.json");
interface KbEntry {
  id: string;
  tags_en: string[];
  tags_bn: string[];
  severity: "mild" | "urgent" | "critical";
  title: { en: string; bn: string };
  summary: { en: string; bn: string };
  advice: { en: string; bn: string };
  seeDoctor: { en: string; bn: string };
}
interface KbDoc { version: number; updatedAt: string; source: string; entries: KbEntry[] }

let kb: KbDoc;
try {
  kb = JSON.parse(fs.readFileSync(KB_PATH, "utf-8")) as KbDoc;
  console.error(`[mcp] Loaded medical KB: ${kb.entries.length} entries, v${kb.version}`);
} catch (e) {
  console.error("[mcp] Failed to load medical-kb.json:", e);
  process.exit(1);
}

// ── Simple BM25 scorer (mirrors the in-browser rag.ts) ────────────────────
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[.,;:!?()"'`\-_/\\]/g, " ").split(/\s+/).filter(t => t.length >= 2);
}

function bm25Search(query: string, top = 3): { entry: KbEntry; score: number }[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const docs = kb.entries.map(e => {
    const text = [...e.tags_en, ...e.tags_bn, e.title.en, e.title.bn, e.summary.en, e.summary.bn].join(" ");
    const tokens = tokenize(text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return { entry: e, tokens, tf, len: tokens.length };
  });
  const N = docs.length;
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / N;
  const docFreq = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set(d.tokens);
    for (const t of seen) docFreq.set(t, (docFreq.get(t) || 0) + 1);
  }
  const results: { entry: KbEntry; score: number }[] = [];
  for (const d of docs) {
    let s = 0;
    for (const q of qTokens) {
      const df = docFreq.get(q) || 0;
      if (df === 0) continue;
      const tf = d.tf.get(q) || 0;
      if (tf === 0) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      s += idf * (tf * 2.5) / (tf + 1.5 * (1 - 0.75 + 0.75 * (d.len / avgLen)));
    }
    if (s > 0) results.push({ entry: d.entry, score: s });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, top);
}

// ── Create the MCP server ─────────────────────────────────────────────────
const server = new McpServer({
  name: "shasthyoai",
  version: "1.0.0",
  description: "ShasthyoAI — offline-first rural telehealth tools for Bangladesh. Exposes clinical triage, medical KB search, symptom safety classification, and diagnostic scoring.",
});

// ── Tool 1: Triage symptoms ──────────────────────────────────────────────
server.tool(
  "triage_symptoms",
  "Assess patient symptoms using the ShasthyoAI clinical decision tree. Returns a severity classification (mild/urgent/critical), tailored advice, and when to see a doctor. Bilingual (English + Bangla).",
  {
    symptoms: z.string().describe("Patient's symptoms in English or Bangla"),
    lang: z.enum(["en", "bn"]).default("en").describe("Response language"),
    patient_age: z.number().optional().describe("Patient age in years"),
    patient_sex: z.enum(["male", "female", "other"]).optional(),
    is_pregnant: z.boolean().optional(),
  },
  async ({ symptoms, lang, patient_age, patient_sex, is_pregnant }) => {
    const safety = classifySymptoms(symptoms);
    const matches = bm25Search(symptoms, 3);

    if (matches.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "no_match",
            safety_verdict: safety.verdict,
            safety_matched: safety.matched,
            message: lang === "bn"
              ? "আপনার লক্ষণের সাথে মেলে এমন তথ্য পাওয়া যায়নি। নিকটতম স্বাস্থ্য কমপ্লেক্সে যান বা ৯৯৯-এ কল করুন।"
              : "No matching condition found in the knowledge base. Visit the nearest health complex or call 999.",
          }, null, 2),
        }],
      };
    }

    const top = matches[0].entry;
    const header = {
      critical: lang === "bn" ? "🚨 এখনই হাসপাতালে যান" : "🚨 GO TO HOSPITAL NOW",
      urgent: lang === "bn" ? "⚠️ আজই ডাক্তার দেখান" : "⚠️ See a doctor today",
      mild: lang === "bn" ? "🏠 বাড়িতে প্রাথমিক চিকিৎসা" : "🏠 FIRST-AID AT HOME",
    }[top.severity];

    const result = {
      condition: top.title[lang],
      severity: top.severity,
      safety_verdict: safety.verdict,
      safety_flags: safety.matched,
      verdict_header: header,
      summary: top.summary[lang],
      advice: top.advice[lang],
      when_to_see_doctor: top.seeDoctor[lang],
      confidence_score: Math.round(matches[0].score * 100) / 100,
      patient_context: {
        age: patient_age,
        sex: patient_sex,
        pregnant: is_pregnant,
        risk_factors: [
          ...(patient_age && patient_age < 1 ? ["infant"] : []),
          ...(patient_age && patient_age < 5 ? ["young_child"] : []),
          ...(patient_age && patient_age > 65 ? ["elderly"] : []),
          ...(is_pregnant ? ["pregnant"] : []),
        ],
      },
      related_conditions: matches.slice(1).map(m => ({
        condition: m.entry.title[lang],
        severity: m.entry.severity,
        score: Math.round(m.score * 100) / 100,
      })),
      disclaimer: lang === "bn"
        ? "⚠️ এটি AI পরামর্শ। সম্ভব হলে একজন ডাক্তার দেখান।"
        : "⚠️ This is AI guidance only. Please consult a real doctor when possible.",
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool 2: Search medical KB ────────────────────────────────────────────
server.tool(
  "search_medical_kb",
  "Search the ShasthyoAI medical knowledge base (82 bilingual clinical protocols covering common rural Bangladesh conditions). Returns matching entries with severity, advice, and referral guidance.",
  {
    query: z.string().describe("Search query — symptoms, condition name, or keywords in English or Bangla"),
    lang: z.enum(["en", "bn"]).default("en").describe("Response language"),
    top_k: z.number().min(1).max(10).default(5).describe("Number of results to return"),
  },
  async ({ query, lang, top_k }) => {
    const results = bm25Search(query, top_k);
    const entries = results.map(r => ({
      id: r.entry.id,
      title: r.entry.title[lang],
      severity: r.entry.severity,
      summary: r.entry.summary[lang],
      advice: r.entry.advice[lang],
      when_to_see_doctor: r.entry.seeDoctor[lang],
      relevance_score: Math.round(r.score * 100) / 100,
    }));
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          query,
          total_kb_entries: kb.entries.length,
          kb_version: kb.version,
          results_count: entries.length,
          results: entries,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 3: Safety classifier ────────────────────────────────────────────
server.tool(
  "classify_safety",
  "Run the ShasthyoAI bilingual safety classifier on patient input. Detects 30+ red-flag patterns (cardiac, respiratory, obstetric, psychiatric, paediatric emergencies) in English and Bangla. Returns critical/urgent/routine verdict.",
  {
    text: z.string().describe("Patient's message or symptom description"),
  },
  async ({ text }) => {
    const result = classifySymptoms(text);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          verdict: result.verdict,
          matched_flags: result.matched,
          reason_en: result.reason_en,
          reason_bn: result.reason_bn,
          is_emergency: result.verdict === "critical",
          action: result.verdict === "critical"
            ? "IMMEDIATE: Direct patient to call 999 or go to nearest hospital NOW."
            : result.verdict === "urgent"
            ? "URGENT: Patient should see a doctor today."
            : "ROUTINE: Monitor symptoms, home care may be appropriate.",
        }, null, 2),
      }],
    };
  }
);

// ── Tool 4: List all KB conditions ───────────────────────────────────────
server.tool(
  "list_conditions",
  "List all medical conditions in the ShasthyoAI knowledge base, grouped by severity. Useful for understanding the system's clinical coverage.",
  {
    severity_filter: z.enum(["all", "critical", "urgent", "mild"]).default("all").describe("Filter by severity level"),
    lang: z.enum(["en", "bn"]).default("en").describe("Response language"),
  },
  async ({ severity_filter, lang }) => {
    const filtered = severity_filter === "all"
      ? kb.entries
      : kb.entries.filter(e => e.severity === severity_filter);
    const grouped = {
      critical: filtered.filter(e => e.severity === "critical").map(e => ({ id: e.id, title: e.title[lang] })),
      urgent: filtered.filter(e => e.severity === "urgent").map(e => ({ id: e.id, title: e.title[lang] })),
      mild: filtered.filter(e => e.severity === "mild").map(e => ({ id: e.id, title: e.title[lang] })),
    };
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          total: filtered.length,
          kb_version: kb.version,
          updated_at: kb.updatedAt,
          conditions: grouped,
        }, null, 2),
      }],
    };
  }
);

// ── Tool 5: Get condition detail ─────────────────────────────────────────
server.tool(
  "get_condition",
  "Get full details for a specific medical condition from the ShasthyoAI knowledge base by ID. Returns bilingual title, summary, advice, and referral guidance.",
  {
    condition_id: z.string().describe("Condition ID (e.g. 'fever-adult-mild', 'dengue', 'choking-infant')"),
  },
  async ({ condition_id }) => {
    const entry = kb.entries.find(e => e.id === condition_id);
    if (!entry) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: "Condition not found",
            available_ids: kb.entries.map(e => e.id).slice(0, 20),
            hint: "Use list_conditions to see all available IDs.",
          }, null, 2),
        }],
      };
    }
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          id: entry.id,
          severity: entry.severity,
          title_en: entry.title.en,
          title_bn: entry.title.bn,
          summary_en: entry.summary.en,
          summary_bn: entry.summary.bn,
          advice_en: entry.advice.en,
          advice_bn: entry.advice.bn,
          see_doctor_en: entry.seeDoctor.en,
          see_doctor_bn: entry.seeDoctor.bn,
          tags_en: entry.tags_en,
          tags_bn: entry.tags_bn,
        }, null, 2),
      }],
    };
  }
);

// ── Resource: Medical KB metadata ────────────────────────────────────────
server.resource(
  "kb-metadata",
  "shasthyoai://kb/metadata",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({
        name: "ShasthyoAI Medical Knowledge Base",
        version: kb.version,
        updated_at: kb.updatedAt,
        source: kb.source,
        total_entries: kb.entries.length,
        severity_breakdown: {
          critical: kb.entries.filter(e => e.severity === "critical").length,
          urgent: kb.entries.filter(e => e.severity === "urgent").length,
          mild: kb.entries.filter(e => e.severity === "mild").length,
        },
        languages: ["en", "bn"],
        coverage: "Common rural Bangladesh conditions: fever, diarrhea, cholera, dengue, pregnancy complications, snake bite, choking, drowning, TB, meningitis, arsenic poisoning, and 70+ more.",
      }, null, 2),
    }],
  })
);

// ── Start the server ─────────────────────────────────────────────────────
const useSSE = process.argv.includes("--sse");
const SSE_PORT = parseInt(process.env.MCP_PORT || "3001", 10);

if (useSSE) {
  // SSE transport — for browser clients, n8n, remote agents.
  const transports: Map<string, SSEServerTransport> = new Map();
  const httpServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url || "/", `http://localhost:${SSE_PORT}`);
    if (url.pathname === "/sse" && req.method === "GET") {
      const transport = new SSEServerTransport("/messages", res);
      transports.set(transport.sessionId, transport);
      res.on("close", () => transports.delete(transport.sessionId));
      await server.connect(transport);
    } else if (url.pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) { res.writeHead(404); res.end("Session not found"); return; }
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          await transport.handlePostMessage(req, res, body);
        } catch (e) {
          res.writeHead(500);
          res.end(String(e));
        }
      });
    } else if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: 5, kb_entries: kb.entries.length }));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  httpServer.listen(SSE_PORT, () => {
    console.error(`[mcp] ShasthyoAI MCP server (SSE) listening on http://localhost:${SSE_PORT}`);
    console.error(`[mcp] SSE endpoint: http://localhost:${SSE_PORT}/sse`);
    console.error(`[mcp] Health check: http://localhost:${SSE_PORT}/health`);
  });
} else {
  // stdio transport — for Claude Desktop, Cursor, CLI.
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] ShasthyoAI MCP server running on stdio");
}
