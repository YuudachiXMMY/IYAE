"use client";

import { useState, useEffect } from "react";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
import type { UpdateProfileRequest } from "@/lib/api";
import {
  STYLE_AESTHETICS,
  FIT_PREFERENCES,
  COLOR_PALETTE,
  BRANDS,
  BUDGET_RANGES,
  OUTFIT_GOALS,
} from "@/lib/profile-options";

// ── Multi-select Chip ─────────────────────────────────────────────────────────

function ChipGroup({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={[
              "rounded-full border px-3 py-1 text-sm transition-colors",
              active
                ? "border-brand bg-brand text-white"
                : "border-border bg-card text-foreground hover:border-brand/50",
            ].join(" ")}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Color Chip Group ──────────────────────────────────────────────────────────

function ColorChipGroup({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((v) => v !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {COLOR_PALETTE.map(({ name, hex }) => {
        const active = selected.includes(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => toggle(name)}
            title={name}
            className={[
              "flex flex-col items-center gap-1 rounded-lg p-1 transition-all",
              active ? "ring-2 ring-brand ring-offset-2" : "opacity-80 hover:opacity-100",
            ].join(" ")}
          >
            <div
              className="h-8 w-8 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: hex }}
            />
            <span className="text-[10px] text-muted-foreground">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Section Wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Form State ────────────────────────────────────────────────────────────────

interface PrefsFormState {
  styleAesthetics: string[];
  fitPreferences: string[];
  favoriteColors: string[];
  avoidedColors: string[];
  budgetRange: string;
  favoriteBrands: string[];
  outfitGoals: string[];
  sustainableFashionInterest: boolean;
  pricePreference: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PreferencesPage() {
  const { user, loading } = useRequireAuth();
  const { updateProfile } = useAuth();

  const [form, setForm] = useState<PrefsFormState>({
    styleAesthetics: [],
    fitPreferences: [],
    favoriteColors: [],
    avoidedColors: [],
    budgetRange: "",
    favoriteBrands: [],
    outfitGoals: [],
    sustainableFashionInterest: false,
    pricePreference: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      styleAesthetics: user.styleAesthetics ?? [],
      fitPreferences: user.fitPreferences ?? [],
      favoriteColors: user.favoriteColors ?? [],
      avoidedColors: user.avoidedColors ?? [],
      budgetRange: user.budgetRange ?? "",
      favoriteBrands: user.favoriteBrands ?? [],
      outfitGoals: user.outfitGoals ?? [],
      sustainableFashionInterest: user.sustainableFashionInterest ?? false,
      pricePreference: user.pricePreference ?? "",
    });
  }, [user]);

  function setField<K extends keyof PrefsFormState>(key: K, value: PrefsFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload: UpdateProfileRequest = {
      styleAesthetics: form.styleAesthetics,
      fitPreferences: form.fitPreferences,
      favoriteColors: form.favoriteColors,
      avoidedColors: form.avoidedColors,
      budgetRange: form.budgetRange || undefined,
      favoriteBrands: form.favoriteBrands,
      outfitGoals: form.outfitGoals,
      sustainableFashionInterest: form.sustainableFashionInterest,
      pricePreference: form.pricePreference || undefined,
    };

    try {
      await updateProfile(payload);
      toast.success("Style preferences saved!");
    } catch {
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <PageShell>
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <NavBar />
      <PageShell>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="font-display text-4xl font-semibold text-foreground">
              Style Preferences
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Help your AI stylist understand your taste. Select as many options as you like.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="rounded-card shadow-soft">
              <CardHeader>
                <CardTitle className="font-display text-xl">Aesthetics &amp; Fit</CardTitle>
                <CardDescription>What styles speak to you?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Style Aesthetics">
                  <ChipGroup
                    options={STYLE_AESTHETICS}
                    selected={form.styleAesthetics}
                    onChange={(v) => setField("styleAesthetics", v)}
                  />
                </Section>

                <Section title="Fit Preferences">
                  <ChipGroup
                    options={FIT_PREFERENCES}
                    selected={form.fitPreferences}
                    onChange={(v) => setField("fitPreferences", v)}
                  />
                </Section>

                <Section title="Outfit Goals">
                  <ChipGroup
                    options={OUTFIT_GOALS}
                    selected={form.outfitGoals}
                    onChange={(v) => setField("outfitGoals", v)}
                  />
                </Section>
              </CardContent>
            </Card>

            <Card className="rounded-card shadow-soft">
              <CardHeader>
                <CardTitle className="font-display text-xl">Colors</CardTitle>
                <CardDescription>Your color palette preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Favorite Colors">
                  <ColorChipGroup
                    selected={form.favoriteColors}
                    onChange={(v) => setField("favoriteColors", v)}
                  />
                </Section>

                <Section title="Colors to Avoid">
                  <ColorChipGroup
                    selected={form.avoidedColors}
                    onChange={(v) => setField("avoidedColors", v)}
                  />
                </Section>
              </CardContent>
            </Card>

            <Card className="rounded-card shadow-soft">
              <CardHeader>
                <CardTitle className="font-display text-xl">Budget &amp; Brands</CardTitle>
                <CardDescription>Your spending preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Budget Range">
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_RANGES.map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() =>
                          setField("budgetRange", form.budgetRange === range ? "" : range)
                        }
                        className={[
                          "rounded-full border px-4 py-1.5 text-sm transition-colors",
                          form.budgetRange === range
                            ? "border-brand bg-brand text-white"
                            : "border-border bg-card text-foreground hover:border-brand/50",
                        ].join(" ")}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Favorite Brands">
                  <ChipGroup
                    options={BRANDS}
                    selected={form.favoriteBrands}
                    onChange={(v) => setField("favoriteBrands", v)}
                  />
                </Section>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="sustainable"
                    checked={form.sustainableFashionInterest}
                    onCheckedChange={(checked) =>
                      setField("sustainableFashionInterest", checked === true)
                    }
                  />
                  <Label htmlFor="sustainable" className="cursor-pointer text-sm">
                    I prefer sustainable / ethical fashion brands
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricePreference">Price Notes</Label>
                  <Input
                    id="pricePreference"
                    placeholder="e.g. I prefer quality over quantity"
                    value={form.pricePreference}
                    onChange={(e) => setField("pricePreference", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full rounded-full bg-brand text-white hover:bg-brand-hover"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
