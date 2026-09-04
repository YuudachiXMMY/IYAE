"use client";

import { COLOR_PALETTE } from "@/lib/profile-options";
import type { RegisterRequest } from "@/lib/api";

interface StepColorsProps {
  data: Partial<RegisterRequest>;
  onChange: (updates: Partial<RegisterRequest>) => void;
}

function toggle(arr: string[] | undefined, value: string): string[] {
  const current = arr ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function ColorGrid({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {COLOR_PALETTE.map(({ name, hex }) => {
        const isSelected = selected.includes(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(name)}
            title={name}
            className={[
              "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-150",
              isSelected ? "border-purple-600 shadow-md scale-105" : "border-transparent hover:border-border",
            ].join(" ")}
          >
            <span
              className="w-8 h-8 rounded-full block border border-border"
              style={{ backgroundColor: hex }}
            />
            <span className="text-xs text-muted-foreground leading-tight text-center">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function StepColors({ data, onChange }: StepColorsProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-foreground">Your palette</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose colors you love and colors to avoid — all optional</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" />
          <h3 className="text-sm font-medium text-muted-foreground">Colors I love</h3>
          {(data.favoriteColors ?? []).length > 0 && (
            <span className="text-xs text-purple-600 font-medium">
              {(data.favoriteColors ?? []).length} selected
            </span>
          )}
        </div>
        <ColorGrid
          selected={data.favoriteColors ?? []}
          onToggle={(name) =>
            onChange({
              favoriteColors: toggle(data.favoriteColors, name),
              avoidedColors: (data.avoidedColors ?? []).filter((c) => c !== name),
            })
          }
        />
      </div>

      <div className="border-t border-border pt-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-muted-foreground inline-block" />
          <h3 className="text-sm font-medium text-muted-foreground">Colors I avoid</h3>
          {(data.avoidedColors ?? []).length > 0 && (
            <span className="text-xs text-muted-foreground font-medium">
              {(data.avoidedColors ?? []).length} selected
            </span>
          )}
        </div>
        <ColorGrid
          selected={data.avoidedColors ?? []}
          onToggle={(name) =>
            onChange({
              avoidedColors: toggle(data.avoidedColors, name),
              favoriteColors: (data.favoriteColors ?? []).filter((c) => c !== name),
            })
          }
        />
      </div>
    </div>
  );
}
