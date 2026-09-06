"use client";

import type { SizeRecommendationResponse } from "@/lib/api";

interface RecommendedSizeHintProps {
  recommendedSize: string | null;
  basis: SizeRecommendationResponse["basis"];
}

/**
 * Presentational "Your recommended size: M" hint shown above the size selector.
 * Renders nothing when there is no usable recommendation (basis NONE / null size).
 */
export function RecommendedSizeHint({ recommendedSize, basis }: RecommendedSizeHintProps) {
  if (basis === "NONE" || !recommendedSize) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-center gap-1.5 text-sm text-foreground">
        <span className="text-brand" aria-hidden="true">
          &#10003;
        </span>
        <span>
          Your recommended size: <strong>{recommendedSize}</strong>
        </span>
      </p>
      {basis === "SELF_REPORTED" && (
        <p className="text-xs text-muted-foreground">based on your saved sizes</p>
      )}
    </div>
  );
}
