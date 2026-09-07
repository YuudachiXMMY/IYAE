"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { resale, ApiError, type ResaleListing } from "@/lib/api";

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(price);
}

export default function MyResaleListingsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();
    resale
      .myListings(controller.signal)
      .then(setListings)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load listings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authLoading, user]);

  async function handleRemove(id: number) {
    try {
      await resale.remove(id);
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: "REMOVED" } : l)),
      );
      toast.success("Listing removed.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove listing.");
    }
  }

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
      <NavBar />
      <PageShell>
        <div className="mb-8 flex items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-semibold text-foreground">My listings</h1>
          <Button asChild className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover">
            <Link href="/resale/sell">Sell an item</Link>
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-card" />
            ))}
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <p className="py-24 text-center text-sm text-muted-foreground">
            You have no pre-loved listings yet.
          </p>
        )}

        {!loading && listings.length > 0 && (
          <div className="flex flex-col gap-4">
            {listings.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-4 rounded-card bg-card p-5 shadow-soft"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/resale/${l.id}`}
                      className="text-sm font-semibold text-foreground hover:text-brand"
                    >
                      {l.productName}
                    </Link>
                    <span className="rounded-full border border-border/50 px-2 py-0.5 text-xs text-muted-foreground">
                      {l.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Size {l.sizeLabel} · {formatPrice(l.askingPrice, l.currency)}
                  </p>
                </div>
                {(l.status === "LISTED" || l.status === "DRAFT") && (
                  <Button
                    variant="ghost"
                    onClick={() => handleRemove(l.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </PageShell>
      <Footer />
    </>
  );
}
