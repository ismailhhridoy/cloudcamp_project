import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send, Info, Loader2, MicOff, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { cn } from "@/src/lib/utils";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { User } from "firebase/auth";

interface Message { role: "user" | "assistant"; content: string; }
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

    if (isOffline) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: checkOffline(userMessage) }]);
        setIsLoading(false);
      }, 600);
      return;
    }

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: messages }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: checkOffline(userMessage) }]);
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
    <div className="flex flex-col h-full">
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm prose prose-sm",
                msg.role === "user"
                  ? "bg-emerald-600 text-white rounded-tr-none prose-invert"
                  : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
              )}>
                <Markdown>{msg.content}</Markdown>
              </div>
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
      <div className="p-4 pb-20 bg-white border-t border-gray-100 shadow-lg">
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
      </div>
    </div>
  );
}
