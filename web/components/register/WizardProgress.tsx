"use client";

const STEP_LABELS = ["Basics", "Style", "Colors", "Body", "Avatar", "Complete"];

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function WizardProgress({ currentStep, totalSteps }: WizardProgressProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-border z-0" />
        <div
          className="absolute left-0 top-4 h-0.5 bg-brand z-0 transition-all duration-300"
          style={{ width: `${(currentStep / (totalSteps - 1)) * 100}%` }}
        />
        {STEP_LABELS.slice(0, totalSteps).map((label, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <div key={label} className="flex flex-col items-center z-10">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all duration-200",
                  isDone
                    ? "bg-brand border-brand text-primary-foreground"
                    : isCurrent
                    ? "bg-card border-brand text-brand"
                    : "bg-card border-border text-muted-foreground",
                ].join(" ")}
              >
                {isDone ? "✓" : index + 1}
              </div>
              <span
                className={[
                  "mt-1.5 text-xs hidden sm:block",
                  isCurrent ? "text-brand font-medium" : isDone ? "text-muted-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
