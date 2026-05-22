import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send, Info, Loader2, MicOff, WifiOff, Cpu, Cloud, BookOpen, UserRound } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { User } from "firebase/auth";
import { useLocalLLM } from "../lib/llm.ts";
import { useTfEngine } from "../lib/transformersEngine.ts";
import { chat as routerChat, type ChatSource } from "../lib/tierRouter.ts";
import { DiagnosticPanel } from "../components/DiagnosticPanel.tsx";
import { PatientProfileSheet } from "../components/PatientProfileSheet.tsx";
import { usePatientProfile, summariseProfile } from "../lib/profile.ts";

interface Message { role: "user" | "assistant"; content: string; safety?: { verdict: string; matched: string[]; scrubbedLines?: number }; source?: ChatSource; diagnosticForSymptoms?: string; }
interface OfflineRule { keywords: string[]; verdict: string; en: string; bn: string; }

export function TriagePage({ onLoginRequired, user }: { onLoginRequired: () => void; user: User | null }) {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: t("triage.welcome") },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineRules, setOfflineRules] = useState<OfflineRule[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const llm = useLocalLLM();
  const tf = useTfEngine();
  const profile = usePatientProfile();
  const [showProfile, setShowProfile] = useState(false);

  // Monitor online status
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // Prefetch offline rules
  useEffect(() => {
    fetch("/api/offline-triage").then(r => r.json()).then(d => setOfflineRules(d.rules || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const checkOffline = useCallback((text: string) => {
    const lower = text.toLowerCase();
    for (const rule of offlineRules) {
      if (rule.keywords.some(k => lower.includes(k))) {
        const verdictEmoji = rule.verdict === "GO_NOW" ? "🚨" : rule.verdict === "HOME" ? "🏠" : "⏳";
        const verdictLabel = rule.verdict === "GO_NOW" ? "GO TO HOSPITAL NOW" : rule.verdict === "HOME" ? "FIRST-AID AT HOME" : "WAIT AND WATCH";
        return `**${verdictEmoji} ${verdictLabel}**\n\n${rule.en}\n\n---\n\n**${verdictEmoji} ${verdictLabel}**\n\n${rule.bn}\n\n⚠️ Offline mode — connect to internet for full AI analysis. / অফলাইন মোড — সম্পূর্ণ বিশ্লেষণের জন্য ইন্টারনেট সংযোগ করুন।`;
      }
    }
    return `I'm currently offline. Based on your symptoms, please monitor closely and seek medical care if symptoms worsen.\n\n---\n\nআমি এখন অফলাইনে আছি। আপনার লক্ষণ মনোযোগ দিয়ে দেখুন এবং অবস্থা খারাপ হলে ডাক্তার দেখান।`;
  }, [offlineRules]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Insert an empty assistant placeholder so streaming tokens can fill in live.
    // Stamp the same user message onto the assistant turn so the diagnostic panel
    // (which mounts under the bubble) can run its multi-factor analysis in parallel.
    let placeholderIndex = -1;
    setMessages(prev => {
      placeholderIndex = prev.length;
      return [...prev, { role: "assistant", content: "", diagnosticForSymptoms: userMessage }];
    });

    try {
      const result = await routerChat(
        messages.map(m => ({ role: m.role, content: m.content })),
        userMessage,
        {
          lang,
          onChunk: (_chunk, full, source) => {
            setMessages(prev =>
              prev.map((m, i) => (i === placeholderIndex ? { ...m, content: full, source } : m))
            );
          },
        }
      );
      // Final settle (also sets safety + source if it wasn't streamed).
      setMessages(prev =>
        prev.map((m, i) =>
          i === placeholderIndex
            ? { ...m, content: result.text, safety: result.safety as any, source: result.source }
            : m
        )
      );
    } catch (err) {
      console.error("Triage router failed completely", err);
      setMessages(prev =>
        prev.map((m, i) =>
          i === placeholderIndex
            ? { ...m, content: checkOffline(userMessage), source: "rules" as ChatSource }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Step 1 — request mic permission explicitly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      alert(lang === "bn"
        ? "মাইক্রোফোন ব্যবহারের অনুমতি দিন। ব্রাউজার সেটিংস থেকে Allow করুন।"
        : "Microphone access denied. Please allow it in your browser settings.");
      return;
    }

    // Step 2 — check browser support (all vendor prefixes)
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;

    if (!SpeechRecognition) {
      alert(lang === "bn"
        ? "আপনার ব্রাউজার ভয়েস সাপোর্ট করে না। Chrome বা Safari ব্যবহার করুন।"
        : "Voice not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    // Step 3 — start recognition
    const recognition = new SpeechRecognition();
    recognition.lang = lang === "bn" ? "bn-BD" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      setInput(e.results[0][0].transcript);
      setIsRecording(false);
    };
    recognition.onerror = (e: any) => {
      if (e.error === "not-allowed") {
        alert(lang === "bn"
          ? "মাইক্রোফোন ব্লক করা আছে। সেটিংস থেকে Allow করুন।"
          : "Microphone blocked. Allow it in browser settings.");
      }
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  return (
    <div className="flex flex-col h-full lg:max-w-3xl lg:mx-auto lg:w-full lg:my-6 lg:rounded-3xl lg:overflow-hidden lg:shadow-xl lg:border lg:border-gray-100 lg:bg-white lg:min-h-[80vh]">
      {/* Profile sheet */}
      <AnimatePresence>
        {showProfile && <PatientProfileSheet onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      {/* Offline banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="bg-orange-500 text-white px-4 py-2 flex items-center gap-2 overflow-hidden">
            <WifiOff size={14} />
            <span className="text-xs font-bold">{lang === "bn" ? "অফলাইন মোড — সীমিত পরামর্শ উপলব্ধ" : "Offline Mode — Limited advice available"}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclaimer */}
      <div className="bg-amber-50 p-3 flex gap-3 border-b border-amber-100">
        <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-800 leading-tight"><strong>{t("triage.disclaimer")}</strong></p>
      </div>

      {/* Profile bar — drives the diagnostic engine */}
      <button
        onClick={() => setShowProfile(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
          <UserRound size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t("triage.profile.label")}</p>
          <p className="text-xs font-medium text-gray-800 truncate">{summariseProfile(profile, lang as "en" | "bn")}</p>
        </div>
        <span className="text-[10px] font-bold text-emerald-600">{t("triage.profile.edit")}</span>
      </button>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex flex-col gap-2", msg.role === "user" ? "items-end" : "items-start")}>
              <div className={cn(
                "max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm prose prose-sm",
                msg.role === "user"
                  ? "bg-emerald-600 text-white rounded-tr-none prose-invert"
                  : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
              )}>
                <Markdown>{msg.content || (msg.role === "assistant" ? "…" : "")}</Markdown>
              </div>
              {msg.role === "assistant" && msg.source && i > 0 && (
                <SourcePill source={msg.source} t={t} />
              )}
              {/* Multi-factor diagnostic panel — runs alongside the chat reply. */}
              {msg.role === "assistant" && msg.diagnosticForSymptoms && (
                <div className="w-full lg:max-w-[480px] mt-1">
                  <DiagnosticPanel
                    symptoms={msg.diagnosticForSymptoms}
                    onSetProfile={() => setShowProfile(true)}
                  />
                </div>
              )}
            </motion.div>
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 flex items-center gap-2 shadow-sm">
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span className="text-xs text-gray-500 font-medium italic">{t("triage.thinking")}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick prompts */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { en: "Fever & headache", bn: "জ্বর ও মাথাব্যথা" },
            { en: "Chest pain", bn: "বুকে ব্যথা" },
            { en: "Diarrhea", bn: "ডায়রিয়া" },
            { en: "Child not eating", bn: "শিশু খাচ্ছে না" },
          ].map((p, i) => (
            <button key={i} onClick={() => setInput(lang === "bn" ? p.bn : p.en)}
              className="shrink-0 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-medium text-emerald-700 whitespace-nowrap">
              {lang === "bn" ? p.bn : p.en}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 pb-20 lg:pb-4 bg-white border-t border-gray-100 shadow-lg">
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.9 }} onClick={toggleRecording}
            className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg",
              isRecording ? "bg-red-500 animate-pulse text-white" : "bg-emerald-600 text-white")}>
            {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
          </motion.button>
          <div className="flex-1 relative">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder={t("triage.placeholder")}
              className="w-full bg-gray-100 rounded-full py-3 px-5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={handleSend} disabled={isLoading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 disabled:opacity-40">
              <Send size={20} />
            </button>
          </div>
        </div>
        {isRecording && (
          <p className="text-center text-xs text-red-500 font-medium mt-2 animate-pulse">
            {lang === "bn" ? "শুনছি... কথা বলুন" : "Listening... speak now"}
          </p>
        )}
        <EngineStatus isOffline={isOffline} llmStatus={llm.status} tfStatus={tf.status} t={t} />
      </div>
    </div>
  );
}

function SourcePill({ source, t }: { source: ChatSource; t: (k: string) => string }) {
  const map = {
    cloud: { c: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <Cloud size={10} />, key: "triage.source.cloud" },
    kb: { c: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <BookOpen size={10} />, key: "triage.source.kb" },
    webllm: { c: "bg-blue-50 text-blue-700 border-blue-200", icon: <Cpu size={10} />, key: "triage.source.webllm" },
    wasm: { c: "bg-purple-50 text-purple-700 border-purple-200", icon: <Cpu size={10} />, key: "triage.source.wasm" },
    rules: { c: "bg-amber-50 text-amber-700 border-amber-200", icon: <BookOpen size={10} />, key: "triage.source.rules" },
  } as const;
  const m = map[source];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${m.c}`}>
      {m.icon} {t(m.key)}
    </span>
  );
}

function EngineStatus({ isOffline, llmStatus, tfStatus, t }: { isOffline: boolean; llmStatus: string; tfStatus: string; t: (k: string) => string }) {
  let key: string | null = null;
  if (isOffline && llmStatus === "ready") key = "triage.engine.webllmActive";
  else if (isOffline && tfStatus === "ready") key = "triage.engine.wasmActive";
  else if (isOffline) key = "triage.engine.rulesActive";
  else if (llmStatus === "ready" || tfStatus === "ready") key = "triage.engine.localReady";
  if (!key) return null;
  return <p className="text-center text-[10px] text-gray-400 font-medium mt-2">{t(key)}</p>;
}

