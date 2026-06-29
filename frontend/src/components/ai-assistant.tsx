import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Bot, Sparkles, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

const AI_URL = import.meta.env.VITE_AI_ASSISTANT_URL || "http://localhost:8000";

const SUGGESTIONS = [
  { text: "How to extract PDF to Excel?", icon: "📄" },
  { text: "Is the PDF extractor free?", icon: "🆓" },
  { text: "How to import Tally XML?", icon: "⚙️" },
  { text: "Where can I find Tally TDLs?", icon: "🧩" },
];

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hello! I am your ZaiZ AI Assistant. How can I help you with your accounting and Tally tasks today?",
      sender: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const dismissTooltip = () => {
    setShowTooltip(false);
    try { localStorage.setItem('zaiz_ai_tooltip_shown', '1'); } catch {}
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialise position to bottom-right corner on first render
  useEffect(() => {
    const margin = 24;
    setPos({
      x: window.innerWidth - 56 - margin,
      y: window.innerHeight - 56 - margin,
    });
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const W = containerRef.current?.offsetWidth ?? 56;
    const H = containerRef.current?.offsetHeight ?? 56;
    return {
      x: Math.max(0, Math.min(window.innerWidth - W, x)),
      y: Math.max(0, Math.min(window.innerHeight - H, y)),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only drag on the FAB itself (not chat window)
    if (isOpen) return;
    dragging.current = true;
    const rect = containerRef.current!.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const newPos = clamp(
      e.clientX - dragOffset.current.x,
      e.clientY - dragOffset.current.y,
    );
    setPos(newPos);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Show floating tooltip only the first time
  useEffect(() => {
    try {
      if (localStorage.getItem('zaiz_ai_tooltip_shown')) return;
    } catch {}
    const timer = setTimeout(() => {
      if (!isOpen) setShowTooltip(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const sendQuery = async (queryText: string) => {
    if (isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: queryText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Build chat history in API format
      const chatHistory = messages
        .map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        }))
        .concat({ role: "user", content: queryText });

      const response = await fetch(`${AI_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: chatHistory,
          model: "llama-3.2-3b-local",
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with ZaiZ support agent.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader stream available on response.");
      }

      const decoder = new TextDecoder();
      let done = false;
      let assistantText = "";

      const assistantMsgId = (Date.now() + 1).toString();

      // Append an empty assistant message which we'll update incrementally
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          text: "",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);

      setIsTyping(false);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const cleaned = line.trim();
            if (cleaned.startsWith("data: ")) {
              const dataStr = cleaned.slice(6);
              if (dataStr === "[DONE]") break;

              try {
                const data = JSON.parse(dataStr);
                if (data.type === "content") {
                  assistantText += data.delta;
                  // Update the placeholder message with accumulated content
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId ? { ...msg, text: assistantText } : msg
                    )
                  );
                }
              } catch (e) {
                // Ignore JSON errors in streaming metadata
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("AI assistant support connection failed:", err);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "I'm having trouble connecting to ZaiZ Support servers right now. Please try again in a few moments.",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const query = input;
    setInput("");
    sendQuery(query);
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 font-sans flex flex-col items-end select-none"
      style={
        pos
          ? { left: pos.x, top: pos.y, bottom: "auto", right: "auto" }
          : { bottom: 24, right: 24 }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <AnimatePresence>
        {/* Floating Tooltip Helper */}
        {showTooltip && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            className="mb-3 mr-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700/50 backdrop-blur-md relative"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Need help? Chat with ZaiZ AI</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissTooltip();
              }}
              className="text-slate-400 hover:text-white ml-1 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            {/* Tooltip arrow */}
            <div className="absolute right-6 -bottom-1.5 w-3 h-3 bg-slate-800 rotate-45 border-r border-b border-slate-700/50" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="fab"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 45 }}
            onClick={() => {
              if (dragging.current) return;
              setIsOpen(true);
              dismissTooltip();
            }}
            style={{ touchAction: "none", cursor: dragging.current ? "grabbing" : "grab" }}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/35 hover:scale-105 active:scale-95 transition-all duration-300 group relative border border-white/10"
          >
            {/* Pulse Glow Effect */}
            <span className="absolute -inset-1.5 rounded-full bg-indigo-500/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <MessageSquare className="w-6 h-6 relative z-10 transition-transform duration-300 group-hover:rotate-12" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500 border border-white dark:border-slate-900"></span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, scale: 0.85, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 60 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="w-[380px] max-w-[calc(100vw-1rem)] h-[520px] max-h-[calc(100vh-5rem)] rounded-2xl shadow-2xl flex flex-col overflow-hidden border
              bg-white/95 dark:bg-[#080d1e]/95
              border-slate-200/80 dark:border-white/10"
            style={{ backdropFilter: "blur(24px) saturate(160%)", touchAction: "none" }}
          >
            {/* Premium Header */}
            <div className="px-4 py-3.5 flex items-center justify-between border-b bg-slate-50/98 dark:bg-[#090f23]/98 border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 p-2 flex items-center justify-center shadow-md shadow-indigo-500/10 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <path
                      d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z"
                      fill="white"
                    />
                    <path
                      d="M19 4C19 6.2 20.8 8 23 8C20.8 8 19 9.8 19 12C19 9.8 17.2 8 15 8C17.2 8 19 6.2 19 4Z"
                      fill="white"
                      opacity="0.75"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                      ZaiZ AI
                    </span>
                    <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-1.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                        Online
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                    Smart Accounting Helper
                  </p>
                </div>
              </div>

              {/* Close controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-indigo-200/20 scrollbar-track-transparent bg-slate-50/20 dark:bg-[#070b1a]/40">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    {msg.sender === "assistant" && (
                      <div className="w-6.5 h-6.5 rounded-full bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-1.5 flex items-center justify-center shrink-0 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-emerald-500 dark:text-emerald-400">
                          <path
                            d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z"
                            fill="currentColor"
                          />
                          <path
                            d="M19 4C19 6.2 20.8 8 23 8C20.8 8 19 9.8 19 12C19 9.8 17.2 8 15 8C17.2 8 19 6.2 19 4Z"
                            fill="currentColor"
                            opacity="0.75"
                          />
                        </svg>
                      </div>
                    )}

                    <div className="flex flex-col">
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                          msg.sender === "user"
                            ? "rounded-tr-none text-white font-medium bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 border border-indigo-500/10"
                            : "rounded-tl-none text-slate-800 dark:text-blue-50/90 border bg-white/90 dark:bg-white/[0.04] border-slate-150 dark:border-white/[0.06]"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span
                        className={`text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-1 ${
                          msg.sender === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </motion.div>
                ))}

                {/* AI Typing Loader */}
                {isTyping && (
                  <div className="flex gap-3 max-w-[85%] mr-auto">
                    <div className="w-6.5 h-6.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 p-1.5 flex items-center justify-center shrink-0 mt-0.5">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-emerald-500 dark:text-emerald-400 animate-spin">
                        <path
                          d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z"
                          fill="currentColor"
                        />
                        <path
                          d="M19 4C19 6.2 20.8 8 23 8C20.8 8 19 9.8 19 12C19 9.8 17.2 8 15 8C17.2 8 19 6.2 19 4Z"
                          fill="currentColor"
                          opacity="0.75"
                        />
                      </svg>
                    </div>
                    <div className="rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-500 dark:text-blue-200/60 flex items-center gap-1.5 border bg-white/90 dark:bg-white/[0.04] border-slate-150 dark:border-white/[0.06]">
                      <span
                        className="w-1.5 h-1.5 bg-indigo-500/60 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></span>
                      <span
                        className="w-1.5 h-1.5 bg-indigo-500/60 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></span>
                      <span
                        className="w-1.5 h-1.5 bg-indigo-500/60 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions Panel (only shown when no user messages are sent yet) */}
              {messages.length === 1 && !isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 pt-2 border-t border-dashed border-slate-200/60 dark:border-white/[0.05] space-y-2.5"
                >
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Suggestion Queries:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUGGESTIONS.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendQuery(sug.text)}
                        className="text-left p-2.5 rounded-xl border bg-white hover:bg-slate-50 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] border-slate-150 dark:border-white/[0.06] text-[10.5px] text-slate-700 dark:text-slate-300 font-medium transition-all hover:scale-[1.02] hover:border-indigo-400/40 active:scale-[0.98] shadow-sm flex items-start gap-2 cursor-pointer"
                      >
                        <span className="shrink-0">{sug.icon}</span>
                        <span className="leading-tight">{sug.text}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form Footer */}
            <form
              onSubmit={handleSend}
              className="p-3.5 flex gap-2 border-t bg-slate-50/98 dark:bg-[#090f23]/98 border-slate-100 dark:border-white/[0.08]"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask ZaiZ AI anything..."
                className="flex-1 px-3.5 py-2.5 rounded-xl text-xs transition-all border outline-none bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="p-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/10 shrink-0 flex items-center justify-center bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white hover:opacity-95 active:scale-95 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
