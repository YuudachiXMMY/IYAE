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
    className: "bg-warning/10 text-warning border-warning/20",
    icon: "⏳",
  },
  RUNNING: {
    label: "Processing...",
    className: "bg-info/10 text-info border-info/20",
    icon: "⟳",
  },
  READY: {
    label: "3D Ready",
    className: "bg-success/10 text-success border-success/20",
    icon: "✓",
  },
  FAILED: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive border-destructive/20",
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
