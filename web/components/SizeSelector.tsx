"use client";

import { cn } from "@/lib/utils";

interface SizeSelectorProps {
  sizes: string[];
  selectedSize: string | null;
  onSelect: (size: string) => void;
  disabled?: boolean;
}

export function SizeSelector({ sizes, selectedSize, onSelect, disabled }: SizeSelectorProps) {
  if (sizes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select a size">
      {sizes.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onSelect(size)}
          disabled={disabled}
          aria-pressed={selectedSize === size}
          className={cn(
            "min-w-11 min-h-11 px-3 rounded-md text-sm font-medium border transition-colors duration-150",
            selectedSize === size
              ? "bg-foreground text-background border-foreground"
              : "border-border hover:border-foreground/50",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
