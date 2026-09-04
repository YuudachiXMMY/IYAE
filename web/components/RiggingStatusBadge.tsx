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
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "⏳",
    animate: true,
  },
  RUNNING: {
    label: "Rigging...",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "⟳",
    animate: true,
  },
  READY: {
    label: "Rigged",
    className: "bg-green-100 text-green-800 border-green-200",
    icon: "✓",
  },
  FAILED: {
    label: "Rigging Failed",
    className: "bg-red-100 text-red-800 border-red-200",
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
