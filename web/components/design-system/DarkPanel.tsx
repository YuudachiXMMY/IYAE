"use client";

import { cn } from "@/lib/utils";

interface DarkPanelProps {
  children: React.ReactNode;
  /** Caller sets radius and padding. */
  className?: string;
}

/**
 * Ink panel with white text (`bg-foreground text-background`). Used for the
 * profile sidebar, AI fitting room, style-note card, and sign-in left panel.
 */
export function DarkPanel({ children, className }: DarkPanelProps) {
  return (
    <div className={cn("bg-foreground text-background", className)}>
      {children}
    </div>
  );
}
