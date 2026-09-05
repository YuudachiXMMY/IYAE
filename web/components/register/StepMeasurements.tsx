"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegisterRequest } from "@/lib/api";

interface StepMeasurementsProps {
  data: Partial<RegisterRequest>;
  onChange: (updates: Partial<RegisterRequest>) => void;
}

function NumberField({
  id,
  label,
  unit,
  value,
  onValue,
}: {
  id: string;
  label: string;
  unit: string;
  value: number | undefined;
  onValue: (v: number | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label} <span className="text-muted-foreground font-normal text-xs">({unit})</span>
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        placeholder="—"
        value={value ?? ""}
        onChange={(e) => onValue(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </div>
  );
}

function TextField({
  id,
  label,
  placeholder,
  value,
  onValue,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string | undefined;
  onValue: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Input
        id={id}
        type="text"
        placeholder={placeholder ?? "—"}
        value={value ?? ""}
        onChange={(e) => onValue(e.target.value)}
      />
    </div>
  );
}

const BODY_TYPE_OPTIONS = [
  { id: "female", label: "Female", icon: "♀" },
  { id: "male", label: "Male", icon: "♂" },
  { id: "neutral", label: "Neutral", icon: "⚧" },
] as const;

export function StepMeasurements({ data, onChange }: StepMeasurementsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">Body measurements</h2>
        <p className="text-sm text-muted-foreground mt-1">All measurements are optional — helps us fit recommendations better</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Body type for your avatar</h3>
        <p className="text-xs text-muted-foreground">Determines which body model is used for avatar generation</p>
        <div className="grid grid-cols-3 gap-3">
          {BODY_TYPE_OPTIONS.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onChange({ genderIdentity: type.id })}
              className={[
                "rounded-2xl border-2 p-4 text-center transition-all duration-150",
                data.genderIdentity === type.id
                  ? "border-brand bg-brand/10"
                  : "border-border bg-card hover:border-brand/40",
              ].join(" ")}
            >
              <div className="text-2xl mb-1">{type.icon}</div>
              <div className="font-medium text-sm text-foreground">{type.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Body Dimensions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <NumberField id="heightCm" label="Height" unit="cm" value={data.heightCm} onValue={(v) => onChange({ heightCm: v })} />
          <NumberField id="weightKg" label="Weight" unit="kg" value={data.weightKg} onValue={(v) => onChange({ weightKg: v })} />
          <NumberField id="chestCm" label="Chest" unit="cm" value={data.chestCm} onValue={(v) => onChange({ chestCm: v })} />
          <NumberField id="waistCm" label="Waist" unit="cm" value={data.waistCm} onValue={(v) => onChange({ waistCm: v })} />
          <NumberField id="hipsCm" label="Hips" unit="cm" value={data.hipsCm} onValue={(v) => onChange({ hipsCm: v })} />
          <NumberField id="shoulderWidthCm" label="Shoulder Width" unit="cm" value={data.shoulderWidthCm} onValue={(v) => onChange({ shoulderWidthCm: v })} />
          <NumberField id="inseamCm" label="Inseam" unit="cm" value={data.inseamCm} onValue={(v) => onChange({ inseamCm: v })} />
        </div>
      </div>

      <div className="border-t border-border pt-5 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Clothing Sizes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <TextField id="topSize" label="Top Size" placeholder="e.g. M, L, XL" value={data.topSize} onValue={(v) => onChange({ topSize: v })} />
          <TextField id="bottomSize" label="Bottom Size" placeholder="e.g. 28, M" value={data.bottomSize} onValue={(v) => onChange({ bottomSize: v })} />
          <TextField id="dressSize" label="Dress Size" placeholder="e.g. 8, M" value={data.dressSize} onValue={(v) => onChange({ dressSize: v })} />
          <TextField id="jacketSize" label="Jacket Size" placeholder="e.g. 40R, L" value={data.jacketSize} onValue={(v) => onChange({ jacketSize: v })} />
          <TextField id="shoeSize" label="Shoe Size" placeholder="e.g. 8, 42" value={data.shoeSize} onValue={(v) => onChange({ shoeSize: v })} />
        </div>
      </div>
    </div>
  );
}
