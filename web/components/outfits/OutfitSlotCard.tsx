"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";

interface OutfitSlotCardProps {
  slot: string;
  label: string;
  product?: { id: number; name: string; price: number; media: string[]; glbUrl: string | null };
  onAdd: () => void;
  onRemove: () => void;
}

export function OutfitSlotCard({
  label,
  product,
  onAdd,
  onRemove,
}: OutfitSlotCardProps) {
  const imageUrl = product?.media?.[0] ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-soft">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>

      {product ? (
        <>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 45vw, 220px"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9l4-4 4 4 4-4 4 4" />
                </svg>
              </div>
            )}
            {product.glbUrl && (
              <span className="absolute top-2 right-2 rounded-full bg-brand/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                3D
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5 px-0.5">
            <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
              {product.name}
            </p>
            <p className="text-xs text-muted-foreground">${product.price}</p>
          </div>

          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 rounded-full text-xs border-border"
              onClick={onAdd}
            >
              Change
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs border-border text-destructive hover:text-destructive"
              onClick={onRemove}
              aria-label={`Remove ${label}`}
            >
              ×
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-brand/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
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
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <span className="text-xs text-muted-foreground">Add {label}</span>
        </button>
      )}
    </div>
  );
}
