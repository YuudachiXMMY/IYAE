"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutfitItem {
  slot: "top" | "bottom" | "shoes" | "accessory";
  productId: number;
  productName: string;
  productPrice: number;
  category: string;
  media: string[];
  glbUrl?: string;
}

interface OutfitRecommendation {
  id: number;
  items: OutfitItem[];
  explanation: string;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

const SLOT_ORDER: OutfitItem["slot"][] = ["top", "bottom", "shoes", "accessory"];
const SLOT_LABELS: Record<OutfitItem["slot"], string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

function OutfitGridCard({
  outfit,
  index,
}: {
  outfit: OutfitRecommendation;
  index: number;
}) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const itemsBySlot = new Map(outfit.items.map((item) => [item.slot, item]));
  const has3D = outfit.items.some((item) => item.glbUrl);
  const totalPrice = outfit.items.reduce((sum, item) => sum + item.productPrice, 0);

  return (
    <div
      className="group bg-card rounded-card shadow-soft p-5 flex flex-col gap-4
                 transition-all duration-300 ease-out
                 hover:-translate-y-1 hover:shadow-heavy
                 animate-stagger-in"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header: price + 3D badge */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-foreground tracking-tight">
          ${totalPrice.toFixed(0)}
          <span className="text-xs font-normal text-muted-foreground ml-1.5">
            total
          </span>
        </p>
        {has3D && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.27 6.96 12 12.01l8.73-5.05" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            3D
          </span>
        )}
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {SLOT_ORDER.map((slot) => {
          const item = itemsBySlot.get(slot);
          if (!item) return null;
          const imageUrl = item.media?.[0] ?? null;

          return (
            <div key={slot} className="flex flex-col gap-1.5">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={item.productName}
                    fill
                    className="object-cover transition-transform duration-500 ease-out
                               group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 40vw, 160px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
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
              <p className="text-[11px] font-medium text-muted-foreground">
                {SLOT_LABELS[slot]}
              </p>
              <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
                {item.productName}
              </p>
              <p className="text-xs text-muted-foreground">${item.productPrice}</p>
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      {outfit.explanation && (
        <p className="text-[13px] text-muted-foreground leading-relaxed border-t border-border pt-3 line-clamp-3">
          {outfit.explanation}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <Button
          asChild
          size="sm"
          className="flex-1 rounded-full bg-brand hover:bg-brand-hover text-primary-foreground text-xs
                     active:scale-[0.97] transition-transform"
        >
          <Link href={`/outfits/${outfit.id}/view`}>
            {has3D ? "View in 3D" : "View look"}
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`flex-1 rounded-full text-xs transition-all active:scale-[0.97]
            ${
              saved
                ? "border-brand text-brand bg-brand/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          disabled={saving || saved}
          onClick={async () => {
            setSaving(true);
            try {
              await api.post("/api/looks", { recommendationId: outfit.id, note: "" });
              setSaved(true);
              toast.success("Look saved");
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Failed to save look");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving\u2026" : saved ? "Saved" : "Save look"}
        </Button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-card shadow-soft p-5 flex flex-col gap-4
                     animate-stagger-in"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex flex-col gap-1.5">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-full" />
            <Skeleton className="h-8 flex-1 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OutfitsPage() {
  const { user, loading: authLoading } = useRequireAuth();

  // One settled fetch per viewer. "Loading" is the absence of a result for the
  // current viewer, which is what keeps the effect free of a synchronous reset.
  const [loaded, setLoaded] = useState<{
    viewer: typeof user;
    outfits: OutfitRecommendation[];
    error: string | null;
  } | null>(null);

  const settled = loaded?.viewer === user ? loaded : null;
  const outfits = settled?.outfits ?? [];
  const error = settled?.error ?? null;
  const loading = settled === null;

  useEffect(() => {
    if (authLoading || !user) return;

    api
      .get<OutfitRecommendation[]>("/api/outfits")
      .then((data) => setLoaded({ viewer: user, outfits: data, error: null }))
      .catch((err: unknown) =>
        setLoaded((prev) => ({
          viewer: user,
          outfits: prev?.outfits ?? [],
          error: err instanceof ApiError ? err.message : "Failed to load outfits",
        }))
      );
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        {/* Header */}
        <header className="mb-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground tracking-wide">
              Your wardrobe
            </p>
            <h1 className="font-display text-5xl font-semibold text-foreground sm:text-6xl leading-[0.95] mt-1">
              Outfits
            </h1>
            {!loading && outfits.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {outfits.length} outfit{outfits.length !== 1 ? "s" : ""} curated for you
              </p>
            )}
          </div>
          {!loading && outfits.length > 0 && (
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                className="rounded-full border-border hover:border-muted-foreground/30
                           active:scale-[0.97] transition-all"
              >
                <Link href="/outfits/new">Build your own</Link>
              </Button>
              <Button
                asChild
                className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover
                           active:scale-[0.97] transition-all"
              >
                <Link href="/chat">Generate new</Link>
              </Button>
            </div>
          )}
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <LoadingSkeleton />}

        {/* Empty state */}
        {!loading && !error && outfits.length === 0 && (
          <div className="relative flex flex-col items-center justify-center gap-8 py-32 text-center">
            {/* Ambient glow */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 40%, var(--color-brand) 0%, transparent 70%)",
                filter: "blur(80px)",
              }}
            />

            <div className="rounded-2xl bg-brand/10 p-5">
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
                className="text-brand"
                aria-label="Outfits"
              >
                <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" />
              </svg>
            </div>
            <div className="max-w-md">
              <p className="font-display text-3xl font-semibold text-foreground leading-tight">
                Your looks start here
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground" style={{ textWrap: "balance" }}>
                Your AI stylist curates complete outfits based on your style,
                body profile, and mood. Every look is uniquely yours.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover
                           active:scale-[0.97] transition-all px-8"
              >
                <Link href="/chat">Generate your first outfit</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-border hover:border-muted-foreground/30
                           active:scale-[0.97] transition-all"
              >
                <Link href="/outfits/new">Build your own</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Outfit grid */}
        {!loading && outfits.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {outfits.map((outfit, i) => (
              <OutfitGridCard key={outfit.id} outfit={outfit} index={i} />
            ))}
          </div>
        )}
      </PageShell>
    </>
  );
}
