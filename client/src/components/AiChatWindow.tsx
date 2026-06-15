import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  User,
  Sparkles,
  X,
  Plus,
  FileText,
  Image as ImageIcon,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import axios from "axios";
import NovaChatLogo from "@/assets/nova-ai-logo.png";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content:
    | string
    | { type: "text"; text: string }[]
    | { type: "image_url"; image_url: { url: string } }[];
  preview?: string;
  id: string;
}

interface Props {
  onClose?: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ─── Storage Key ─────────────────────────────────────────────────────────────
const STORAGE_KEY = "novachat_ai_messages";

const getInitialMessages = (): Message[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [
    {
      id: "init",
      role: "assistant",
      content: "Hello! 👋 I'm NovaChat AI. Ask me anything — type, speak, or share an image!",
    },
  ];
};

// ─── Google Assistant Sound ───────────────────────────────────────────────────
const playGoogleSound = (type: "start" | "stop") => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const tone = (freq: number, t: number, dur: number, vol = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.linearRampToValueAtTime(0, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };

    const now = ctx.currentTime;
    if (type === "start") {
      tone(440, now + 0.00, 0.08);
      tone(554, now + 0.09, 0.08);
      tone(659, now + 0.18, 0.08);
      tone(880, now + 0.27, 0.12);
    } else {
      tone(659, now + 0.00, 0.10);
      tone(440, now + 0.12, 0.14);
    }
  } catch {}
};

// ─── TTS (Text to Speech) ────────────────────────────────────────────────────
const speakText = (text: string, onEnd?: () => void) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
};

const stopSpeaking = () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
};

// ─── Component ───────────────────────────────────────────────────────────────
const AiChatWindow = ({ onClose }: Props) => {
  const [messages, setMessages] = useState<Message[]>(getInitialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef("");
  const messagesRef = useRef<Message[]>(messages);
  const loadingRef = useRef(false);

  // Keep refs in sync — IMPORTANT for closures used in event callbacks
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      const toSave = messages.map((m) => ({
        ...m,
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
            ? m.content
                .filter((c) => c.type === "text")
                .map((c) => (c as any).text)
                .join(" ") || "[Image message]"
            : m.content,
        preview: undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }, [messages]);

  // ── Core function: send a plain text message (used by voice) ──
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || loadingRef.current) return;
    const msgId = Date.now().toString();
    const userMsg: Message = { id: msgId, role: "user", content: text.trim() };

    setMessages((prev) => {
      const updated = [...prev, userMsg];
      messagesRef.current = updated;

      setLoading(true);
      loadingRef.current = true;

      axios
        .post("/api/ai/chat", {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
        })
        .then(({ data }) => {
          const replyMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.reply,
          };
          setMessages((curr) => [...curr, replyMsg]);
        })
        .catch(() => {
          setMessages((curr) => [
            ...curr,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: "⚠️ Something went wrong. Please try again.",
            },
          ]);
        })
        .finally(() => {
          setLoading(false);
          loadingRef.current = false;
        });

      return updated;
    });

    setInput("");
  }, []);

  // ── Voice setup — only once on mount ──
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    setVoiceSupported(true);
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      const text = final || interim;
      finalTextRef.current = text;
      setInput(text);
    };

    rec.onend = () => {
      setIsListening(false);
      playGoogleSound("stop");
      const text = finalTextRef.current.trim();
      finalTextRef.current = "";
      if (text) {
        setTimeout(() => sendTextMessage(text), 400);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") console.error("Speech error:", e.error);
      setIsListening(false);
      finalTextRef.current = "";
    };

    recognitionRef.current = rec;

    // Cleanup on unmount
    return () => {
      try {
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
        rec.abort();
      } catch {}
    };
  }, [sendTextMessage]);

  // Close menu on outside click
  useEffect(() => {
    const h = () => setShowMenu(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  // ── Toggle mic ──
  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
    } else {
      finalTextRef.current = "";
      setInput("");
      try {
        recognitionRef.current.start();
        playGoogleSound("start");
        setIsListening(true);
      } catch {
        // Already started — abort and retry
        try {
          recognitionRef.current.abort();
        } catch {}
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            playGoogleSound("start");
            setIsListening(true);
          } catch {}
        }, 300);
      }
    }
  };

  // ── TTS toggle ──
  const toggleSpeak = (msg: Message) => {
    const text = getTextContent(msg.content);
    if (!text) return;
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      setSpeakingMsgId(msg.id);
      speakText(text, () => setSpeakingMsgId(null));
    }
  };

  // ── File select ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (type === "image" && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
    e.target.value = "";
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  // ── Send message (typed / file) ──
  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !selectedFile) || loading) return;
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
    }

    let userContent: Message["content"];
    let previewUrl: string | undefined;

    if (selectedFile) {
      const base64 = await toBase64(selectedFile);
      previewUrl = filePreview || undefined;
      if (selectedFile.type.startsWith("image/")) {
        userContent = [
          ...(trimmed ? [{ type: "text" as const, text: trimmed }] : []),
          { type: "image_url" as const, image_url: { url: base64 } },
        ];
      } else {
        userContent = trimmed
          ? `${trimmed}\n\n[File attached: ${selectedFile.name}]`
          : `[File attached: ${selectedFile.name}]`;
      }
    } else {
      userContent = trimmed;
    }

    const msgId = Date.now().toString();
    const userMsg: Message = { id: msgId, role: "user", content: userContent, preview: previewUrl };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSelectedFile(null);
    setFilePreview(null);
    setLoading(true);
    loadingRef.current = true;

    try {
      const { data } = await axios.post("/api/ai/chat", {
        messages: updated.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...updated, { id: (Date.now() + 1).toString(), role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...updated, { id: (Date.now() + 1).toString(), role: "assistant", content: "⚠️ Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const getTextContent = (content: Message["content"]): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const t = content.find((c) => c.type === "text");
      return t ? (t as any).text : "";
    }
    return "";
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/80 backdrop-blur-sm">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border shrink-0">
          <img src={NovaChatLogo} alt="NovaChat AI" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm">NovaChat AI</p>
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <p className="text-xs text-green-500 font-medium">Online · Powered by Groq</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0 mt-1">
                <img src={NovaChatLogo} alt="NovaChat" className="w-full h-full object-cover" />
              </div>
            )}

            <div className={`max-w-[75%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {msg.preview && (
                <img src={msg.preview} alt="uploaded" className="max-w-[240px] rounded-xl border border-border object-cover" />
              )}
              {!msg.preview && Array.isArray(msg.content) && msg.content.some((c) => c.type === "image_url") && (
                <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-xl text-xs text-muted-foreground">
                  <ImageIcon className="w-3.5 h-3.5" /> Image attached
                </div>
              )}
              {typeof msg.content === "string" && msg.content.includes("[File attached:") && (
                <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-xl text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  {msg.content.match(/\[File attached: (.+?)\]/)?.[1]}
                </div>
              )}
              {getTextContent(msg.content) && (
                <div className={`px-4 py-2.5 text-sm leading-relaxed rounded-2xl
                  ${msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"}`}>
                  {getTextContent(msg.content)}
                </div>
              )}

              {msg.role === "assistant" && getTextContent(msg.content) && (
                <button
                  onClick={() => toggleSpeak(msg)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition mt-0.5
                    ${speakingMsgId === msg.id
                      ? "bg-blue-500/15 text-blue-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  {speakingMsgId === msg.id ? (
                    <><VolumeX className="w-3 h-3" /> Stop</>
                  ) : (
                    <><Volume2 className="w-3 h-3" /> Listen</>
                  )}
                </button>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {/* Typing dots */}
        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0 mt-1">
              <img src={NovaChatLogo} alt="NovaChat" className="w-full h-full object-cover" />
            </div>
            <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── File preview bar ── */}
      {selectedFile && (
        <div className="px-4 py-2 border-t flex items-center gap-2 bg-muted/40">
          {filePreview ? (
            <img src={filePreview} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-border" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border border-border">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <span className="text-sm text-muted-foreground flex-1 truncate">{selectedFile.name}</span>
          <button onClick={removeFile} className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Listening indicator ── */}
      {isListening && (
        <div className="px-4 py-2 bg-blue-500/10 border-t border-blue-500/20 flex items-center gap-3">
          <div className="flex items-end gap-0.5 h-5">
            {[0.5, 1, 0.75, 1, 0.5].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500 rounded-full"
                style={{
                  height: `${h * 100}%`,
                  animation: `pulse 600ms ease-in-out ${i * 100}ms infinite alternate`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-blue-500 font-medium">Listening... speak now</span>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="px-4 py-3 border-t flex items-center gap-2">
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />

        {/* + menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu((p) => !p); }}
            className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition shrink-0"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
          {showMenu && (
            <div className="absolute bottom-11 left-0 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50 w-44">
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); mediaInputRef.current?.click(); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-muted transition">
                <ImageIcon className="w-4 h-4 text-violet-500" /> Image / Video
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); fileInputRef.current?.click(); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-muted transition">
                <FileText className="w-4 h-4 text-blue-500" /> Document
              </button>
            </div>
          )}
        </div>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={isListening ? "Listening... 🎤" : selectedFile ? "Ask something about this file..." : "Ask NovaChat AI anything..."}
          disabled={loading}
          className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 transition"
        />

        {/* Mic */}
        {voiceSupported && (
          <button
            onClick={toggleVoice}
            title={isListening ? "Click to stop" : "Click to speak"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition shrink-0
              ${isListening ? "bg-blue-500 hover:bg-blue-600" : "bg-muted hover:bg-muted/80"}`}
          >
            {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-muted-foreground" />}
          </button>
        )}

        {/* Send */}
        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && !selectedFile)}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition shrink-0"
        >
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export default AiChatWindow;
