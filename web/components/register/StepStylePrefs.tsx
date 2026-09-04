"use client";

import { STYLE_AESTHETICS, FIT_PREFERENCES, BRANDS, BUDGET_RANGES, OUTFIT_GOALS } from "@/lib/profile-options";
import type { RegisterRequest } from "@/lib/api";

interface StepStylePrefsProps {
  data: Partial<RegisterRequest>;
  onChange: (updates: Partial<RegisterRequest>) => void;
}

function toggle(arr: string[] | undefined, value: string): string[] {
  const current = arr ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full text-sm border transition-all duration-150",
        selected
          ? "bg-purple-600 border-purple-600 text-white"
          : "bg-card border-border text-muted-foreground hover:border-purple-300",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function StepStylePrefs({ data, onChange }: StepStylePrefsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">Your style</h2>
        <p className="text-sm text-muted-foreground mt-1">Tell us what you love — all optional</p>
      </div>

      <Section title="Style Aesthetics">
        {STYLE_AESTHETICS.map((s) => (
          <Chip
            key={s}
            label={s}
            selected={(data.styleAesthetics ?? []).includes(s)}
            onClick={() => onChange({ styleAesthetics: toggle(data.styleAesthetics, s) })}
          />
        ))}
      </Section>

      <Section title="Fit Preferences">
        {FIT_PREFERENCES.map((f) => (
          <Chip
            key={f}
            label={f}
            selected={(data.fitPreferences ?? []).includes(f)}
            onClick={() => onChange({ fitPreferences: toggle(data.fitPreferences, f) })}
          />
        ))}
      </Section>

      <Section title="Favorite Brands">
        {BRANDS.map((b) => (
          <Chip
            key={b}
            label={b}
            selected={(data.favoriteBrands ?? []).includes(b)}
            onClick={() => onChange({ favoriteBrands: toggle(data.favoriteBrands, b) })}
          />
        ))}
      </Section>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Budget Range</h3>
        <div className="flex flex-wrap gap-2">
          {BUDGET_RANGES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onChange({ budgetRange: b })}
              className={[
                "px-3 py-1.5 rounded-full text-sm border transition-all duration-150",
                data.budgetRange === b
                  ? "bg-purple-600 border-purple-600 text-white"
                  : "bg-card border-border text-muted-foreground hover:border-purple-300",
              ].join(" ")}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <Section title="Outfit Goals">
        {OUTFIT_GOALS.map((g) => (
          <Chip
            key={g}
            label={g}
            selected={(data.outfitGoals ?? []).includes(g)}
            onClick={() => onChange({ outfitGoals: toggle(data.outfitGoals, g) })}
          />
        ))}
      </Section>
    </div>
  );
}
