"use client";

import { cn } from "@/lib/utils";

type GenerationStatusValue = "PENDING" | "RUNNING" | "READY" | "FAILED" | null;

interface GenerationStatusBadgeProps {
  status: GenerationStatusValue;
  className?: string;
}

const statusConfig: Record<
  NonNullable<GenerationStatusValue> | "NONE",
  { label: string; className: string; icon?: string }
> = {
  PENDING: {
    label: "Generating...",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "⏳",
  },
  RUNNING: {
    label: "Processing...",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "⟳",
  },
  READY: {
    label: "3D Ready",
    className: "bg-green-100 text-green-800 border-green-200",
    icon: "✓",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-200",
    icon: "✗",
  },
  NONE: {
    label: "No 3D",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function GenerationStatusBadge({ status, className }: GenerationStatusBadgeProps) {
  const key = status ?? "NONE";
  const config = statusConfig[key];

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`3D generation status: ${config.label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.icon && (
        <span
          className={cn(
            "text-xs leading-none",
            status === "RUNNING" && "animate-spin inline-block",
          )}
          aria-hidden="true"
        >
          {config.icon}
        </span>
      )}
      {config.label}
    </span>
  );
}
