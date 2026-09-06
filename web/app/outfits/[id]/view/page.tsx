"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { api, ApiError, type AvatarResponse, type OutfitDetail, type SlotName } from "@/lib/api";
import { toast } from "sonner";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useARSupport } from "@/lib/hooks/useARSupport";
import { useOutfitRiggingStatus } from "@/lib/hooks/useOutfitRiggingStatus";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewerErrorBoundary } from "@/components/ViewerErrorBoundary";

// ── Dynamic imports (no SSR) per HC-23 ───────────────────────────────────────

const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading 3D model…</p>
      </div>
    </div>
  ),
});

const DemoOutfitModel = dynamic(() => import("@/components/DemoOutfitModel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  ),
});

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<SlotName, string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

const SLOT_ORDER: SlotName[] = ["top", "bottom", "shoes", "accessory"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OutfitViewPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const arSupport = useARSupport();
  const params = useParams();
  const outfitId = params.id as string;

  const [outfit, setOutfit] = useState<OutfitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { items: liveItems, pendingCount } = useOutfitRiggingStatus(outfit?.items ?? []);

  useEffect(() => {
    if (authLoading || !user || !outfitId) return;

    setLoading(true);
    setError(null);

    api
      .get<OutfitDetail>(`/api/outfits/${outfitId}`)
      .then(setOutfit)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load outfit");
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, outfitId]);

  useEffect(() => {
    if (authLoading || !user) return;
    api
      .get<AvatarResponse>("/api/avatar")
      .then((res) => setAvatarUrl(res.avatarUrl))
      .catch(() => setAvatarUrl(null));
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  const displayItems = liveItems.length > 0 ? liveItems : (outfit?.items ?? []);

  // Non-rigged items only (exclude items that have a rigged GLB to avoid duplication)
  const staticGlbUrls = displayItems
    .filter((item) => !item.riggedGlbUrl)
    .map((item) => item.glbAssetUrl ?? item.glbUrl)
    .filter((url): url is string => Boolean(url));

  const riggedGlbUrls = displayItems
    .filter((item) => Boolean(item.riggedGlbUrl))
    .map((item) => item.riggedGlbUrl as string);

  const riggedGlbSlots = displayItems
    .filter((item) => Boolean(item.riggedGlbUrl))
    .map((item) => item.slot);

  // All items' GLBs (fallback if rigged loading fails)
  const allGlbUrls = displayItems
    .map((item) => item.glbAssetUrl ?? item.glbUrl)
    .filter((url): url is string => Boolean(url));

  const has3D = allGlbUrls.length > 0 || riggedGlbUrls.length > 0 || Boolean(avatarUrl);
  const itemsBySlot = new Map(displayItems.map((item) => [item.slot, item]));

  const showARButton =
    !arSupport.loading &&
    (arSupport.webxr || arSupport.arQuickLook || arSupport.sceneViewer);

  return (
    <>
      <NavBar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/outfits"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
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
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All Outfits
        </Link>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-8 lg:flex-row">
            <Skeleton className="h-[500px] w-full rounded-card lg:flex-1" />
            <div className="flex w-full flex-col gap-4 lg:w-80">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        )}

        {/* Main layout */}
        {!loading && outfit && (
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* 3D Viewer panel */}
            <div className="flex-1">
              <div className="relative h-[500px] w-full rounded-card bg-card shadow-soft overflow-hidden">
                {pendingCount > 0 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/90 px-3 py-1.5 rounded-full shadow-soft">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-xs text-muted-foreground">
                      Rigging {pendingCount} item{pendingCount > 1 ? "s" : ""}...
                    </span>
                  </div>
                )}
                <ViewerErrorBoundary fallback={<DemoOutfitModel />}>
                  {has3D ? (
                    <AvatarViewer
                      avatarUrl={avatarUrl ?? undefined}
                      garmentUrls={staticGlbUrls}
                      glbUrls={allGlbUrls}
                      riggedGarmentUrls={riggedGlbUrls.length > 0 ? riggedGlbUrls : undefined}
                      riggedGarmentSlots={riggedGlbSlots.length > 0 ? riggedGlbSlots : undefined}
                    />
                  ) : (
                    <DemoOutfitModel />
                  )}
                </ViewerErrorBoundary>
              </div>

              <p className="mt-2 text-center text-xs text-muted-foreground">
                Drag to rotate · Scroll to zoom · Right-click to pan
              </p>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                {showARButton && has3D && (
                  <Button
                    asChild
                    className="rounded-full bg-brand hover:bg-brand-hover text-primary-foreground"
                  >
                    <Link href={`/outfits/${outfitId}/ar`}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2"
                        aria-hidden="true"
                      >
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                      View in AR
                    </Link>
                  </Button>
                )}

                <Button
                  variant={saved ? "outline" : "default"}
                  className={
                    saved
                      ? "rounded-full border-brand text-brand"
                      : "rounded-full bg-brand hover:bg-brand-hover text-primary-foreground"
                  }
                  disabled={saving || saved}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await api.post("/api/looks", { recommendationId: Number(outfitId), note: "" });
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

            {/* Sidebar */}
            <aside className="w-full lg:w-80 flex flex-col gap-6">
              <div>
                <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
                  The Look
                </h2>

                <div className="flex flex-col gap-3">
                  {SLOT_ORDER.map((slot) => {
                    const item = itemsBySlot.get(slot);
                    if (!item) return null;
                    const imageUrl = item.media?.[0] ?? null;

                    return (
                      <div
                        key={slot}
                        className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={item.productName}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-muted-foreground"
                                aria-label={item.productName}
                              >
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9l4-4 4 4 4-4 4 4" />
                                <path d="M3 15l4 4 4-4 4 4 4-4" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                            {SLOT_LABELS[slot]}
                          </p>
                          <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                            {item.productName}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            ${item.productPrice}
                          </p>
                        </div>

                        {/* 3D badge */}
                        {item.glbUrl && (
                          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                            3D
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stylist explanation */}
              {outfit.explanation && (
                <div className="rounded-2xl bg-card p-4 shadow-soft">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Stylist Note
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {outfit.explanation}
                  </p>
                </div>
              )}

              {/* Total price */}
              <div className="rounded-2xl bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-display text-xl font-semibold text-foreground">
                    $
                    {outfit.items
                      .reduce((sum, item) => sum + item.productPrice, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
