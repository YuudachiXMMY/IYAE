"use client";

import {
  STYLE_AESTHETICS,
  FIT_PREFERENCES,
  BRANDS,
  BUDGET_RANGES,
  OUTFIT_GOALS,
} from "@/lib/profile-options";
import { SectionKicker } from "@/components/design-system/SectionKicker";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { FilterPill } from "@/components/design-system/FilterPill";
import { AbstractForm } from "@/components/design-system/AbstractForm";
import type { RegisterRequest } from "@/lib/api";

interface StepStylePrefsProps {
  data: Partial<RegisterRequest>;
  onChange: (updates: Partial<RegisterRequest>) => void;
}

function toggle(arr: string[] | undefined, value: string): string[] {
  const current = arr ?? [];
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}

const MOODBOARDS: { label: string; tint: number }[] = [
  { label: "QUIET LUXURY", tint: 10 },
  { label: "OFF-DUTY", tint: 25 },
  { label: "AFTER DARK", tint: 48 },
  { label: "ART SCHOOL", tint: 70 },
];

function PillSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-body text-[13px] font-medium text-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function StepStylePrefs({ data, onChange }: StepStylePrefsProps) {
  return (
    <div className="space-y-8">
      <div>
        <SectionKicker>STYLE PROFILE</SectionKicker>
        <EditorialHeading className="mt-3">What feels most like you?</EditorialHeading>
        <p className="mt-3 font-body text-[15px] text-muted-foreground">
          Pick the aesthetics you gravitate toward — choose as many as you like.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STYLE_AESTHETICS.map((s) => (
          <FilterPill
            key={s}
            active={(data.styleAesthetics ?? []).includes(s)}
            onClick={() => onChange({ styleAesthetics: toggle(data.styleAesthetics, s) })}
          >
            {s}
          </FilterPill>
        ))}
      </div>

      {/* Decorative moodboard tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MOODBOARDS.map((m) => (
          <div key={m.label} className="relative">
            <AbstractForm
              tint={m.tint}
              rounded="rounded-[28px]"
              className="h-40 w-full sm:h-52"
            />
            <span className="absolute bottom-3 left-3 font-body text-[11px] font-semibold uppercase tracking-[0.12px] text-foreground">
              {m.label}
            </span>
          </div>
        ))}
      </div>

      <PillSection title="Your preferred silhouettes">
        {FIT_PREFERENCES.map((f) => (
          <FilterPill
            key={f}
            active={(data.fitPreferences ?? []).includes(f)}
            onClick={() => onChange({ fitPreferences: toggle(data.fitPreferences, f) })}
          >
            {f}
          </FilterPill>
        ))}
      </PillSection>

      <PillSection title="Favorite brands">
        {BRANDS.map((b) => (
          <FilterPill
            key={b}
            active={(data.favoriteBrands ?? []).includes(b)}
            onClick={() => onChange({ favoriteBrands: toggle(data.favoriteBrands, b) })}
          >
            {b}
          </FilterPill>
        ))}
      </PillSection>

      <PillSection title="Budget range">
        {BUDGET_RANGES.map((b) => (
          <FilterPill
            key={b}
            active={data.budgetRange === b}
            onClick={() => onChange({ budgetRange: b })}
          >
            {b}
          </FilterPill>
        ))}
      </PillSection>

      <PillSection title="Outfit goals">
        {OUTFIT_GOALS.map((g) => (
          <FilterPill
            key={g}
            active={(data.outfitGoals ?? []).includes(g)}
            onClick={() => onChange({ outfitGoals: toggle(data.outfitGoals, g) })}
          >
            {g}
          </FilterPill>
        ))}
      </PillSection>
    </div>
  );
}
