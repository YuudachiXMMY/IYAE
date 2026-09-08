"use client";

import { useState, useEffect, useCallback } from "react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { api, ApiError } from "@/lib/api";

// ── Body Type Options ────────────────────────────────────────────────────────

const BODY_TYPE_OPTIONS = [
  { id: "female", label: "Female", icon: "♀" },
  { id: "male", label: "Male", icon: "♂" },
  { id: "neutral", label: "Neutral", icon: "⚧" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface BodyProfile {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  shoulderWidthCm: number | null;
  inseamCm: number | null;
  shoeSize: string | null;
  topSize: string | null;
  bottomSize: string | null;
  dressSize: string | null;
  jacketSize: string | null;
}

type ProfileFormState = {
  heightCm: string;
  weightKg: string;
  chestCm: string;
  waistCm: string;
  hipsCm: string;
  shoulderWidthCm: string;
  inseamCm: string;
  shoeSize: string;
  topSize: string;
  bottomSize: string;
  dressSize: string;
  jacketSize: string;
};

function profileToForm(profile: BodyProfile): ProfileFormState {
  return {
    heightCm: profile.heightCm !== null ? String(profile.heightCm) : "",
    weightKg: profile.weightKg !== null ? String(profile.weightKg) : "",
    chestCm: profile.chestCm !== null ? String(profile.chestCm) : "",
    waistCm: profile.waistCm !== null ? String(profile.waistCm) : "",
    hipsCm: profile.hipsCm !== null ? String(profile.hipsCm) : "",
    shoulderWidthCm: profile.shoulderWidthCm !== null ? String(profile.shoulderWidthCm) : "",
    inseamCm: profile.inseamCm !== null ? String(profile.inseamCm) : "",
    shoeSize: profile.shoeSize ?? "",
    topSize: profile.topSize ?? "",
    bottomSize: profile.bottomSize ?? "",
    dressSize: profile.dressSize ?? "",
    jacketSize: profile.jacketSize ?? "",
  };
}

function formToPayload(form: ProfileFormState): BodyProfile {
  const parse = (v: string) => (v.trim() !== "" ? Number(v) : null);
  const str = (v: string) => (v.trim() !== "" ? v.trim() : null);
  return {
    heightCm: parse(form.heightCm),
    weightKg: parse(form.weightKg),
    chestCm: parse(form.chestCm),
    waistCm: parse(form.waistCm),
    hipsCm: parse(form.hipsCm),
    shoulderWidthCm: parse(form.shoulderWidthCm),
    inseamCm: parse(form.inseamCm),
    shoeSize: str(form.shoeSize),
    topSize: str(form.topSize),
    bottomSize: str(form.bottomSize),
    dressSize: str(form.dressSize),
    jacketSize: str(form.jacketSize),
  };
}

// ── Measurement Input ─────────────────────────────────────────────────────────

function MeasurementInput({
  id,
  label,
  unit,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}{" "}
        <span className="text-xs text-muted-foreground">({unit})</span>
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min="0"
          step="0.1"
          placeholder="—"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-12"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BodyProfilePage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [form, setForm] = useState<ProfileFormState>({
    heightCm: "",
    weightKg: "",
    chestCm: "",
    waistCm: "",
    hipsCm: "",
    shoulderWidthCm: "",
    inseamCm: "",
    shoeSize: "",
    topSize: "",
    bottomSize: "",
    dressSize: "",
    jacketSize: "",
  });
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bodyType, setBodyType] = useState<string>("neutral");

  // Derive initial body type from user.genderIdentity
  useEffect(() => {
    if (user?.genderIdentity) {
      const g = (user.genderIdentity as string).toLowerCase();
      if (g.includes("female")) setBodyType("female");
      else if (g.includes("male")) setBodyType("male");
      else setBodyType("neutral");
    }
  }, [user]);

  const handleBodyTypeChange = useCallback(async (type: string) => {
    setBodyType(type);
    try {
      await api.put("/api/auth/profile", { genderIdentity: type });
    } catch {
      // Silently fail — local state already updated
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    api
      .get<BodyProfile>("/api/body-profile")
      .then((profile) => setForm(profileToForm(profile)))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          // No profile yet — keep empty form
        } else {
          setFetchError("Failed to load your measurements. Please try again.");
        }
      })
      .finally(() => setFetchLoading(false));
  }, [authLoading, user]);

  function setField(field: keyof ProfileFormState) {
    return (value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      await api.post<BodyProfile>("/api/body-profile", formToPayload(form));
      setToast({ type: "success", message: "Measurements saved successfully!" });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to save measurements.";
      setToast({ type: "error", message });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (authLoading || fetchLoading) {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="mx-auto max-w-lg space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="mx-auto max-w-lg">
          <div className="mb-8">
            <h1 className="font-display text-4xl font-semibold text-foreground">
              Body Profile
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your measurements help our AI provide accurate fit recommendations
              and power your 3D avatar. All values are kept private.
            </p>
          </div>

          {toast && (
            <div
              className={`mb-6 rounded-xl px-4 py-3 text-sm ${
                toast.type === "success"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {toast.message}
            </div>
          )}

          <Card className="rounded-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Your Measurements</CardTitle>
              <CardDescription>
                Enter your measurements in centimetres and kilograms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fetchError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive mb-6">
                  <p>{fetchError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFetchError(null);
                      setFetchLoading(true);
                      api
                        .get<BodyProfile>("/api/body-profile")
                        .then((profile) => setForm(profileToForm(profile)))
                        .catch((retryErr) => {
                          if (retryErr instanceof ApiError && retryErr.status === 404) {
                            // No profile yet
                          } else {
                            setFetchError("Failed to load your measurements. Please try again.");
                          }
                        })
                        .finally(() => setFetchLoading(false));
                    }}
                    className="mt-2 text-sm font-medium text-destructive underline hover:text-destructive/80"
                  >
                    Retry
                  </button>
                </div>
              )}
              {/* Body Type Selector */}
              <div className="mb-6 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Body Type
                </h3>
                <p className="text-xs text-muted-foreground">
                  Determines which body model is used for avatar generation
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {BODY_TYPE_OPTIONS.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleBodyTypeChange(type.id)}
                      className={[
                        "rounded-2xl border-2 p-4 text-center transition-all duration-150",
                        bodyType === type.id
                          ? "border-brand bg-brand/10"
                          : "border-border bg-card hover:border-brand",
                      ].join(" ")}
                    >
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="font-medium text-sm text-foreground">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <MeasurementInput
                    id="heightCm"
                    label="Height"
                    unit="cm"
                    value={form.heightCm}
                    onChange={setField("heightCm")}
                  />
                  <MeasurementInput
                    id="weightKg"
                    label="Weight"
                    unit="kg"
                    value={form.weightKg}
                    onChange={setField("weightKg")}
                  />
                  <MeasurementInput
                    id="chestCm"
                    label="Chest"
                    unit="cm"
                    value={form.chestCm}
                    onChange={setField("chestCm")}
                  />
                  <MeasurementInput
                    id="waistCm"
                    label="Waist"
                    unit="cm"
                    value={form.waistCm}
                    onChange={setField("waistCm")}
                  />
                  <MeasurementInput
                    id="hipsCm"
                    label="Hips"
                    unit="cm"
                    value={form.hipsCm}
                    onChange={setField("hipsCm")}
                  />
                  <MeasurementInput
                    id="shoulderWidthCm"
                    label="Shoulder Width"
                    unit="cm"
                    value={form.shoulderWidthCm}
                    onChange={setField("shoulderWidthCm")}
                  />
                  <MeasurementInput
                    id="inseamCm"
                    label="Inseam"
                    unit="cm"
                    value={form.inseamCm}
                    onChange={setField("inseamCm")}
                  />
                </div>

                <div className="pt-2">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Clothing Sizes
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="shoeSize">Shoe Size</Label>
                      <Input
                        id="shoeSize"
                        placeholder="e.g. EU 38 / US 7.5"
                        value={form.shoeSize}
                        onChange={(e) => setField("shoeSize")(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="topSize">Top Size</Label>
                      <Input
                        id="topSize"
                        placeholder="e.g. S / M / 36"
                        value={form.topSize}
                        onChange={(e) => setField("topSize")(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bottomSize">Bottom Size</Label>
                      <Input
                        id="bottomSize"
                        placeholder="e.g. 28 / M"
                        value={form.bottomSize}
                        onChange={(e) => setField("bottomSize")(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dressSize">Dress Size</Label>
                      <Input
                        id="dressSize"
                        placeholder="e.g. 10 / M"
                        value={form.dressSize}
                        onChange={(e) => setField("dressSize")(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jacketSize">Jacket Size</Label>
                      <Input
                        id="jacketSize"
                        placeholder="e.g. 40R / L"
                        value={form.jacketSize}
                        onChange={(e) => setField("jacketSize")(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Measurements"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
