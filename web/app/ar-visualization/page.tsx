"use client";
// AR Visualization showcase — demonstrates how IYAE uses AR
// across different devices. No authentication required.

import dynamic from "next/dynamic";
import Link from "next/link";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import {
  DeviceMobile,
  Desktop,
  Eye,
  CubeFocus,
  ArrowRight,
  AppleLogo,
  AndroidLogo,
  Globe,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { Icon } from "@phosphor-icons/react";

// SmartARViewer must be dynamically imported with ssr: false
const SmartARViewer = dynamic(
  () => import("@/components/SmartARViewer").then((m) => m.SmartARViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] w-full items-center justify-center rounded-3xl bg-muted/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading 3D viewer</p>
        </div>
      </div>
    ),
  }
);

// Placeholder demo model
const DEMO_GLB_URL = "/models/demo-outfit.glb";

// Motion presets — matching landing page vocabulary
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

// Feature data with Phosphor icons
interface ARFeature {
  title: string;
  description: string;
  icon: Icon;
  badge: string;
  platform: Icon;
}

const AR_FEATURES: ARFeature[] = [
  {
    title: "Immersive AR on Android",
    description:
      "Chrome 79+ and Meta Quest launch full immersive-AR sessions. Outfits anchor to real surfaces via hit-testing so you see them in your space.",
    icon: DeviceMobile,
    badge: "WebXR",
    platform: AndroidLogo,
  },
  {
    title: "AR Quick Look on iOS",
    description:
      "Safari on iPhone and iPad launches native AR Quick Look with .usdz models. Zero app installation, instant try-on.",
    icon: Eye,
    badge: "Quick Look",
    platform: AppleLogo,
  },
  {
    title: "Scene Viewer fallback",
    description:
      "Devices without WebXR fall back to Google Scene Viewer, rendering .glb models in a full camera-based AR experience.",
    icon: CubeFocus,
    badge: "Scene Viewer",
    platform: AndroidLogo,
  },
  {
    title: "3D orbit on desktop",
    description:
      "Browsers without AR get an interactive 3D viewer with orbit controls. Drag, zoom, and inspect every stitch and seam.",
    icon: Desktop,
    badge: "3D Viewer",
    platform: Globe,
  },
];

// ── Feature card (stacked right) ──────────────────────────────────────────

function FeatureCard({
  feature,
  index,
  reduce,
}: {
  feature: ARFeature;
  index: number;
  reduce: boolean | null;
}) {
  const IconComp = feature.icon;
  const PlatformIcon = feature.platform;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex gap-5 rounded-3xl border border-border/30 bg-card/60 p-6 backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5 hover:shadow-heavy"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-landing-surface">
        <IconComp size={24} weight="duotone" className="text-landing-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {feature.title}
          </h3>
          <PlatformIcon
            size={13}
            weight="bold"
            className="shrink-0 text-muted-foreground/60"
          />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {feature.badge}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

// ── Featured card (large left) ────────────────────────────────────────────

function FeaturedCard({
  feature,
  reduce,
}: {
  feature: ARFeature;
  reduce: boolean | null;
}) {
  const IconComp = feature.icon;
  const PlatformIcon = feature.platform;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="group rounded-3xl border border-border/30 bg-card/60 p-8 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-heavy lg:p-10"
    >
      <div className="mb-6 flex items-start justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-landing-surface">
          <IconComp
            size={28}
            weight="duotone"
            className="text-landing-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <PlatformIcon
            size={14}
            weight="bold"
            className="text-muted-foreground"
          />
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            {feature.badge}
          </span>
        </div>
      </div>
      <h3 className="font-display text-2xl font-semibold text-foreground lg:text-3xl">
        {feature.title}
      </h3>
      <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
        {feature.description}
      </p>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ARVisualizationPage() {
  const reduce = useReducedMotion();

  return (
    <>
      <SiteHeader variant="app" />

      {/* Page gradient background */}
      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(180deg, var(--gradient-page-start) 0%, var(--gradient-page-mid) 40%, var(--gradient-page-end) 100%)",
        }}
      >
        {/* ── Hero: split layout ─────────────────────────────────── */}
        <section className="relative overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              {/* Left: content */}
              <motion.div
                initial={reduce ? false : "hidden"}
                animate="visible"
                variants={stagger}
              >
                <motion.div
                  variants={fadeUp}
                  className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm"
                >
                  <CubeFocus
                    size={14}
                    weight="duotone"
                    className="text-brand"
                  />
                  Augmented Reality
                </motion.div>

                <motion.h1
                  variants={fadeUp}
                  className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
                >
                  See It on You,{" "}
                  <span
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-foreground) 0%, var(--color-landing-accent) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Before You Buy.
                  </span>
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
                >
                  Point your camera, place the outfit in your room, and rotate
                  it from every angle. The viewer adapts to your device
                  automatically.
                </motion.p>

                {/* Device compatibility pills */}
                <motion.div
                  variants={fadeUp}
                  className="mt-8 flex flex-wrap gap-2"
                >
                  {(
                    [
                      { icon: AppleLogo, label: "iOS Safari" },
                      { icon: AndroidLogo, label: "Android Chrome" },
                      { icon: Desktop, label: "Desktop 3D" },
                    ] as const
                  ).map(({ icon: PIcon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      <PIcon size={13} weight="bold" />
                      {label}
                    </span>
                  ))}
                </motion.div>

                <motion.div variants={fadeUp} className="mt-10 flex gap-4">
                  <Link
                    href="/chat"
                    className="group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-all duration-300 hover:bg-landing-accent hover:shadow-xl active:scale-[0.98]"
                  >
                    Try AR Styling
                    <ArrowRight
                      size={16}
                      weight="bold"
                      className="transition-transform duration-300 group-hover:translate-x-0.5"
                    />
                  </Link>
                  <Link
                    href="/try-on"
                    className="inline-flex items-center rounded-full border border-border px-7 py-3.5 text-sm font-semibold text-foreground transition-all duration-300 hover:bg-foreground hover:text-background active:scale-[0.98]"
                  >
                    Try-on hub
                  </Link>
                </motion.div>
              </motion.div>

              {/* Right: AR viewer with visual frame */}
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: 0.9,
                  delay: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative"
              >
                {/* Ambient glow behind viewer */}
                <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-brand/10 via-transparent to-landing-accent/10 blur-2xl" />

                <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-card/60 shadow-heavy backdrop-blur-sm">
                  <SmartARViewer glbUrls={[DEMO_GLB_URL]} />

                  {/* Floating badge */}
                  <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-foreground/80 px-3 py-1.5 text-xs font-medium text-background backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Live preview
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Features: asymmetric grid ──────────────────────────── */}
        <section className="relative py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            {/* Section header — left-aligned */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mb-16 max-w-2xl"
            >
              <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
                Works Everywhere You Shop
              </h2>
              <p className="mt-4 text-muted-foreground">
                One viewer, every device. We detect your hardware and route to
                the best AR experience available.
              </p>
            </motion.div>

            {/* Asymmetric layout: featured left + stacked right */}
            <div className="grid gap-6 lg:grid-cols-2">
              <FeaturedCard feature={AR_FEATURES[0]} reduce={reduce} />

              <div className="flex flex-col gap-6">
                {AR_FEATURES.slice(1).map((feature, i) => (
                  <FeatureCard
                    key={feature.title}
                    feature={feature}
                    index={i + 1}
                    reduce={reduce}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA block ──────────────────────────────────────────── */}
        <section className="px-6 pb-32 lg:px-8">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 32, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-4xl"
          >
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-landing-contrast/85 p-12 backdrop-blur-xl md:p-20">
              {/* Accent gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-landing-accent/20 to-transparent" />

              <div className="relative z-10 text-center">
                <h2 className="font-display text-3xl font-bold text-white md:text-5xl">
                  Ready to Try It On?
                </h2>
                <p className="mx-auto mt-4 max-w-md text-white/60">
                  Start a styling session and see your outfit in 3D before you
                  commit.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    href="/register"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-paper px-10 py-4 text-sm font-bold text-landing-contrast transition-all duration-300 hover:bg-landing-surface hover:shadow-xl active:scale-[0.98] sm:w-auto"
                  >
                    Get Started
                    <ArrowRight
                      size={16}
                      weight="bold"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                  <Link
                    href="/products"
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-10 py-4 text-sm font-bold text-white transition-all duration-300 hover:bg-paper/10 active:scale-[0.98] sm:w-auto"
                  >
                    Browse Products
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </>
  );
}
