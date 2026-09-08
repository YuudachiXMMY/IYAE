"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ResaleListingForm } from "@/components/ResaleListingForm";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { resale, ApiError, type ResaleEligibleItem } from "@/lib/api";

export default function ResaleSellPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const [items, setItems] = useState<ResaleEligibleItem[]>([]);
  const [selected, setSelected] = useState<ResaleEligibleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();
    resale
      .eligibleItems(controller.signal)
      .then(setItems)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load your items.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authLoading, user]);

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
      <PageShell>
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold text-foreground">Sell a pre-loved piece</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick something you&apos;ve purchased, set a price, and give it a second life.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-card" />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <p className="font-display text-xl font-semibold text-foreground">Nothing to resell yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Items you&apos;ve purchased will appear here once your orders are paid.
            </p>
            <Button asChild className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover">
              <Link href="/products">Browse products</Link>
            </Button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">Your items</p>
              {items.map((item) => (
                <button
                  key={`${item.productId}-${item.sizeLabel}`}
                  onClick={() => setSelected(item)}
                  className={cn(
                    "flex items-center justify-between rounded-card bg-card p-4 text-left shadow-soft transition-shadow hover:shadow-md",
                    selected === item && "ring-2 ring-brand",
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">Size {item.sizeLabel}</p>
                  </div>
                  <span className="text-xs text-brand">Select →</span>
                </button>
              ))}
            </div>
            <div>
              {selected ? (
                <ResaleListingForm item={selected} onCreated={() => router.push("/resale/my-listings")} />
              ) : (
                <p className="text-sm text-muted-foreground">Select an item to list it.</p>
              )}
            </div>
          </div>
        )}
      </PageShell>
      <Footer />
    </>
  );
}
