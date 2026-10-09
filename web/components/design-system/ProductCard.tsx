"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { AbstractForm } from "@/components/design-system/AbstractForm";

interface ProductCardProps {
  name: string;
  price: string;
  imageUrl?: string;
  href: string;
  saved?: boolean;
  onToggleSave?: () => void;
}

/**
 * Editorial product card (Figma ~276×300 image ratio, `rounded-[2px]`).
 * Falls back to an `AbstractForm` burgundy-tint placeholder when no image.
 */
export function ProductCard({
  name,
  price,
  imageUrl,
  href,
  saved = false,
  onToggleSave,
}: ProductCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[276/300] w-full rounded-[2px] overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 276px"
          />
        ) : (
          <AbstractForm
            className="absolute inset-0"
            rounded="rounded-[2px]"
            tint={12}
          />
        )}
        {/* Only offer a button when there is something for it to do — a heart
            wired to `onToggleSave?.()` with no handler swallows every click. */}
        {onToggleSave ? (
          <button
            type="button"
            aria-label="Save"
            aria-pressed={saved}
            onClick={(e) => {
              e.preventDefault();
              onToggleSave();
            }}
            className={cn(
              "absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background",
              saved && "text-brand"
            )}
          >
            <Heart
              width={16}
              height={16}
              fill={saved ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
        ) : saved ? (
          <span
            aria-label="Saved"
            role="img"
            className="pointer-events-none absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/80 text-brand"
          >
            <Heart width={16} height={16} fill="currentColor" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-body font-medium text-[15px] text-foreground">
        {name}
      </p>
      <p className="text-[13px] text-muted-foreground">{price}</p>
    </Link>
  );
}
