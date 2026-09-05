"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { type SelectableProduct } from "./ProductSelectCard";

interface OutfitSlotSidebarItemProps {
  slot: string;
  label: string;
  product?: SelectableProduct;
  onAdd: () => void;
  onRemove: () => void;
}

export function OutfitSlotSidebarItem({
  label,
  product,
  onAdd,
  onRemove,
}: OutfitSlotSidebarItemProps) {
  if (!product) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border p-3 transition-colors hover:border-brand/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {/* Plus icon circle */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted/40">
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
        </div>
        <div className="text-left">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p className="text-sm font-medium text-muted-foreground">
            Add {label}
          </p>
        </div>
      </button>
    );
  }

  const imageUrl = product.media?.[0] ?? null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
      {/* 56x56 thumbnail */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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
        {/* 3D badge inside thumbnail */}
        {product.glbUrl && (
          <span className="absolute top-0.5 right-0.5 rounded-full bg-brand/90 px-1.5 py-0.5 text-[8px] font-semibold text-primary-foreground">
            3D
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-1">
          {product.name}
        </p>
        <p className="text-sm text-muted-foreground">${product.price}</p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full text-xs border-border h-7 px-2.5"
          onClick={onAdd}
        >
          Change
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full text-xs border-border text-destructive hover:text-destructive h-7 w-7 p-0"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          ×
        </Button>
      </div>
    </div>
  );
}
