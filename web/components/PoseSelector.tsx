"use client";

import { useRef, type KeyboardEvent } from "react";
import { Play, Repeat } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  POSE_CATEGORIES,
  POSE_PRESETS,
  type PoseDef,
} from "@/lib/pose-config";

function isAnimatedPose(pose: PoseDef): boolean {
  return (pose.duration ?? 0) > 0;
}

function AnimationIcon({ pose }: { pose: PoseDef }) {
  if (!isAnimatedPose(pose)) return null;
  const Icon = pose.loop ? Repeat : Play;
  return <Icon className="inline-block w-2 h-2 shrink-0" aria-hidden />;
}

interface PoseSelectorProps {
  activePoseId: string | null;
  onPoseSelect: (id: string) => void;
  disabled?: boolean;
}

export function PoseSelector({
  activePoseId,
  onPoseSelect,
  disabled,
}: PoseSelectorProps) {
  // Flattened pose order matching the rendered left-to-right sequence (categories in
  // POSE_CATEGORIES order, poses within each). Drives roving-tabindex + arrow-key nav.
  const flatPoses = POSE_CATEGORIES.flatMap((cat) =>
    POSE_PRESETS.filter((p) => p.category === cat.id)
  );
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // WAI-ARIA APG toolbar: exactly one button sits in the Tab order. Default it to the
  // active pose; fall back to the first when the active id isn't in the list.
  const activeIndex = flatPoses.findIndex((p) => p.id === activePoseId);
  const rovingIndex = activeIndex >= 0 ? activeIndex : 0;

  // ←/→ (and ↑/↓) move focus AND selection; Home/End jump to the ends. Clamped at both
  // ends — no wraparound — for predictable keyboard travel.
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = Math.min(index + 1, flatPoses.length - 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = Math.max(index - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = flatPoses.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next === index) return;
    onPoseSelect(flatPoses[next].id);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label="Pose presets"
      aria-orientation="horizontal"
      className={[
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-10",
        "bg-card/90 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-md",
        "max-w-[90vw]",
        disabled ? "opacity-50 pointer-events-none" : "",
      ]
        .join(" ")
        .trim()}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-1">
          {POSE_CATEGORIES.map((cat) => {
            const poses = POSE_PRESETS.filter((p) => p.category === cat.id);
            if (poses.length === 0) return null;
            return (
              <div key={cat.id} className="flex flex-col gap-1.5 shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
                  {cat.label}
                </span>
                <div className="flex gap-1.5">
                  {poses.map((pose: PoseDef) => {
                    const isActive = pose.id === activePoseId;
                    const flatIndex = flatPoses.findIndex((p) => p.id === pose.id);
                    return (
                      <button
                        key={pose.id}
                        ref={(el) => {
                          buttonRefs.current[flatIndex] = el;
                        }}
                        type="button"
                        onClick={() => onPoseSelect(pose.id)}
                        onKeyDown={(e) => handleKeyDown(e, flatIndex)}
                        disabled={disabled}
                        tabIndex={flatIndex === rovingIndex ? 0 : -1}
                        className={[
                          "min-h-10 min-w-16 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          "inline-flex items-center justify-center gap-1",
                          isActive
                            ? "bg-brand text-white"
                            : "bg-card border border-border text-foreground hover:border-primary/50",
                        ].join(" ")}
                        aria-pressed={isActive}
                      >
                        {pose.label}
                        <AnimationIcon pose={pose} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
