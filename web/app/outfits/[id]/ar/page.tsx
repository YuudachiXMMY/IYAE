"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api, ApiError, type OutfitDetail } from "@/lib/api";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewerErrorBoundary } from "@/components/ViewerErrorBoundary";

// SmartARViewer must be dynamically imported — it transitively renders
// WebGL canvases and web components that cannot run on the server.
const SmartARViewer = dynamic(
  () => import("@/components/SmartARViewer").then((m) => m.SmartARViewer),
  { ssr: false }
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OutfitARPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const params = useParams();
  const outfitId = params.id as string;

  // One settled fetch per (viewer, outfit). "Loading" is the absence of a result
  // for the current pair, so the effect never has to reset state synchronously.
  const [loaded, setLoaded] = useState<{
    viewer: typeof user;
    outfitId: string;
    outfit: OutfitDetail | null;
    error: string | null;
  } | null>(null);

  const settled =
    loaded?.viewer === user && loaded?.outfitId === outfitId ? loaded : null;
  const outfit = settled?.outfit ?? null;
  const error = settled?.error ?? null;
  const loading = settled === null;

  useEffect(() => {
    if (authLoading || !user || !outfitId) return;

    api
      .get<OutfitDetail>(`/api/outfits/${outfitId}`)
      .then((data) =>
        setLoaded({ viewer: user, outfitId, outfit: data, error: null })
      )
      .catch((err: unknown) =>
        setLoaded((prev) => ({
          viewer: user,
          outfitId,
          outfit: prev?.outfit ?? null,
          error:
            err instanceof ApiError ? err.message : "Failed to load outfit",
        }))
      );
  }, [authLoading, user, outfitId]);

  // Collect all GLB URLs from outfit items
  const glbUrls = outfit
    ? outfit.items
        .map((item) => item.glbAssetUrl ?? item.glbUrl)
        .filter((url): url is string => Boolean(url))
    : [];

  // Use the first available USDZ URL for iOS AR Quick Look
  const usdzUrl = outfit
    ? outfit.items
        .map((item) => item.usdzUrl)
        .find((url): url is string => Boolean(url))
    : undefined;

  // Use the first available rigged GLB URL (takes priority in SmartARViewer)
  const riggedGlbUrl = outfit
    ? outfit.items
        .map((item) => item.riggedGlbUrl)
        .find((url): url is string => Boolean(url))
    : undefined;

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back navigation */}
        <Link
          href={`/outfits/${outfitId}/view`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
          Back to outfit
        </Link>

        <h1 className="font-display mb-6 text-2xl font-semibold text-foreground">
          Try On in AR
        </h1>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <Skeleton className="h-[500px] w-full rounded-card" />}

        {/* AR viewer — shown once outfit data is ready */}
        {!loading && !error && (
          <>
            {glbUrls.length === 0 ? (
              <div className="flex h-[500px] w-full flex-col items-center justify-center gap-3 rounded-card bg-muted text-muted-foreground">
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
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <p className="text-sm">
                  No 3D models available for this outfit
                </p>
                <Link
                  href={`/outfits/${outfitId}/view`}
                  className="mt-2 text-sm font-medium text-brand hover:underline"
                >
                  View outfit details
                </Link>
              </div>
            ) : (
              <div className="overflow-hidden rounded-card shadow-soft">
                <ViewerErrorBoundary
                  fallback={
                    <div className="flex h-[500px] w-full flex-col items-center justify-center gap-3 rounded-card bg-muted text-muted-foreground">
                      <p className="text-sm">3D models could not be loaded</p>
                      <Link
                        href={`/outfits/${outfitId}/view`}
                        className="mt-2 text-sm font-medium text-brand hover:underline"
                      >
                        View outfit details
                      </Link>
                    </div>
                  }
                >
                  <SmartARViewer
                    glbUrls={glbUrls}
                    usdzUrl={usdzUrl}
                    riggedGlbUrl={riggedGlbUrl}
                  />
                </ViewerErrorBoundary>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
