"use client";

/**
 * Display groups map the underlying 6 wizard steps onto the 3 labels shown in
 * the Figma stepper header:
 *   01 ACCOUNT          -> step 0 (Basics)
 *   02 STYLE PROFILE    -> steps 1-2 (Style, Colors)
 *   03 MEASUREMENTS     -> steps 3-5 (Measurements, Avatar, Complete)
 */
const DISPLAY_GROUPS = [
  { num: "01", label: "ACCOUNT" },
  { num: "02", label: "STYLE PROFILE" },
  { num: "03", label: "MEASUREMENTS" },
] as const;

function activeGroup(currentStep: number): number {
  if (currentStep <= 0) return 0;
  if (currentStep <= 2) return 1;
  return 2;
}

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const active = activeGroup(currentStep);

  return (
    <div className="mb-10 w-full">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {DISPLAY_GROUPS.map((group, index) => {
          const isActive = index === active;
          return (
            <div key={group.num} className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={[
                    "font-display text-[18px] leading-none",
                    isActive ? "text-brand" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {group.num}
                </span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="h-px w-8 bg-brand"
                  />
                )}
                <span
                  className={[
                    "font-body text-[11px] uppercase tracking-[0.12px]",
                    isActive
                      ? "font-semibold text-brand"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {group.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
