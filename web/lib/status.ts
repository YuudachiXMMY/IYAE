import { cn } from "@/lib/utils";

/**
 * Semantic status tones. Each maps to a token pair defined in globals.css
 * (`--color-success/warning/info/destructive` + `bg-muted` for neutral).
 */
export type StatusTone = "success" | "warning" | "info" | "destructive" | "neutral";

/**
 * Explicit, JIT-safe class map. Tailwind cannot see runtime-built `bg-${tone}`
 * strings, so status badges MUST enumerate the full class here.
 */
export const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * Canonical status → tone lookup, unifying the order/promotion/generation
 * status maps that were previously duplicated across routes. Extend here (not
 * per-route) when a new status string appears. Keys are matched lowercase.
 */
export const STATUS_TONE: Record<string, StatusTone> = {
  // order lifecycle
  pending: "warning",
  processing: "info",
  paid: "success",
  shipped: "info",
  delivered: "success",
  completed: "success",
  fulfilled: "success",
  cancelled: "destructive",
  canceled: "destructive",
  refunded: "destructive",
  failed: "destructive",
  // promotion / generic lifecycle
  active: "success",
  draft: "warning",
  scheduled: "info",
  expired: "neutral",
  inactive: "neutral",
};

/** Resolve a status string to a tone, defaulting to neutral for unknown values. */
export function toneForStatus(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

/** Full badge className for a status pill; merges any extra classes last. */
export function statusBadgeClass(status: string | null | undefined, className?: string): string {
  return cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
    TONE_CLASS[toneForStatus(status)],
    className,
  );
}
