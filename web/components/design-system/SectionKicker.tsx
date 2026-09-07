"use client";

import { cn } from "@/lib/utils";

interface SectionKickerProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionKicker({ children, className }: SectionKickerProps) {
  return (
    <p
      className={cn(
        "font-body font-semibold text-[12px] uppercase tracking-[0.12px] text-brand",
        className
      )}
    >
      {children}
    </p>
  );
}
