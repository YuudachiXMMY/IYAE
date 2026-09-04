"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  styleTags: string[];
  colorTags: string[];
  sizes: string[];
  media: string[];
  glbUrl: string | null;
  status: string;
}

interface ProductListItemProps {
  product: Product;
  className?: string;
  priority?: boolean;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(price);
}

export function ProductListItem({ product, className, priority = false }: ProductListItemProps) {
  const primaryImage = product.media?.[0] ?? null;

  return (
    <Link
      href={`/products/${product.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card bg-card shadow-soft",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-heavy",
        "active:scale-[0.98] active:translate-y-0",
        className,
      )}
    >
      {/* Image area */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
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
              className="text-muted-foreground/40"
              aria-label="No image"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
        {/* Hover overlay */}
        <div className="pointer-events-none absolute inset-0 bg-foreground/0 transition-colors duration-300 group-hover:bg-foreground/[0.03]" />
      </div>

      {/* Info area */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Category badge */}
        <span className="w-fit rounded-full border border-border/50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {product.category}
        </span>

        {/* Name */}
        <h3 className="line-clamp-2 text-sm font-medium text-foreground leading-snug">
          {product.name}
        </h3>

        {/* Price */}
        <p className="mt-auto font-display text-lg font-semibold tracking-tight text-foreground">
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </Link>
  );
}
