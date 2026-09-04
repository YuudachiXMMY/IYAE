"use client";

import Image from "next/image";

export interface SelectableProduct {
  id: number;
  name: string;
  price: number;
  category: string;
  media: string[];
  glbUrl: string | null;
}

interface ProductSelectCardProps {
  product: SelectableProduct;
  onSelect: () => void;
}

export function ProductSelectCard({ product, onSelect }: ProductSelectCardProps) {
  const imageUrl = product.media?.[0] ?? null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col gap-2 rounded-xl bg-card p-2 text-left shadow-soft transition-all hover:shadow-md hover:ring-2 hover:ring-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 45vw, 180px"
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
      </div>

      {product.glbUrl && (
        <span className="absolute top-3 right-3 rounded-full bg-brand/90 px-2 py-0.5 text-[10px] font-semibold text-white">
          3D
        </span>
      )}

      <div className="flex flex-col gap-0.5 px-1">
        <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
          {product.name}
        </p>
        <p className="text-xs text-muted-foreground">${product.price}</p>
      </div>
    </button>
  );
}
