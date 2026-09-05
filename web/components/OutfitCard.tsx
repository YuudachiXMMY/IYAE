"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { api, ApiError, type OutfitResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// AvatarViewer is a heavy client-only 3D component — dynamic import with ssr:false,
// mounted only when the user expands "Try on my avatar", to keep chat TTI low.
const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  ),
});

interface OutfitCardProps {
  outfit: OutfitResponse;
  /** Override the outfit ID used for navigation links (e.g. outfitRecommendationId from chat) */
  outfitId?: number | null;
  /** The user's avatar GLB URL, if any — enables the inline "Try on my avatar" preview */
  avatarUrl?: string | null;
}

const SLOT_LABELS: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

const SLOT_ORDER: string[] = ["top", "bottom", "shoes", "accessory"];

export function OutfitCard({ outfit, outfitId, avatarUrl }: OutfitCardProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const linkId = outfitId ?? outfit.id;
  const itemsBySlot = new Map(outfit.items.map((item) => [item.slot, item]));

  // Derive garment GLB URLs for the inline avatar preview (mirrors the outfit 3D view page).
  const staticGlbUrls = outfit.items
    .filter((item) => !item.riggedGlbUrl)
    .map((item) => item.glbAssetUrl ?? item.glbUrl)
    .filter((url): url is string => Boolean(url));
  const riggedGlbUrls = outfit.items
    .filter((item) => Boolean(item.riggedGlbUrl))
    .map((item) => item.riggedGlbUrl as string);
  const riggedGlbSlots = outfit.items
    .filter((item) => Boolean(item.riggedGlbUrl))
    .map((item) => item.slot);
  const allGlbUrls = outfit.items
    .map((item) => item.glbAssetUrl ?? item.glbUrl)
    .filter((url): url is string => Boolean(url));

  // "Try on my avatar" needs both an avatar and at least one garment GLB; otherwise
  // fall back to the "View in 3D" link (today's behavior).
  const canTryOn = Boolean(avatarUrl) && (allGlbUrls.length > 0 || riggedGlbUrls.length > 0);

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
                {SLOT_LABELS[slot] ?? slot}
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

      {/* Inline "Try on my avatar" — expands the AvatarViewer with the user's body */}
      {canTryOn && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            className="w-full rounded-full text-xs border-border"
            aria-expanded={showAvatar}
            onClick={() => setShowAvatar((v) => !v)}
          >
            {showAvatar ? "Hide avatar preview" : "Try on my avatar"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`ml-1 transition-transform ${showAvatar ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Button>
          {showAvatar && (
            <div className="mt-2 h-72 w-full overflow-hidden rounded-xl bg-muted">
              <AvatarViewer
                avatarUrl={avatarUrl ?? undefined}
                garmentUrls={staticGlbUrls}
                glbUrls={allGlbUrls}
                riggedGarmentUrls={riggedGlbUrls.length > 0 ? riggedGlbUrls : undefined}
                riggedGarmentSlots={riggedGlbSlots.length > 0 ? riggedGlbSlots : undefined}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          asChild
          size="sm"
          className="flex-1 rounded-full bg-brand hover:bg-brand-hover text-primary-foreground text-xs"
        >
          <Link href={linkId != null ? `/outfits/${linkId}/view` : "/outfits"}>View in 3D</Link>
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
