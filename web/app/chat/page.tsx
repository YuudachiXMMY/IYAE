"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ApiError, chat, type ChatMessage, type ChatSession } from "@/lib/api";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAvatar } from "@/lib/hooks/useAvatar";
import { useWeather } from "@/lib/hooks/useWeather";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { ChatWeatherChip } from "@/components/ChatWeatherChip";
import { SuggestionChips } from "@/components/SuggestionChips";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Types (ChatSession, ChatMessage) are imported from "@/lib/api".

// ── Occasion & mood quick-picks (welcome state) ────────────────────────────

const OCCASION_CHIPS = ["Brunch", "Date night", "Work", "Party"];
const MOOD_CHIPS = ["Cozy", "Bold", "Minimal", "Romantic"];

// ── Initial suggestions for new conversations ──────────────────────────────

const SUGGESTION_POOL = [
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
  const pool = [...SUGGESTION_POOL];
  const picks: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picks;
}

// ── Quick-start prompts ─────────────────────────────────────────────────────

const PROMPT_STARTERS = [
  {
    label: "Date night",
    prompt:
      "I'm going on a dinner date this Friday — suggest something elegant but not overdressed.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    label: "Office to drinks",
    prompt:
      "I need an outfit that works for the office but transitions to after-work drinks.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      </svg>
    ),
  },
  {
    label: "Weekend brunch",
    prompt:
      "Style me something laid-back for a weekend brunch — cozy but put-together.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" /><path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" /><path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
      </svg>
    ),
  },
  {
    label: "Capsule wardrobe",
    prompt:
      "Help me build a versatile capsule wardrobe with 10 essential pieces.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
];

// ── Sparkle icon (reused across page) ───────────────────────────────────────

function SparkleIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { avatarUrl } = useAvatar();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetched once here and shared by both header chips (mobile + desktop) so the
  // page issues a single /api/chat/weather request regardless of how many chips mount.
  const weather = useWeather();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // ── Load sessions ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user) return;

    chat
      .listSessions()
      .then((data) => {
        setSessions(data);
        if (data.length > 0) {
          setActiveSessionId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load sessions");
      })
      .finally(() => setIsLoadingSessions(false));
  }, [authLoading, user]);

  // ── Load messages when session changes ───────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;

    setIsLoadingMessages(true);
    setMessages([]);
    setCurrentSuggestions([]);
    setError(null);

    chat
      .getMessages(activeSessionId)
      .then((msgs) => {
        setMessages(msgs);
        if (msgs.length === 0) {
          setCurrentSuggestions(pickRandomSuggestions());
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load messages");
      })
      .finally(() => setIsLoadingMessages(false));
  }, [activeSessionId]);

  // ── Create new session ───────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    setError(null);

    try {
      const session = await chat.createSession();
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
      setCurrentSuggestions(pickRandomSuggestions());
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to create session");
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession]);

  // ── Select session ────────────────────────────────────────────────────────
  const handleSelectSession = useCallback((id: number) => {
    setActiveSessionId(id);
    setMobileOpen(false);
  }, []);

  // ── Core send logic (accepts explicit session ID for quick-start) ─────────
  const sendMessageToSession = useCallback(
    async (text: string, targetSessionId?: number) => {
      const sessionId = targetSessionId ?? activeSessionId;
      if (!sessionId) return;

      setIsSending(true);
      setIsTyping(true);
      setError(null);

      const optimisticId = Date.now();
      const optimisticUserMsg: ChatMessage = {
        id: optimisticId,
        role: "USER",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        const response = await chat.sendMessage(sessionId, text);
        setMessages((prev) => [...prev, response]);
        setCurrentSuggestions(response.suggestions ?? []);
      } catch (err: unknown) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setError(err instanceof ApiError ? err.message : "Failed to send message");
      } finally {
        setIsSending(false);
        setIsTyping(false);
        textareaRef.current?.focus();
      }
    },
    [activeSessionId]
  );

  // ── Quick-start: create session + send prompt ─────────────────────────────
  const handleQuickStart = useCallback(
    async (prompt: string) => {
      if (isCreatingSession || isSending) return;
      setIsCreatingSession(true);
      setError(null);

      try {
        const session = await chat.createSession();
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        setMessages([]);
        setCurrentSuggestions([]);
        setIsCreatingSession(false);
        await sendMessageToSession(prompt, session.id);
      } catch (err: unknown) {
        setError(err instanceof ApiError ? err.message : "Failed to start conversation");
        setIsCreatingSession(false);
      }
    },
    [isCreatingSession, isSending, sendMessageToSession]
  );

  // ── Send message (handles both active-session and no-session cases) ──────
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isSending || isCreatingSession) return;
    setInput("");

    if (activeSessionId) {
      await sendMessageToSession(content);
    } else {
      await handleQuickStart(content);
    }
  }, [input, activeSessionId, isSending, isCreatingSession, sendMessageToSession, handleQuickStart]);

  // ── Enter to send (Shift+Enter = newline) ─────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── Suggestion chip select ────────────────────────────────────────────────
  const handleSuggestionSelect = useCallback(
    async (text: string) => {
      if (!activeSessionId || isSending) return;
      await sendMessageToSession(text);
    },
    [activeSessionId, isSending, sendMessageToSession]
  );

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const isCompleted = activeSession?.status === "COMPLETED";

  // ── Auth loading guard ────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── Sidebar (shared between desktop + mobile Sheet) ───────────────────────
  const sidebarContent = (
    <ChatSidebar
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={handleSelectSession}
      onNewChat={handleNewChat}
      isCreating={isCreatingSession}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        {isLoadingSessions ? (
          <aside className="flex h-full w-72 flex-col border-r border-border/60 bg-card/40 p-4 gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </aside>
        ) : (
          sidebarContent
        )}
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Open sidebar">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Chat sessions</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <SparkleIcon size={16} className="text-brand" />
            <span className="font-display text-lg font-semibold text-foreground">
              AI Stylist
            </span>
          </div>
          <div className="ml-auto">
            <ChatWeatherChip weather={weather} />
          </div>
        </div>

        {/* Desktop header — weather chip */}
        <div className="hidden md:flex items-center justify-end border-b border-border/60 bg-card/40 px-4 py-2">
          <ChatWeatherChip weather={weather} />
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {/* Welcome state — no session selected */}
          {!activeSessionId && !isLoadingSessions && (
            <div className="flex h-full flex-col items-center justify-center px-6">
              <div className="max-w-lg w-full text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
                  <SparkleIcon size={24} className="text-brand" />
                </div>

                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Your AI stylist
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-sm mx-auto">
                  Tell me what you&apos;re dressing for, your mood, or a vibe
                  you&apos;re going for — I&apos;ll pull together the perfect look.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROMPT_STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      onClick={() => handleQuickStart(starter.prompt)}
                      disabled={isCreatingSession || isSending}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all duration-200 hover:border-brand/30 hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                        {starter.icon}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {starter.label}
                        </span>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {starter.prompt}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-4 text-left">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                      Occasion
                    </span>
                    <SuggestionChips
                      suggestions={OCCASION_CHIPS}
                      onSelect={(o) => handleQuickStart(`Occasion: ${o}.`)}
                      disabled={isCreatingSession || isSending}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                      Mood
                    </span>
                    <SuggestionChips
                      suggestions={MOOD_CHIPS}
                      onSelect={(m) => handleQuickStart(`Mood: ${m}.`)}
                      disabled={isCreatingSession || isSending}
                    />
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground/60">
                  <div className="h-px flex-1 bg-border" />
                  <span>or type your own question below</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>
            </div>
          )}

          {/* Messages loading skeleton */}
          {isLoadingMessages && (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto px-4 py-8">
              <div className="flex items-start gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                <Skeleton className="h-14 w-56 rounded-2xl rounded-tl-md" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-44 rounded-2xl rounded-tr-md" />
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                <Skeleton className="h-20 w-64 rounded-2xl rounded-tl-md" />
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {!isLoadingMessages && activeSessionId && (
            <div role="log" aria-live="polite" aria-label="Chat messages" className="flex flex-col gap-4 max-w-2xl mx-auto px-4 py-8">
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    Send a message to start the conversation.
                  </p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className="animate-stagger-in"
                  style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                >
                  <ChatMessageBubble message={message} avatarUrl={avatarUrl} />
                </div>
              ))}
              {isTyping && (
                <div className="flex items-start gap-3 animate-stagger-in">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                    <SparkleIcon size={14} className="text-brand" />
                  </div>
                  <div className="rounded-2xl rounded-tl-md bg-card border border-border/60 shadow-soft">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Input area — visible on welcome screen and active sessions */}
        {!isLoadingSessions && (
          <div className="border-t border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3">
            <div className="mx-auto max-w-2xl">
              {isCompleted ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    This conversation has ended.
                  </p>
                  <Button
                    onClick={handleNewChat}
                    disabled={isCreatingSession}
                    className="rounded-full bg-brand hover:bg-brand-hover text-primary-foreground"
                  >
                    {isCreatingSession ? "Creating..." : "Start new chat"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {currentSuggestions.length > 0 && (
                    <SuggestionChips
                      suggestions={currentSuggestions}
                      onSelect={handleSuggestionSelect}
                      disabled={isSending || isTyping}
                    />
                  )}
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe what you're dressing for..."
                      className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border-border/60 bg-background text-sm focus-visible:ring-brand/30"
                      rows={1}
                      disabled={isSending}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isSending || isCreatingSession}
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-xl bg-brand hover:bg-brand-hover text-primary-foreground transition-all duration-200 hover:scale-105 active:scale-95"
                      aria-label="Send message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
