"use client";

import { cn } from "@/lib/utils";

interface AbstractFormProps {
  /** Burgundy tint percentage mixed with transparent (default 10). */
  tint?: number;
  className?: string;
  /** Tailwind rounded utility (default `rounded-[40px]`). */
  rounded?: string;
}

/**
 * Decorative burgundy-tint blob — the pervasive placeholder motif that
 * replaces photography throughout the FORME editorial design. Purely
 * presentational (aria-hidden).
 */
export function AbstractForm({
  tint = 10,
  className,
  rounded = "rounded-[40px]",
}: AbstractFormProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(rounded, className)}
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-brand) ${tint}%, transparent)`,
      }}
    />
  );
}
