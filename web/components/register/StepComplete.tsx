"use client";

import { Button } from "@/components/ui/button";
import type { RegisterRequest } from "@/lib/api";

interface StepCompleteProps {
  data: Partial<RegisterRequest>;
  onSubmit: () => void;
  onBack?: () => void;
  isLoading: boolean;
  error: string;
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export function StepComplete({ data, onSubmit, onBack, isLoading, error }: StepCompleteProps) {
  const styleCount = (data.styleAesthetics ?? []).length;
  const colorCount = (data.favoriteColors ?? []).length;
  const avoidedCount = (data.avoidedColors ?? []).length;
  const hasMeasurements = !!(data.heightCm || data.chestCm || data.topSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">Almost there</h2>
        <p className="text-sm text-muted-foreground mt-1">Review your profile and create your account</p>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-1">
        <SummaryRow label="Email" value={data.email ?? null} />
        <SummaryRow label="Name" value={data.name ?? null} />
        <SummaryRow label="Username" value={data.username ? `@${data.username}` : null} />
        <SummaryRow label="Role" value={data.role === "DESIGNER" ? "Designer" : "Shopper"} />
        <SummaryRow
          label="Style Aesthetics"
          value={styleCount > 0 ? `${styleCount} selected` : null}
        />
        <SummaryRow
          label="Favorite Colors"
          value={colorCount > 0 ? `${colorCount} ${colorCount === 1 ? "color" : "colors"}` : null}
        />
        <SummaryRow
          label="Colors I Avoid"
          value={avoidedCount > 0 ? (data.avoidedColors ?? []).join(", ") : null}
        />
        <SummaryRow label="Budget" value={data.budgetRange ?? null} />
        <SummaryRow label="Measurements" value={hasMeasurements ? "Added" : null} />
        <SummaryRow
          label="Avatar"
          value={
            data.avatarMode === "AI_AVATAR"
              ? "AI Avatar"
              : data.avatarMode === "PROFILE_PHOTO"
              ? "Profile Photo"
              : null
          }
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {onBack && (
          <Button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            variant="outline"
            className="flex-1 rounded-full py-3 text-base"
          >
            Back
          </Button>
        )}
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className={`rounded-full bg-brand hover:bg-brand-hover text-primary-foreground py-3 text-base ${onBack ? "flex-1" : "w-full"}`}
        >
          {isLoading ? "Creating your account..." : "Create Account"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can update all preferences anytime from your profile settings.
      </p>
    </div>
  );
}
