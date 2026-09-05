"use client";

import { cn } from "@/lib/utils";

type RiggingStatusValue = "PENDING" | "RUNNING" | "READY" | "FAILED" | "NONE";

interface RiggingStatusBadgeProps {
  status: RiggingStatusValue;
  className?: string;
}

const statusConfig: Record<
  RiggingStatusValue,
  { label: string; className: string; icon?: string; animate?: boolean }
> = {
  PENDING: {
    label: "Rigging Queued",
    className: "bg-warning/10 text-warning border-warning/20",
    icon: "⏳",
    animate: true,
  },
  RUNNING: {
    label: "Rigging...",
    className: "bg-info/10 text-info border-info/20",
    icon: "⟳",
    animate: true,
  },
  READY: {
    label: "Rigged",
    className: "bg-success/10 text-success border-success/20",
    icon: "✓",
  },
  FAILED: {
    label: "Rigging Failed",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: "✗",
  },
  NONE: {
    label: "Not Rigged",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function RiggingStatusBadge({ status, className }: RiggingStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`Rigging status: ${config.label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
        config.animate && "animate-pulse",
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
