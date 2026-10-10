"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewerErrorBoundary } from "@/components/ViewerErrorBoundary";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAvatarStatus } from "@/lib/hooks/useAvatarStatus";
import { api, avatar, ApiError } from "@/lib/api";
import { toast } from "sonner";

const DEFAULT_AVATAR_URL = "/models/default-avatar.glb";

// Dynamic import for 3D viewer (no SSR)
const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="text-xs text-muted-foreground tracking-wide">
          Loading viewer…
        </p>
      </div>
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface BodyProfile {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  shoulderWidthCm: number | null;
  inseamCm: number | null;
}

// ── Measurement Row ────────────────────────────────────────────────────────────

function MeasurementRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">
        {value !== null ? (
          `${value} ${unit}`
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </span>
    </div>
  );
}

// ── Body Type Options ──────────────────────────────────────────────────────────

const BODY_TYPE_OPTIONS = [
  { id: "female", label: "Female", icon: "\u2640" },
  { id: "male", label: "Male", icon: "\u2642" },
  { id: "neutral", label: "Neutral", icon: "\u26A7" },
] as const;

// ── Avatar Viewer Panel (with retry) ──────────────────────────────────────────

function AvatarViewerPanel({ glbUrl }: { glbUrl: string }) {
  const [viewerKey, setViewerKey] = useState(0);
  const [viewerError, setViewerError] = useState<string | null>(null);

  function handleRetry() {
    setViewerError(null);
    setViewerKey((k) => k + 1);
  }

  if (viewerError) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center gap-4 px-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Could not load 3D viewer
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {viewerError}
          </p>
        </div>
        <Button
          onClick={handleRetry}
          variant="outline"
          size="sm"
          className="rounded-full border-border text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ViewerErrorBoundary
        key={viewerKey}
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading failed
          </div>
        }
        onError={(err) => {
          const msg = err.message || "Unknown error";
          if (
            msg.includes("404") ||
            msg.includes("Failed to fetch") ||
            msg.includes("NetworkError")
          ) {
            setViewerError(
              "Avatar model file could not be loaded. The file may still be processing — try again in a moment."
            );
          } else {
            setViewerError(msg);
          }
        }}
        onRetry={handleRetry}
      >
        <AvatarViewer avatarUrl={glbUrl} />
      </ViewerErrorBoundary>
    </div>
  );
}

function bodyTypeFromGender(genderIdentity: string | null | undefined): string {
  if (!genderIdentity) return "neutral";
  const g = genderIdentity.toLowerCase();
  if (g.includes("female")) return "female";
  if (g.includes("male")) return "male";
  return "neutral";
}

// ── Completeness ───────────────────────────────────────────────────────────────

function measurementCompleteness(profile: BodyProfile | null): {
  filled: number;
  total: number;
} {
  if (!profile) return { filled: 0, total: 7 };
  const fields = [
    profile.heightCm,
    profile.weightKg,
    profile.chestCm,
    profile.waistCm,
    profile.hipsCm,
    profile.shoulderWidthCm,
    profile.inseamCm,
  ];
  return { filled: fields.filter((v) => v !== null).length, total: 7 };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AvatarPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const {
    status: avatarStatus,
    loading: statusLoading,
    actionError,
    generate,
    regenerate,
    clearActionError,
    refresh,
  } = useAvatarStatus();

  const [profile, setProfile] = useState<BodyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  // Follows the saved gender identity until it is picked on this page; the pick
  // is persisted as that same identity, so the two can't drift apart.
  const [pickedBodyType, setPickedBodyType] = useState<string | null>(null);
  const bodyType = pickedBodyType ?? bodyTypeFromGender(user?.genderIdentity);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // Move focus to Cancel when entering the two-step confirm so keyboard/SR users are
  // not left on <body>, one blind activation away from an irreversible delete (M10).
  useEffect(() => {
    if (confirmingDelete) cancelDeleteRef.current?.focus();
  }, [confirmingDelete]);

  useEffect(() => {
    if (authLoading || !user) return;
    api
      .get<BodyProfile>("/api/body-profile")
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [authLoading, user]);

  async function handleBodyTypeChange(type: string) {
    setPickedBodyType(type);
    try {
      await api.put("/api/auth/profile", { genderIdentity: type });
    } catch {
      // Silently fail — local state already updated, will persist on next profile save
    }
  }

  async function handleDeleteBodyData() {
    setDeletingData(true);
    try {
      await avatar.delete();
      toast.success("Your body data was deleted");
      setConfirmingDelete(false);
      setProfile(null);
      refresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete body data"
      );
    } finally {
      setDeletingData(false);
    }
  }

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="mx-auto max-w-5xl">
            <Skeleton className="mb-6 h-4 w-32" />
            <Skeleton className="mb-2 h-10 w-56" />
            <Skeleton className="mb-8 h-4 w-80" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              <Skeleton className="lg:col-span-3 h-[560px] rounded-card" />
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            </div>
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) return null;

  // Derive state
  const hasProfile =
    profile !== null &&
    profile.heightCm !== null &&
    profile.weightKg !== null &&
    (profile.chestCm !== null ||
      profile.waistCm !== null ||
      profile.hipsCm !== null);

  const currentStatus = avatarStatus?.status ?? "NONE";
  const isGenerating =
    currentStatus === "PENDING" || currentStatus === "RUNNING";
  const isReady = currentStatus === "READY";
  const isFailed = currentStatus === "FAILED";
  const glbUrl = avatarStatus?.glbUrl ?? null;
  const completeness = measurementCompleteness(profile);

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="mx-auto max-w-5xl">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Profile
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground font-medium">Avatar</span>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              My Avatar
            </h1>
            <p className="mt-3 max-w-lg text-base text-muted-foreground leading-relaxed">
              A personalized 3D silhouette built from your body measurements
              — see how outfits fit before you buy.
            </p>
          </div>

          {/* Main grid — asymmetric: viewer 3/5, panel 2/5 */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* ── Left: Viewer ─────────────────────────────── */}
            <div
              className="lg:col-span-3 flex flex-col gap-4 animate-stagger-in"
              style={{ animationDelay: "0ms" }}
            >
              <div className="relative h-[560px] w-full overflow-hidden rounded-card bg-gradient-to-b from-muted/80 to-muted/40 ring-1 ring-border/50">
                {/* GENERATING state */}
                {isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {/* Pulsing rings */}
                    <div className="relative mb-6 h-16 w-16">
                      <div className="absolute inset-0 rounded-full border-2 border-brand/30 animate-ping" />
                      <div className="absolute inset-2 rounded-full border-2 border-brand/50 animate-pulse" />
                      <div className="absolute inset-4 rounded-full bg-brand/10" />
                    </div>
                    <p className="font-display text-lg text-foreground">
                      Crafting your silhouette
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground tracking-wide">
                      This may take a moment
                    </p>
                  </div>
                )}

                {/* READY state — 3D viewer */}
                {isReady && glbUrl && <AvatarViewerPanel glbUrl={glbUrl} />}

                {/* NONE state — show default 3D avatar */}
                {(currentStatus === "NONE" ||
                  (isReady && !glbUrl)) &&
                  !isGenerating && (
                    <>
                      <AvatarViewerPanel glbUrl={DEFAULT_AVATAR_URL} />
                      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                        <p className="text-xs text-muted-foreground bg-card/60 backdrop-blur-sm inline-block px-3 py-1 rounded-full">
                          {hasProfile
                            ? "Generate to create your personalized avatar"
                            : "Add measurements to personalize"}
                        </p>
                      </div>
                    </>
                  )}

                {/* FAILED state */}
                {isFailed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-label="Error"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      Avatar generation failed
                    </p>
                    <p className="text-xs text-muted-foreground mb-5 max-w-xs leading-relaxed">
                      {avatarStatus?.errorMessage ||
                        "An unexpected error occurred."}
                    </p>
                    <Button
                      onClick={regenerate}
                      className="rounded-full bg-brand text-white hover:bg-brand-hover"
                      size="sm"
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {/* Status badge overlay */}
                {avatarStatus && currentStatus !== "NONE" && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-card/80 backdrop-blur-sm px-3 py-1.5 ring-1 ring-border/30">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isReady
                          ? "bg-success"
                          : isGenerating
                            ? "bg-warning animate-pulse"
                            : isFailed
                              ? "bg-destructive"
                              : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-xs font-medium text-foreground">
                      {isReady && "Ready"}
                      {isGenerating && "Generating\u2026"}
                      {isFailed && "Failed"}
                    </span>
                  </div>
                )}
              </div>

              {/* Action error toast */}
              {actionError && (
                <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between">
                  <span>{actionError}</span>
                  <button
                    onClick={clearActionError}
                    className="ml-2 text-destructive/60 hover:text-destructive transition-colors"
                    aria-label="Dismiss error"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Interaction hints */}
              {isReady && glbUrl && (
                <p className="text-center text-xs text-muted-foreground tracking-wide">
                  Drag to rotate &middot; Scroll to zoom &middot; Right-click to pan
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {currentStatus === "NONE" && (
                  <Button
                    onClick={generate}
                    disabled={!hasProfile || statusLoading}
                    className="w-full rounded-full bg-brand text-white hover:bg-brand-hover transition-all active:scale-[0.98]"
                  >
                    Generate Avatar
                  </Button>
                )}
                {isReady && (
                  <Button
                    onClick={regenerate}
                    className="w-full rounded-full bg-brand text-white hover:bg-brand-hover transition-all active:scale-[0.98]"
                  >
                    Regenerate Avatar
                  </Button>
                )}
              </div>

              {/* Privacy: one-tap delete of avatar + body data (two-step confirm) */}
              {(hasProfile || isReady || glbUrl) && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Delete avatar &amp; body data
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Permanently removes your 3D avatar and measurements.
                    </p>
                  </div>
                  {confirmingDelete ? (
                    <div className="flex shrink-0 gap-2" aria-live="polite">
                      <Button
                        ref={cancelDeleteRef}
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        disabled={deletingData}
                        onClick={() => setConfirmingDelete(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-full text-xs"
                        disabled={deletingData}
                        onClick={handleDeleteBodyData}
                      >
                        {deletingData ? "Deleting..." : "Confirm"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 rounded-full text-xs"
                      disabled={isGenerating}
                      onClick={() => setConfirmingDelete(true)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ── Right: Profile Panel ─────────────────────── */}
            <div
              className="lg:col-span-2 flex flex-col gap-5 animate-stagger-in"
              style={{ animationDelay: "80ms" }}
            >
              {/* Body Type Card */}
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border/50">
                <h2 className="font-display text-lg font-medium text-foreground mb-1">
                  Body type
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Determines which body model is used
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {BODY_TYPE_OPTIONS.map((type) => {
                    const isSelected = bodyType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleBodyTypeChange(type.id)}
                        className={[
                          "relative rounded-xl p-3.5 text-center transition-all duration-200",
                          "hover:scale-[1.02] active:scale-[0.98]",
                          isSelected
                            ? "bg-brand/10 ring-2 ring-brand text-foreground"
                            : "bg-muted/50 ring-1 ring-border/40 text-muted-foreground hover:ring-border hover:bg-muted/80",
                        ].join(" ")}
                      >
                        <div className="text-2xl mb-1 leading-none">
                          {type.icon}
                        </div>
                        <div className="text-xs font-medium">{type.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Measurements Card */}
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-medium text-foreground">
                    Measurements
                  </h2>
                  {profile && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {completeness.filled}/{completeness.total}
                    </span>
                  )}
                </div>

                {/* Completeness bar */}
                {profile && (
                  <div className="mb-4 h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand/60 transition-all duration-500"
                      style={{
                        width: `${(completeness.filled / completeness.total) * 100}%`,
                      }}
                    />
                  </div>
                )}

                {profile && hasProfile ? (
                  <div className="divide-y divide-border/50">
                    <MeasurementRow
                      label="Height"
                      value={profile.heightCm}
                      unit="cm"
                    />
                    <MeasurementRow
                      label="Weight"
                      value={profile.weightKg}
                      unit="kg"
                    />
                    <MeasurementRow
                      label="Chest"
                      value={profile.chestCm}
                      unit="cm"
                    />
                    <MeasurementRow
                      label="Waist"
                      value={profile.waistCm}
                      unit="cm"
                    />
                    <MeasurementRow
                      label="Hips"
                      value={profile.hipsCm}
                      unit="cm"
                    />
                    <MeasurementRow
                      label="Shoulders"
                      value={profile.shoulderWidthCm}
                      unit="cm"
                    />
                    <MeasurementRow
                      label="Inseam"
                      value={profile.inseamCm}
                      unit="cm"
                    />
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {profile
                        ? "Complete your height, weight, and at least one body measurement to generate an avatar."
                        : "No measurements on file yet."}
                    </p>
                    <Link href="/profile/body" className="mt-4 inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-border text-xs hover:bg-muted/60 transition-colors"
                      >
                        Add measurements
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Update Measurements link */}
              {hasProfile && (
                <Link href="/profile/body">
                  <Button
                    variant="outline"
                    className="w-full rounded-full border-border text-sm hover:bg-muted/60 transition-all active:scale-[0.98]"
                  >
                    Update measurements
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
