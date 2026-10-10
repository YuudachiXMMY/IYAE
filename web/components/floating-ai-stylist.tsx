"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { SuggestionChips } from "@/components/SuggestionChips";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const HIDDEN_PATHS = ["/login", "/register", "/chat"];

const STYLIST_SUGGESTION_POOL = [
  "Date night",
  "Casual weekend",
  "Work event",
  "Beach vacation",
  "Job interview",
  "Wedding guest",
  "Festival outfit",
  "Cozy stay-in",
  "Brunch with friends",
  "First date",
  "Concert look",
  "Graduation ceremony",
];

function pickRandomSuggestions(count = 3): string[] {
  const pool = [...STYLIST_SUGGESTION_POOL];
  const picks: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picks;
}

export function FloatingAIStylist() {
  const pathname = usePathname();
  const { user } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // The opening chips are a one-off pick, so they come from a lazy initialiser
  // rather than an effect; `serverSuggestions` takes over once the conversation
  // starts (null means "nothing from the server yet").
  const [openingSuggestions] = useState(pickRandomSuggestions);
  const [serverSuggestions, setServerSuggestions] = useState<string[] | null>(null);
  const currentSuggestions =
    serverSuggestions ?? (user && messages.length === 0 ? openingSuggestions : []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded && inputRef.current && user) {
      inputRef.current.focus();
    }
  }, [expanded, user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const isHidden =
    pathname === "/" || HIDDEN_PATHS.some((p) => pathname.startsWith(p));

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg = text.trim();
    setInput("");
    setServerSuggestions([]);
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const session = await api.post<{ id: string }>("/api/chat/sessions", {});
        sid = String(session.id);
        setSessionId(sid);
      }
      const response = await api.post<{ reply?: string; message?: string; content?: string; suggestions?: string[] }>(
        `/api/chat/sessions/${sid}/messages`,
        { content: userMsg }
      );
      const rawContent = response.reply || response.message || response.content || "";
      const cleanContent = rawContent
        .replace(/\[GENERATE_OUTFIT\][\s\S]*?\[\/GENERATE_OUTFIT\]/g, "")
        .replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/g, "")
        .trim();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanContent },
      ]);
      setServerSuggestions(response.suggestions ?? []);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }, [sending, sessionId]);

  async function handleSend() {
    await sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isHidden) return null;

  if (!expanded) {
    return (
      <>
        <style>{`
          @keyframes breathe {
            0%, 100% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.4); }
            50% { box-shadow: 0 0 0 8px rgba(147, 51, 234, 0); }
          }
          .animate-breathe {
            animation: breathe 3s ease-in-out infinite;
          }
        `}</style>
        <button
          aria-label="Open AI Style Assistant"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          className="animate-breathe fixed bottom-6 right-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
        >
          <Sparkles size={22} />
        </button>
      </>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="AI Style Assistant"
      className="fixed bottom-6 right-6 z-50 flex w-[430px] max-h-[74vh] flex-col rounded-[2rem] border border-border bg-card shadow-2xl transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-foreground" />
          <span
            className="font-semibold text-foreground"
            style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "1.1rem" }}
          >
            AI Stylist
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open full chat &rarr;
          </Link>
          <button
            aria-label="Close AI Stylist"
            onClick={() => setExpanded(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!user ? (
        /* Auth gate */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <Sparkles size={32} className="text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Sign in to start chatting with your AI stylist.</p>
          <Link
            href="/login"
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-foreground/80 transition-colors"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm pt-4">
                Ask me anything about style&hellip;
              </p>
            )}
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-foreground">
                    {msg.content}
                  </div>
                </div>
              )
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-muted-foreground italic">
                  Thinking&hellip;
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions + Input */}
          <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3">
            {currentSuggestions.length > 0 && (
              <SuggestionChips
                suggestions={currentSuggestions}
                onSelect={(text) => sendMessage(text)}
                disabled={sending}
              />
            )}
            <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about outfits, styles..."
              disabled={sending}
              className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/80 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
