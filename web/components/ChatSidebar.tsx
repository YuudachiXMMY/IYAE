"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatSession {
  id: number;
  status: "ACTIVE" | "COMPLETED";
  createdAt: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelectSession: (id: number) => void;
  onNewChat: () => void;
  isCreating?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDateGroup(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0 && date.toDateString() === now.toDateString()) return "Today";
  if (diffDays <= 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
}

function groupSessions(sessions: ChatSession[]): [string, ChatSession[]][] {
  const groups = new Map<string, ChatSession[]>();
  for (const session of sessions) {
    const group = getDateGroup(session.createdAt);
    const existing = groups.get(group) ?? [];
    groups.set(group, [...existing, session]);
  }
  return Array.from(groups.entries());
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  isCreating = false,
}: ChatSidebarProps) {
  const grouped = groupSessions(sessions);

  return (
    <aside aria-label="Chat history" className="flex h-full w-72 flex-col border-r border-border/60 bg-card/40">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand" aria-hidden="true">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
          <span className="font-display text-lg font-semibold text-foreground">
            Stylist
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onNewChat}
          disabled={isCreating}
          className="h-8 w-8 p-0 rounded-lg hover:bg-brand/10 hover:text-brand"
          aria-label="New chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col px-3 pb-3">
          {sessions.length === 0 && (
            <div className="px-2 py-8 text-center">
              <p className="text-xs text-muted-foreground">No conversations yet.</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                Start one to get styled.
              </p>
            </div>
          )}

          {grouped.map(([group, groupSessions]) => (
            <div key={group} className="mb-1" role="list" aria-label={group}>
              <p className="px-2 pt-3 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60" aria-hidden="true">
                {group}
              </p>
              {groupSessions.map((session) => {
                const isActive = activeSessionId === session.id;
                return (
                  <button
                    key={session.id}
                    role="listitem"
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`Conversation from ${formatSessionLabel(session.createdAt)}${session.status === "COMPLETED" ? ", ended" : ""}`}
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                      isActive
                        ? "bg-brand/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                        session.status === "ACTIVE"
                          ? isActive
                            ? "bg-brand"
                            : "bg-success"
                          : "bg-muted-foreground/30"
                      )}
                    />
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium truncate">Conversation</span>
                      <span className="text-[11px] text-muted-foreground/60">
                        {formatSessionLabel(session.createdAt)}
                        {session.status === "COMPLETED" && (
                          <span className="ml-1.5 text-muted-foreground/40">
                            &middot; ended
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
