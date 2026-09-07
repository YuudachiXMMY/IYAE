"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { ViewerErrorBoundary } from "@/components/ViewerErrorBoundary";
import { SLOTS, type SlotMap } from "@/lib/outfit-slots";

// ── Dynamic imports (no SSR) ──────────────────────────────────────────────────

const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-busy="true"
      className="flex h-full items-center justify-center bg-muted"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading 3D model…</p>
      </div>
    </div>
  ),
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface OutfitBuilderPreviewProps {
  slots: SlotMap;
  avatarUrl?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OutfitBuilderPreview({ slots, avatarUrl }: OutfitBuilderPreviewProps) {
  const garmentUrls = useMemo(() => {
    return SLOTS.flatMap((slot) => {
      const product = slots[slot];
      return product?.glbUrl ? [product.glbUrl] : [];
    });
  }, [slots]);

  const isEmpty = garmentUrls.length === 0 && !avatarUrl;

  if (isEmpty) {
    return (
      <div className="h-[500px] rounded-card bg-card shadow-soft flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" />
          </svg>
          <p className="text-sm">Select items to preview your look in 3D</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-[500px] w-full rounded-card bg-card shadow-soft overflow-hidden">
        <ViewerErrorBoundary
          fallback={
            <div
              role="status"
              className="flex h-full items-center justify-center bg-muted"
            >
              <p className="text-sm text-muted-foreground">3D preview unavailable</p>
            </div>
          }
        >
          <AvatarViewer
            avatarUrl={avatarUrl}
            garmentUrls={garmentUrls}
            glbUrls={garmentUrls}
          />
        </ViewerErrorBoundary>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Drag to rotate · Scroll to zoom · Right-click to pan
      </p>
    </>
  );
}
