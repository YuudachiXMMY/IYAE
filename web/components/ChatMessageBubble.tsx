"use client";

import DOMPurify from "dompurify";
import { OutfitCard } from "@/components/OutfitCard";

interface OutfitItem {
  slot: "top" | "bottom" | "shoes" | "accessory";
  productId: number;
  productName: string;
  productPrice: number;
  category: string;
  media: string[];
  glbUrl?: string;
}

interface OutfitResponse {
  id: number | null;
  items: OutfitItem[];
  explanation: string;
}

interface ChatMessage {
  id: number;
  role: "USER" | "ASSISTANT";
  content: string;
  outfit?: OutfitResponse | null;
  outfitRecommendationId?: number | null;
  suggestions?: string[];
  createdAt: string;
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

/** Strip [GENERATE_OUTFIT]...[/GENERATE_OUTFIT] markers from AI responses */
function stripOutfitMarkers(text: string): string {
  return text.replace(/\[GENERATE_OUTFIT\][\s\S]*?\[\/GENERATE_OUTFIT\]/g, "").trim();
}

/** Strip [SUGGESTIONS]...[/SUGGESTIONS] markers from AI responses */
function stripSuggestionMarkers(text: string): string {
  return text.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/g, "").trim();
}

function applyBasicMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /`(.+?)`/g,
      '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>'
    );
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "USER";
  const cleanContent = isUser
    ? message.content
    : stripSuggestionMarkers(stripOutfitMarkers(message.content));
  const sanitizedContent = DOMPurify.sanitize(applyBasicMarkdown(cleanContent), {
    ALLOWED_TAGS: ["strong", "em", "code"],
    ALLOWED_ATTR: ["class"],
  });

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        {cleanContent && (
          <div
            className="max-w-[75%] rounded-2xl rounded-tr-md bg-brand/10 text-foreground px-4 py-3 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        )}
        <span className="text-[10px] text-muted-foreground/40 px-1">
          {formatTimestamp(message.createdAt)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {/* Assistant avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand" aria-hidden="true">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
      </div>

      <div className="flex flex-col gap-1 min-w-0 max-w-[75%]">
        {cleanContent && (
          <div
            className="rounded-2xl rounded-tl-md bg-card border border-border/60 shadow-soft text-foreground px-4 py-3 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        )}
        {!isUser && message.outfit && (
          <OutfitCard
            outfit={message.outfit}
            outfitId={message.outfitRecommendationId}
          />
        )}
        <span className="text-[10px] text-muted-foreground/40 px-1">
          {formatTimestamp(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
