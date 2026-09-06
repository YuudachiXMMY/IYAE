"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { api, ApiError, avatar } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ViewerErrorBoundary } from "@/components/ViewerErrorBoundary";

// R3F must be dynamically imported with ssr:false. Lazy-mounted only when the
// user taps "Try on" so a chat stream never mounts a viewer per message.
const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

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

interface OutfitCardProps {
  outfit: OutfitResponse;
  /** Override the outfit ID used for navigation links (e.g. outfitRecommendationId from chat) */
  outfitId?: number | null;
}

const SLOT_LABELS: Record<OutfitItem["slot"], string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

const SLOT_ORDER: OutfitItem["slot"][] = ["top", "bottom", "shoes", "accessory"];

export function OutfitCard({ outfit, outfitId }: OutfitCardProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tryOn, setTryOn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const linkId = outfitId ?? outfit.id;
  const itemsBySlot = new Map(outfit.items.map((item) => [item.slot, item]));

  // Assemble garment GLBs the same way outfits/[id]/view does (chat outfits only
  // carry static glbUrl per item — no rigged variants).
  const glbUrls = useMemo(
    () =>
      outfit.items
        .map((item) => item.glbUrl)
        .filter((url): url is string => Boolean(url)),
    [outfit.items]
  );

  const previewImageUrl = outfit.items[0]?.media?.[0];

  // Abort the in-flight avatar fetch on unmount so we never setState afterwards.
  const avatarFetchRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => avatarFetchRef.current?.abort();
  }, []);

  const handleTryOn = useCallback(async () => {
    setTryOn(true);
    if (avatarLoaded) return;
    setAvatarLoaded(true);
    const controller = new AbortController();
    avatarFetchRef.current = controller;
    try {
      const res = await avatar.getAvatar(controller.signal);
      if (!controller.signal.aborted) setAvatarUrl(res.avatarUrl);
    } catch {
      // No avatar yet / unauthenticated / aborted — viewer falls back to garments-only.
      if (!controller.signal.aborted) setAvatarUrl(null);
    }
  }, [avatarLoaded]);

  return (
    <div className="bg-card rounded-card shadow-soft p-4 mt-2 max-w-sm" aria-label={`Outfit suggestion with ${outfit.items.length} item${outfit.items.length !== 1 ? "s" : ""}`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Outfit Suggestion
      </p>

      <div className="grid grid-cols-2 gap-2">
        {SLOT_ORDER.map((slot) => {
          const item = itemsBySlot.get(slot);
          if (!item) return null;

          const imageUrl = item.media?.[0] ?? null;

          return (
            <div key={slot} className="flex flex-col gap-1">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={item.productName}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 150px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/40">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9l4-4 4 4 4-4 4 4" />
                      <path d="M3 15l4 4 4-4 4 4 4-4" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                {SLOT_LABELS[slot]}
              </p>
              <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
                {item.productName}
              </p>
              <p className="text-xs text-muted-foreground">${item.productPrice}</p>
            </div>
          );
        })}
      </div>

      {outfit.explanation && (
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
          {outfit.explanation}
        </p>
      )}

      {/* Inline try-on — lazy-mounted only after the user taps "Try on" */}
      {tryOn && (
        <div className="mt-3 h-80 w-full overflow-hidden rounded-xl bg-muted">
          <ViewerErrorBoundary
            fallback={
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground italic">
                3D preview unavailable
              </div>
            }
          >
            <AvatarViewer
              avatarUrl={avatarUrl ?? undefined}
              glbUrls={glbUrls}
              previewImageUrl={previewImageUrl}
            />
          </ViewerErrorBoundary>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1 rounded-full bg-brand hover:bg-brand-hover text-primary-foreground text-xs"
          aria-pressed={tryOn}
          onClick={() => (tryOn ? setTryOn(false) : handleTryOn())}
        >
          {tryOn ? "Hide try-on" : "Try on"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={
            saved
              ? "flex-1 rounded-full text-xs border-brand text-brand"
              : "flex-1 rounded-full text-xs border-border"
          }
          disabled={saving || saved || linkId == null}
          onClick={async () => {
            if (linkId == null) return;
            setSaving(true);
            try {
              await api.post("/api/looks", { recommendationId: linkId, note: "" });
              setSaved(true);
              toast.success("Look saved!");
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Failed to save look");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Save Look"}
        </Button>
      </div>
    </div>
  );
}
