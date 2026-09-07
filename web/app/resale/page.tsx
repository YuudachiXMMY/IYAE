"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResaleListingCard } from "@/components/ResaleListingCard";
import { resale, ApiError, type ResaleListing } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function ResaleBrowsePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    resale
      .browse(0, 40, controller.signal)
      .then((paged) => setListings(paged.content))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load pre-loved listings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <NavBar />
      <PageShell>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold text-foreground">Pre-loved</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Give great pieces a second life. Buy and sell pre-loved IYAE items.
            </p>
          </div>
          {user && (
            <Button asChild className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover">
              <Link href="/resale/sell">Sell an item</Link>
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-card" />
            ))}
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <p className="font-display text-xl font-semibold text-foreground">No pre-loved items yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Be the first to list a piece you love but no longer wear.
            </p>
            {user && (
              <Button asChild className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover">
                <Link href="/resale/sell">Sell an item</Link>
              </Button>
            )}
          </div>
        )}

        {!loading && listings.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ResaleListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </PageShell>
      <Footer />
    </>
  );
}
