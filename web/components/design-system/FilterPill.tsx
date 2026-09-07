"use client";

import { cn } from "@/lib/utils";

interface FilterPillProps {
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function FilterPill({
  active,
  onClick,
  children,
  className,
}: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-chip h-[34px] px-4 text-[12px] font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-background border border-border text-muted-foreground hover:border-foreground/40",
        className
      )}
    >
      {children}
    </button>
  );
}
