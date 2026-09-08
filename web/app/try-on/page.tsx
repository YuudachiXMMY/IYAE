"use client";
// Try-On Hub — central landing for all AR/3D try-on features
// Shows detected device capabilities and platform-specific instructions.

import Link from "next/link";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { useARSupport } from "@/lib/hooks/useARSupport";
import { Skeleton } from "@/components/ui/skeleton";

// ── Capability badge ──────────────────────────────────────────────────────────

function CapabilityBadge({
  label,
  supported,
}: {
  label: string;
  supported: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${
          supported ? "bg-success" : "bg-muted-foreground/40"
        }`}
        aria-hidden="true"
      />
      <span
        className={`text-sm ${supported ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span
        className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
          supported
            ? "bg-success/10 text-success"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {supported ? "Supported" : "Not available"}
      </span>
    </div>
  );
}

// ── Platform instruction cards ────────────────────────────────────────────────

const PLATFORM_INSTRUCTIONS = [
  {
    platform: "Android (Chrome 79+)",
    steps: [
      "Open an outfit from your wardrobe",
      'Tap "View in AR"',
      "Point camera at a flat surface",
      "Tap to place the outfit",
    ],
  },
  {
    platform: "iOS (Safari)",
    steps: [
      "Open an outfit from your wardrobe",
      'Tap "View in AR"',
      "AR Quick Look opens automatically",
      "Move your iPhone to scan surroundings",
    ],
  },
  {
    platform: "Desktop",
    steps: [
      "Open any outfit",
      "Use the interactive 3D viewer",
      "Drag to rotate, scroll to zoom",
      "Right-click to pan",
    ],
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TryOnPage() {
  const { webxr, arQuickLook, sceneViewer, loading } = useARSupport();

  const hasAnyAR = webxr || arQuickLook || sceneViewer;

  return (
    <>
      <SiteHeader variant="app" />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Try On
          </h1>
          <p className="mt-3 text-muted-foreground">
            Experience fashion in augmented reality. Your outfits come to life
            in your space before you buy.
          </p>
        </div>

        {/* Device capability panel */}
        <div className="mb-8 rounded-2xl bg-card p-6 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Your Device Capabilities
          </h2>

          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <CapabilityBadge label="WebXR (immersive-ar)" supported={webxr} />
              <CapabilityBadge label="AR Quick Look (iOS)" supported={arQuickLook} />
              <CapabilityBadge label="Scene Viewer (Android)" supported={sceneViewer} />
            </div>
          )}

          {!loading && (
            <p className="mt-4 text-xs text-muted-foreground">
              {hasAnyAR
                ? "Great — your device supports AR. Open any outfit to try it on."
                : "AR is not available on this device or browser. You can still use the interactive 3D viewer."}
            </p>
          )}
        </div>

        {/* Quick-action links */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/chat"
            className="flex flex-col gap-2 rounded-2xl bg-brand p-6 text-primary-foreground shadow transition hover:bg-brand-hover active:scale-[0.98]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="font-semibold">Start AI Styling</span>
            <span className="text-sm text-primary-foreground/70">
              Chat with your AI stylist to build outfits
            </span>
          </Link>

          <Link
            href="/ar-visualization"
            className="flex flex-col gap-2 rounded-2xl bg-card p-6 shadow-soft transition hover:shadow-md active:scale-[0.98]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand"
              aria-hidden="true"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span className="font-semibold text-foreground">AR Demo</span>
            <span className="text-sm text-muted-foreground">
              See AR in action with a sample model
            </span>
          </Link>
        </div>

        {/* Platform instructions */}
        <div className="rounded-2xl bg-card p-6 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            How It Works
          </h2>
          <div className="flex flex-col gap-6">
            {PLATFORM_INSTRUCTIONS.map((item) => (
              <div key={item.platform}>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {item.platform}
                </h3>
                <ol className="flex flex-col gap-1.5">
                  {item.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
