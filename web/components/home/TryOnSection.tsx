"use client";

import {
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
  useScroll,
  useSpring,
  AnimatePresence,
} from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import MagneticCTALink from "./MagneticCTALink";
import { CTA_SPRING, EASE_OUT_EXPO, fadeUp } from "./motion-presets";
import { useCallback, useRef, useState, useEffect } from "react";
import {
  ArrowRight,
  PersonSimpleRun,
  GenderFemale,
  GenderMale,
  GenderNonbinary,
  ArrowsClockwise,
  CursorClick,
  Cube,
  UserCircle,
  CaretDown,
  Sliders,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { useAvatarStatus } from "@/lib/hooks/useAvatarStatus";

/* ─── dynamic 3D viewers (no SSR) ───────────── */

const TryOnViewer = dynamic(() => import("./TryOnViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-landing-accent/30 border-t-landing-accent" />
    </div>
  ),
});

const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-landing-accent/30 border-t-landing-accent" />
        <p className="text-[10px] text-white/40 tracking-wide">
          Loading 3D viewer
        </p>
      </div>
    </div>
  ),
});

/* ─── types & constants ───────────────────────── */

type BodyType = "female" | "male" | "neutral";
type WidgetStep = "input" | "generating" | "result";
type ViewMode = "demo" | "avatar";

const DEFAULT_AVATAR_URL = "/models/default-avatar.glb";

const BODY_TYPES: {
  id: BodyType;
  label: string;
  icon: typeof GenderFemale;
}[] = [
  { id: "female", label: "Female", icon: GenderFemale },
  { id: "male", label: "Male", icon: GenderMale },
  { id: "neutral", label: "Neutral", icon: GenderNonbinary },
];

const HEIGHT_RANGE = { min: 140, max: 210, default: 170 };
const WEIGHT_RANGE = { min: 40, max: 130, default: 65 };
const CHEST_RANGE = { min: 50, max: 200, default: 90 };
const WAIST_RANGE = { min: 40, max: 200, default: 75 };
const HIPS_RANGE = { min: 50, max: 200, default: 95 };
const SHOULDER_RANGE = { min: 20, max: 80, default: 40 };
const INSEAM_RANGE = { min: 40, max: 120, default: 80 };


/* ─── compact slider ──────────────────────────── */

function CompactSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs font-medium text-white/80 tabular-nums">
          {value} {unit}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.08]">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full bg-landing-accent/60"
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={label}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-landing-accent border-2 border-white/20 pointer-events-none shadow-[0_0_12px_rgba(196,101,74,0.3)]"
          animate={{ left: `calc(${pct}% - 7px)` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
      </div>
    </div>
  );
}

/* ─── body type pill selector ─────────────────── */

function BodyTypePicker({
  selected,
  onSelect,
}: {
  selected: BodyType;
  onSelect: (t: BodyType) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BODY_TYPES.map(({ id, label, icon: Icon }) => {
        const active = id === selected;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            whileTap={{ scale: 0.93 }}
            whileHover={{ scale: 1.03 }}
            transition={CTA_SPRING}
            className={[
              "relative flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-2 text-center transition-colors duration-200 cursor-pointer select-none",
              active
                ? "bg-landing-accent/20 ring-1 ring-landing-accent/50 text-white/90"
                : "bg-white/[0.06] ring-1 ring-white/[0.06] text-white/40 hover:text-white/60 hover:ring-white/10",
            ].join(" ")}
          >
            <Icon size={18} weight={active ? "fill" : "regular"} />
            <span className="text-[10px] font-medium tracking-wide uppercase">
              {label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ─── view mode toggle ────────────────────────── */

function ViewModeToggle({
  mode,
  onToggle,
  hasAvatar,
}: {
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
  hasAvatar: boolean;
}) {
  if (!hasAvatar) return null;

  return (
    <div className="flex items-center gap-1 rounded-full p-0.5 bg-white/[0.06] ring-1 ring-white/[0.06]">
      <button
        type="button"
        onClick={() => onToggle("demo")}
        className={[
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-wide transition-all duration-200 cursor-pointer",
          mode === "demo"
            ? "bg-landing-accent/20 text-white/90"
            : "text-white/40 hover:text-white/60",
        ].join(" ")}
      >
        <Cube size={12} weight={mode === "demo" ? "fill" : "regular"} />
        Demo
      </button>
      <button
        type="button"
        onClick={() => onToggle("avatar")}
        className={[
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-wide transition-all duration-200 cursor-pointer",
          mode === "avatar"
            ? "bg-landing-accent/20 text-white/90"
            : "text-white/40 hover:text-white/60",
        ].join(" ")}
      >
        <UserCircle
          size={12}
          weight={mode === "avatar" ? "fill" : "regular"}
        />
        My Avatar
      </button>
    </div>
  );
}

/* ─── main section ─────────────────────────────── */

export default function TryOnSection() {
  const reduce = useReducedMotion();
  const { user } = useAuth();
  const {
    status: avatarStatus,
    generate: generateAvatar,
    actionError: avatarActionError,
  } = useAvatarStatus();

  const [step, setStep] = useState<WidgetStep>("input");
  const [inputStep, setInputStep] = useState<1 | 2>(1);
  const [bodyType, setBodyType] = useState<BodyType>("neutral");
  const [heightCm, setHeightCm] = useState(HEIGHT_RANGE.default);
  const [weightKg, setWeightKg] = useState(WEIGHT_RANGE.default);
  const [chestCm, setChestCm] = useState(CHEST_RANGE.default);
  const [waistCm, setWaistCm] = useState(WAIST_RANGE.default);
  const [hipsCm, setHipsCm] = useState(HIPS_RANGE.default);
  const [shoulderWidthCm, setShoulderWidthCm] = useState(SHOULDER_RANGE.default);
  const [inseamCm, setInseamCm] = useState(INSEAM_RANGE.default);
  const [viewMode, setViewMode] = useState<ViewMode>("demo");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [guestTaskId, setGuestTaskId] = useState<number | null>(null);
  const [guestGlbUrl, setGuestGlbUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);

  /* Detect if user has a ready SMPLX avatar */
  const avatarGlbUrl = avatarStatus?.glbUrl ?? null;
  const avatarReady = avatarStatus?.status === "READY" && Boolean(avatarGlbUrl);
  const avatarGenerating =
    avatarStatus?.status === "PENDING" || avatarStatus?.status === "RUNNING";

  /* Auto-switch to avatar mode when user has one */
  useEffect(() => {
    if (avatarReady) setViewMode("avatar");
  }, [avatarReady]);

  /* Load default static avatar immediately for guests (no API call needed) */
  useEffect(() => {
    if (user || avatarReady) return;

    const cached = sessionStorage.getItem("clossette_guest_glb");
    if (cached) {
      setGuestGlbUrl(cached);
      return;
    }

    setGuestGlbUrl(DEFAULT_AVATAR_URL);
  }, [user, avatarReady]);

  const sectionRef = useRef<HTMLElement>(null);

  /* ─── scroll-driven parallax (MOTION_INTENSITY=8) ── */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  /* card: slow upward drift as section scrolls through viewport */
  const cardScrollY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const springCardScrollY = useSpring(cardScrollY, { stiffness: 80, damping: 30 });

  /* section-level fade driven by scroll position */
  const sectionOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  /* Parallax tilt (spring-damped, outside React render cycle) */
  const cardRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rawRotateX = useTransform(my, [-0.5, 0.5], [4, -4]);
  const rawRotateY = useTransform(mx, [-0.5, 0.5], [-4, 4]);
  const rotateX = useSpring(rawRotateX, { stiffness: 120, damping: 18 });
  const rotateY = useSpring(rawRotateY, { stiffness: 120, damping: 18 });

  /* Subtle glow follows cursor */
  const glowX = useSpring(useTransform(mx, [-0.5, 0.5], [20, 80]), {
    stiffness: 100,
    damping: 20,
  });
  const glowY = useSpring(useTransform(my, [-0.5, 0.5], [20, 80]), {
    stiffness: 100,
    damping: 20,
  });

  const handleCardMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduce || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      mx.set((e.clientX - rect.left) / rect.width - 0.5);
      my.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [reduce, mx, my],
  );

  const handleCardMouseLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  /* Save body profile + trigger real SMPLX generation for logged-in users */
  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    if (user && !avatarReady && !avatarGenerating) {
      setStep("generating");
      try {
        await Promise.all([
          api.put("/api/auth/profile", { genderIdentity: bodyType }),
          api.post("/api/body-profile", {
            heightCm: Number(heightCm),
            weightKg: Number(weightKg),
            chestCm: Number(chestCm),
            waistCm: Number(waistCm),
            hipsCm: Number(hipsCm),
            shoulderWidthCm: Number(shoulderWidthCm),
            inseamCm: Number(inseamCm),
          }),
        ]);
        generateAvatar();
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Could not save your measurements. Please try again.";
        setGenerateError(message);
        setStep("input");
      }
      return;
    }
    /* Guest mode: trigger real generation via public API */
    const alreadyHasModel = guestGlbUrl !== null;
    if (alreadyHasModel) {
      setIsUpdating(true);
    } else {
      setStep("generating");
    }
    try {
      const res = await api.post<{ taskId: number }>("/api/public/avatar/generate", {
        bodyType,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        chestCm: Number(chestCm),
        waistCm: Number(waistCm),
        hipsCm: Number(hipsCm),
        shoulderWidthCm: Number(shoulderWidthCm),
        inseamCm: Number(inseamCm),
      });
      setGuestTaskId(res.taskId);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Generation failed. Please try again.";
      setGenerateError(message);
      setIsUpdating(false);
      if (!alreadyHasModel) setStep("input");
    }
  }, [user, avatarReady, avatarGenerating, generateAvatar, heightCm, weightKg, bodyType, guestGlbUrl, chestCm, waistCm, hipsCm, shoulderWidthCm, inseamCm]);

  /* Sync real generation status to widget step */
  useEffect(() => {
    if (avatarGenerating && step !== "generating") {
      setStep("generating");
    }
    if (avatarReady && step === "generating") {
      setStep("result");
      setViewMode("avatar");
    }
  }, [avatarGenerating, avatarReady, step]);

  /* Fall back if avatar generate API fails (error caught inside hook) */
  useEffect(() => {
    if (avatarActionError && step === "generating" && !avatarGenerating) {
      setGenerateError(avatarActionError);
      setStep("input");
    }
  }, [avatarActionError, step, avatarGenerating]);

  /* Poll guest avatar task status */
  useEffect(() => {
    if (guestTaskId === null) return;
    const controller = new AbortController();
    const interval = setInterval(async () => {
      try {
        const res = await api.get<{
          status: string;
          glbUrl: string | null;
          errorMessage: string | null;
        }>(`/api/public/avatar/status/${guestTaskId}`, {
          signal: controller.signal,
        });
        if (res.status === "READY" && res.glbUrl) {
          setGuestGlbUrl(res.glbUrl);
          sessionStorage.setItem("clossette_guest_glb", res.glbUrl);
          if (step === "generating") setStep("result");
          setIsUpdating(false);
          setGuestTaskId(null);
        } else if (res.status === "FAILED") {
          setGenerateError(res.errorMessage || "Generation failed.");
          if (step === "generating") setStep("input");
          setIsUpdating(false);
          setGuestTaskId(null);
        }
      } catch {
        /* ignore aborted or transient errors */
      }
    }, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [guestTaskId, step]);

  const handleReset = useCallback(() => {
    setStep("input");
    setInputStep(1);
    setViewMode("demo");
    setGuestTaskId(null);
    setGuestGlbUrl(null);
  }, []);

  /* Normalized values for 3D viewer */
  const heightScale =
    (heightCm - HEIGHT_RANGE.min) / (HEIGHT_RANGE.max - HEIGHT_RANGE.min);
  const weightScale =
    (weightKg - WEIGHT_RANGE.min) / (WEIGHT_RANGE.max - WEIGHT_RANGE.min);

  const typeLabel =
    BODY_TYPES.find((t) => t.id === bodyType)?.label ?? "Neutral";

  const showRealAvatar =
    (viewMode === "avatar" && avatarReady && avatarGlbUrl) ||
    guestGlbUrl != null;
  const activeGlbUrl = avatarGlbUrl || guestGlbUrl;
  const initialLoading = guestTaskId !== null && guestGlbUrl === null && !avatarReady;

  return (
    <section
      ref={sectionRef}
      id="try-on"
      className="relative py-32 lg:py-48 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #151210 0%, #1e1916 60%, #121010 100%)",
      }}
    >
      {/* Ambient terracotta glow */}
      <div
        className="absolute right-1/3 top-0 w-[500px] h-[500px] opacity-[0.06] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, var(--color-landing-accent) 0%, transparent 70%)",
        }}
      />

      <motion.div
        style={reduce ? undefined : { opacity: sectionOpacity }}
        className="max-w-7xl mx-auto px-6 lg:px-8"
      >
        <div className="grid lg:grid-cols-[1fr_420px] gap-16 lg:gap-24 items-center">
          {/* Left: Text + feature pills */}
          <motion.div
            initial={reduce ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <motion.h2
              custom={0}
              variants={fadeUp}
              className="font-display text-5xl md:text-6xl lg:text-[64px] font-light tracking-tight leading-[1.05] mb-8"
              style={{ color: "#F5F0EB" }}
            >
              See It On
              <span
                className="italic"
                style={{ color: "var(--color-landing-accent)" }}
              >
                {" "}
                You
              </span>
              <br />
              Before You Buy
            </motion.h2>
            <motion.p
              custom={1}
              variants={fadeUp}
              className="text-lg lg:text-xl leading-relaxed mb-12 max-w-md"
              style={{ color: "rgba(245, 240, 235, 0.5)" }}
            >
              Build a personalized 3D avatar from your measurements.
              Visualize fit, proportion, and style before checkout.
            </motion.p>

            {/* Feature capsules */}
            <motion.div
              custom={2}
              variants={fadeUp}
              className="flex flex-wrap gap-3 mb-14"
            >
              {[
                "SMPL-X Body Model",
                "Real-time 3D",
                "AR Try-On",
              ].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full px-4 py-2 text-[11px] font-medium tracking-wide"
                  style={{
                    background: "rgba(196, 101, 74, 0.1)",
                    color: "rgba(196, 101, 74, 0.7)",
                    border: "1px solid rgba(196, 101, 74, 0.15)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </motion.div>

            <motion.div custom={3} variants={fadeUp}>
              <MagneticCTALink href="/profile/avatar">Try the full experience</MagneticCTALink>
            </motion.div>
          </motion.div>

          {/* Right: Interactive 3D Avatar Widget */}
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 32 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.9,
              ease: EASE_OUT_EXPO,
              delay: 0.15,
            }}
            className="flex justify-center"
            style={{ perspective: 900 }}
          >
            <motion.div
              ref={cardRef}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              style={
                reduce
                  ? { rotateX, rotateY }
                  : { rotateX, rotateY, y: springCardScrollY }
              }
              className="relative w-full max-w-[420px] h-[560px] rounded-3xl overflow-hidden"
            >
              {/* Multi-layer glass border */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none z-20"
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: [
                    "0 32px 80px rgba(0,0,0,0.5)",
                    "0 8px 32px rgba(0,0,0,0.3)",
                    "inset 0 1px 0 rgba(255,255,255,0.1)",
                    "inset 0 -1px 0 rgba(255,255,255,0.03)",
                  ].join(", "),
                }}
              />

              {/* Inner border refraction */}
              <div
                className="absolute inset-[1px] rounded-3xl pointer-events-none z-20"
                style={{
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              />

              {/* Dark gradient base behind canvas */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 30%, rgba(196,101,74,0.06), transparent 60%), linear-gradient(135deg, rgba(30,25,22,0.97), rgba(18,16,16,0.99))",
                }}
              />

              {/* Cursor-following glow */}
              <motion.div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  background: useTransform(
                    [glowX, glowY],
                    ([x, y]) =>
                      `radial-gradient(circle at ${x}% ${y}%, rgba(196,101,74,0.15), transparent 50%)`,
                  ),
                }}
              />

              {/* 3D Canvas */}
              <div className="absolute inset-0">
                {showRealAvatar ? (
                  <AvatarViewer avatarUrl={activeGlbUrl!} />
                ) : (
                  <TryOnViewer
                    bodyType={bodyType}
                    heightScale={heightScale}
                    weightScale={weightScale}
                    enableOrbit={step === "result"}
                    autoRotate
                    autoRotateSpeed={step === "generating" ? 4 : 1.5}
                  />
                )}

                {/* Loading overlay while initial SMPL-X model generates */}
                {initialLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                  >
                    <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl"
                      style={{
                        background: "rgba(0, 0, 0, 0.4)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-landing-accent/30 border-t-landing-accent" />
                      <span className="text-[10px] text-white/50 tracking-wide">
                        Building your preview...
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Updating overlay when regenerating with new params */}
                {isUpdating && showRealAvatar && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full z-10 pointer-events-none"
                    style={{
                      background: "rgba(0, 0, 0, 0.5)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-landing-accent/30 border-t-landing-accent" />
                    <span className="text-[10px] text-white/50">Updating...</span>
                  </motion.div>
                )}
              </div>

              {/* Gradient scrim for readability */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-700"
                style={{
                  background:
                    step === "result" && !showRealAvatar
                      ? "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 30%, transparent 50%)"
                      : "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 40%, transparent 60%)",
                }}
              />

              {/* Top-left highlight refraction */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 12% 0%, rgba(255,255,255,0.12), transparent 22%)",
                }}
              />

              {/* Header with mode toggle */}
              <div className="relative z-10 flex items-center gap-2.5 px-5 py-4">
                <PersonSimpleRun
                  size={16}
                  weight="duotone"
                  className="text-landing-accent/70"
                />
                <span className="text-xs font-semibold text-white/60 tracking-wide">
                  {showRealAvatar ? "Your 3D Avatar" : "3D Avatar Preview"}
                </span>

                {/* Mode toggle or Reset */}
                <div className="ml-auto flex items-center gap-2">
                  <ViewModeToggle
                    mode={viewMode}
                    onToggle={setViewMode}
                    hasAvatar={avatarReady}
                  />
                  {step === "result" && !showRealAvatar && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={handleReset}
                      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                    >
                      <ArrowsClockwise size={10} weight="bold" />
                      Reset
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Floating controls (bottom-anchored) */}
              <div className="absolute bottom-0 left-0 right-0 z-10">
                <AnimatePresence mode="wait">
                  {/* ── Real avatar with expandable controls ── */}
                  {showRealAvatar && (
                    <motion.div
                      key="avatar-controls"
                      initial={reduce ? false : { opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                      className="mx-3 mb-3 rounded-2xl px-4 py-3"
                      style={{
                        background: "rgba(0, 0, 0, 0.4)",
                        backdropFilter: "blur(24px) saturate(160%)",
                        WebkitBackdropFilter: "blur(24px) saturate(160%)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
                      }}
                    >
                      {/* Status bar + expand toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[11px] text-white/70 font-medium">
                            Model generation active
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button
                            type="button"
                            onClick={() => setControlsExpanded((v) => !v)}
                            whileTap={{ scale: 0.9 }}
                            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                          >
                            <Sliders size={11} weight="bold" />
                            Adjust
                            <motion.span
                              animate={{ rotate: controlsExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                              className="inline-flex"
                            >
                              <CaretDown size={9} weight="bold" />
                            </motion.span>
                          </motion.button>
                          <Link
                            href="/profile/avatar"
                            className="inline-flex items-center gap-1 text-[11px] text-landing-accent font-medium hover:brightness-110 transition-all"
                          >
                            Full editor
                            <ArrowRight size={11} weight="bold" />
                          </Link>
                        </div>
                      </div>

                      {/* Expandable input controls */}
                      <AnimatePresence>
                        {controlsExpanded && (
                          <motion.div
                            key="expanded-controls"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 mt-3 border-t border-white/[0.06]">
                              <AnimatePresence mode="wait">
                                {inputStep === 1 ? (
                                  <motion.div
                                    key="ctrl-step1"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.25 }}
                                    className="space-y-4"
                                  >
                                    <p className="text-[10px] text-white/40 tracking-wide">
                                      1 / 2 — Body Type & Size
                                    </p>
                                    <div>
                                      <p className="text-[11px] text-white/40 mb-2 font-medium tracking-wide">
                                        Body type
                                      </p>
                                      <BodyTypePicker
                                        selected={bodyType}
                                        onSelect={setBodyType}
                                      />
                                    </div>
                                    <CompactSlider
                                      label="Height"
                                      value={heightCm}
                                      min={HEIGHT_RANGE.min}
                                      max={HEIGHT_RANGE.max}
                                      unit="cm"
                                      onChange={setHeightCm}
                                    />
                                    <CompactSlider
                                      label="Weight"
                                      value={weightKg}
                                      min={WEIGHT_RANGE.min}
                                      max={WEIGHT_RANGE.max}
                                      unit="kg"
                                      onChange={setWeightKg}
                                    />
                                    <motion.button
                                      onClick={() => setInputStep(2)}
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.96 }}
                                      transition={CTA_SPRING}
                                      className="w-full py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                      style={{
                                        background: "var(--color-landing-accent)",
                                        color: "#1a1a1a",
                                      }}
                                    >
                                      Next: Body Measurements
                                    </motion.button>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="ctrl-step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.25 }}
                                    className="space-y-4"
                                  >
                                    <p className="text-[10px] text-white/40 tracking-wide">
                                      2 / 2 — Measurements
                                    </p>
                                    <CompactSlider
                                      label="Chest"
                                      value={chestCm}
                                      min={CHEST_RANGE.min}
                                      max={CHEST_RANGE.max}
                                      unit="cm"
                                      onChange={setChestCm}
                                    />
                                    <CompactSlider
                                      label="Waist"
                                      value={waistCm}
                                      min={WAIST_RANGE.min}
                                      max={WAIST_RANGE.max}
                                      unit="cm"
                                      onChange={setWaistCm}
                                    />
                                    <CompactSlider
                                      label="Hips"
                                      value={hipsCm}
                                      min={HIPS_RANGE.min}
                                      max={HIPS_RANGE.max}
                                      unit="cm"
                                      onChange={setHipsCm}
                                    />
                                    <CompactSlider
                                      label="Shoulder Width"
                                      value={shoulderWidthCm}
                                      min={SHOULDER_RANGE.min}
                                      max={SHOULDER_RANGE.max}
                                      unit="cm"
                                      onChange={setShoulderWidthCm}
                                    />
                                    <CompactSlider
                                      label="Inseam"
                                      value={inseamCm}
                                      min={INSEAM_RANGE.min}
                                      max={INSEAM_RANGE.max}
                                      unit="cm"
                                      onChange={setInseamCm}
                                    />
                                    {generateError && (
                                      <p className="text-[11px] text-red-400/90 text-center leading-snug">
                                        {generateError}
                                      </p>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setInputStep(1)}
                                        className="px-4 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer ring-1 ring-white/20 text-white/60 hover:text-white/80 hover:ring-white/30"
                                      >
                                        Back
                                      </button>
                                      <motion.button
                                        onClick={handleGenerate}
                                        disabled={isUpdating}
                                        whileHover={isUpdating ? {} : { scale: 1.02 }}
                                        whileTap={isUpdating ? {} : { scale: 0.96 }}
                                        transition={CTA_SPRING}
                                        className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{
                                          background: "var(--color-landing-accent)",
                                          color: "#1a1a1a",
                                        }}
                                      >
                                        {isUpdating ? "Updating..." : "Update Avatar"}
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Drag hint (when collapsed) */}
                      {!controlsExpanded && (
                        <div className="flex items-center gap-1.5 text-white/25 mt-2">
                          <CursorClick size={11} />
                          <span className="text-[10px]">
                            Drag to rotate, scroll to zoom
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── Input step ── */}
                  {!showRealAvatar && step === "input" && (
                    <motion.div
                      key="input"
                      initial={reduce ? false : { opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 30 }}
                      transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                      className="mx-3 mb-3 rounded-2xl px-4 py-4"
                      style={{
                        background: "rgba(0, 0, 0, 0.45)",
                        backdropFilter: "blur(24px) saturate(160%)",
                        WebkitBackdropFilter: "blur(24px) saturate(160%)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div className="space-y-4">
                        <AnimatePresence mode="wait">
                          {inputStep === 1 ? (
                            <motion.div
                              key="step1"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.25 }}
                              className="space-y-4"
                            >
                              <p className="text-[10px] text-white/40 tracking-wide">
                                1 / 2 — Body Type & Size
                              </p>
                              <div>
                                <p className="text-[11px] text-white/40 mb-2 font-medium tracking-wide">
                                  Body type
                                </p>
                                <BodyTypePicker
                                  selected={bodyType}
                                  onSelect={setBodyType}
                                />
                              </div>
                              <CompactSlider
                                label="Height"
                                value={heightCm}
                                min={HEIGHT_RANGE.min}
                                max={HEIGHT_RANGE.max}
                                unit="cm"
                                onChange={setHeightCm}
                              />
                              <CompactSlider
                                label="Weight"
                                value={weightKg}
                                min={WEIGHT_RANGE.min}
                                max={WEIGHT_RANGE.max}
                                unit="kg"
                                onChange={setWeightKg}
                              />
                              <motion.button
                                onClick={() => setInputStep(2)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.96 }}
                                transition={CTA_SPRING}
                                className="w-full py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                style={{
                                  background: "var(--color-landing-accent)",
                                  color: "#1a1a1a",
                                }}
                              >
                                Next: Body Measurements
                              </motion.button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="step2"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{ duration: 0.25 }}
                              className="space-y-4"
                            >
                              <p className="text-[10px] text-white/40 tracking-wide">
                                2 / 2 — Measurements
                              </p>
                              <CompactSlider
                                label="Chest"
                                value={chestCm}
                                min={CHEST_RANGE.min}
                                max={CHEST_RANGE.max}
                                unit="cm"
                                onChange={setChestCm}
                              />
                              <CompactSlider
                                label="Waist"
                                value={waistCm}
                                min={WAIST_RANGE.min}
                                max={WAIST_RANGE.max}
                                unit="cm"
                                onChange={setWaistCm}
                              />
                              <CompactSlider
                                label="Hips"
                                value={hipsCm}
                                min={HIPS_RANGE.min}
                                max={HIPS_RANGE.max}
                                unit="cm"
                                onChange={setHipsCm}
                              />
                              <CompactSlider
                                label="Shoulder Width"
                                value={shoulderWidthCm}
                                min={SHOULDER_RANGE.min}
                                max={SHOULDER_RANGE.max}
                                unit="cm"
                                onChange={setShoulderWidthCm}
                              />
                              <CompactSlider
                                label="Inseam"
                                value={inseamCm}
                                min={INSEAM_RANGE.min}
                                max={INSEAM_RANGE.max}
                                unit="cm"
                                onChange={setInseamCm}
                              />
                              {generateError && (
                                <p className="text-[11px] text-red-400/90 text-center leading-snug">
                                  {generateError}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setInputStep(1)}
                                  className="px-4 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer ring-1 ring-white/20 text-white/60 hover:text-white/80 hover:ring-white/30"
                                >
                                  Back
                                </button>
                                <motion.button
                                  onClick={handleGenerate}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.96 }}
                                  transition={CTA_SPRING}
                                  className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                  style={{
                                    background: "var(--color-landing-accent)",
                                    color: "#1a1a1a",
                                  }}
                                >
                                  {user ? "Generate My Avatar" : "Generate Avatar"}
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Generating step ── */}
                  {!showRealAvatar && step === "generating" && (
                    <motion.div
                      key="generating"
                      initial={reduce ? false : { opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                      className="mx-3 mb-3 rounded-2xl px-4 py-4"
                      style={{
                        background: "rgba(0, 0, 0, 0.4)",
                        backdropFilter: "blur(24px) saturate(160%)",
                        WebkitBackdropFilter: "blur(24px) saturate(160%)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="w-8 h-8 rounded-full border border-landing-accent/40 flex items-center justify-center flex-shrink-0"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          <PersonSimpleRun
                            size={14}
                            weight="duotone"
                            className="text-landing-accent/80"
                          />
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 font-medium">
                            {user && avatarGenerating
                              ? "Building your SMPL-X model"
                              : "Crafting your silhouette"}
                          </p>
                          <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <motion.div
                              className="h-full bg-landing-accent/50 rounded-full"
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{
                                duration: user && avatarGenerating ? 15 : 3,
                                ease: "easeInOut",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Result step (demo mode) ── */}
                  {!showRealAvatar && step === "result" && (
                    <motion.div
                      key="result"
                      initial={reduce ? false : { opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                      className="mx-3 mb-3 rounded-2xl px-4 py-3"
                      style={{
                        background: "rgba(0, 0, 0, 0.4)",
                        backdropFilter: "blur(24px) saturate(160%)",
                        WebkitBackdropFilter: "blur(24px) saturate(160%)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
                      }}
                    >
                      {/* Stats row */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="text-center">
                            <p className="text-[9px] text-white/30 uppercase tracking-wider">
                              Type
                            </p>
                            <p className="text-xs text-white/70 font-medium mt-0.5">
                              {typeLabel}
                            </p>
                          </div>
                          <div className="w-px h-5 bg-white/[0.08]" />
                          <div className="text-center">
                            <p className="text-[9px] text-white/30 uppercase tracking-wider">
                              Height
                            </p>
                            <p className="text-xs text-white/70 font-medium mt-0.5 tabular-nums">
                              {heightCm} cm
                            </p>
                          </div>
                          <div className="w-px h-5 bg-white/[0.08]" />
                          <div className="text-center">
                            <p className="text-[9px] text-white/30 uppercase tracking-wider">
                              Weight
                            </p>
                            <p className="text-xs text-white/70 font-medium mt-0.5 tabular-nums">
                              {weightKg} kg
                            </p>
                          </div>
                        </div>

                        {/* Ready badge */}
                        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-white/60 font-medium">
                            Ready
                          </span>
                        </div>
                      </div>

                      {/* Orbit hint + CTA */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-white/25">
                          <CursorClick size={12} />
                          <span className="text-[10px]">Drag to rotate</span>
                        </div>
                        <Link
                          href={user ? "/profile/avatar" : "/register"}
                          className="inline-flex items-center gap-1 text-[11px] text-landing-accent font-medium hover:brightness-110 transition-all"
                        >
                          {user ? "Open full editor" : "Sign up to save"}
                          <ArrowRight size={11} weight="bold" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
