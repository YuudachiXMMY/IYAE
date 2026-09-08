"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { resale, ApiError, type ResaleListing } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const CONDITION_LABEL: Record<string, string> = {
  NEW_WITH_TAGS: "New with tags",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
};

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(price);
}

export default function ResaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params.id);

  const [listing, setListing] = useState<ResaleListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    resale
      .get(id, controller.signal)
      .then(setListing)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load listing.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  async function handleBuy() {
    if (!user) {
      router.push("/login");
      return;
    }
    setBuying(true);
    try {
      const res = await resale.checkout(id);
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Checkout failed.");
      setBuying(false);
    }
  }

  const image = listing?.media?.[0] ?? listing?.productMedia?.[0] ?? null;
  const available = listing?.status === "LISTED";

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        {loading && (
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-[3/4] rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {!loading && listing && (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card bg-muted">
              {image && (
                <Image
                  src={image}
                  alt={listing.productName}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                <span className="w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-brand">
                  Pre-loved
                </span>
                <span className="w-fit rounded-full border border-border/50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {CONDITION_LABEL[listing.condition] ?? listing.condition}
                </span>
              </div>
              <h1 className="font-display text-3xl font-semibold text-foreground">
                {listing.productName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Size {listing.sizeLabel}
                {listing.sellerUsername ? ` · sold by @${listing.sellerUsername}` : ""}
              </p>
              <p className="font-display text-2xl font-semibold text-foreground">
                {formatPrice(listing.askingPrice, listing.currency)}
              </p>
              {listing.sellerNote && (
                <p className="whitespace-pre-line text-sm text-muted-foreground">{listing.sellerNote}</p>
              )}
              <Button
                onClick={handleBuy}
                disabled={!available || buying}
                className="mt-2 rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
              >
                {available ? (buying ? "Redirecting…" : "Buy now") : "No longer available"}
              </Button>
            </div>
          </div>
        )}
      </PageShell>
      <Footer />
    </>
  );
}
