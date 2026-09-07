"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ResaleListing } from "@/lib/api";

const CONDITION_LABEL: Record<string, string> = {
  NEW_WITH_TAGS: "New w/ tags",
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

export function ResaleListingCard({
  listing,
  className,
}: {
  listing: ResaleListing;
  className?: string;
}) {
  const image = listing.media?.[0] ?? listing.productMedia?.[0] ?? null;

  return (
    <Link
      href={`/resale/${listing.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card bg-card shadow-soft",
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-heavy",
        "active:scale-[0.98] active:translate-y-0",
        className,
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {image ? (
          <Image
            src={image}
            alt={listing.productName}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-muted-foreground/40"
            aria-label="No image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-brand">
            Pre-loved
          </span>
          <span className="w-fit rounded-full border border-border/50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {CONDITION_LABEL[listing.condition] ?? listing.condition}
          </span>
        </div>
        <h3 className="line-clamp-2 text-sm font-medium text-foreground leading-snug">
          {listing.productName}
        </h3>
        <p className="text-xs text-muted-foreground">
          Size {listing.sizeLabel}
          {listing.sellerUsername ? ` · @${listing.sellerUsername}` : ""}
        </p>
        <p className="mt-auto font-display text-lg font-semibold tracking-tight text-foreground">
          {formatPrice(listing.askingPrice, listing.currency)}
        </p>
      </div>
    </Link>
  );
}
