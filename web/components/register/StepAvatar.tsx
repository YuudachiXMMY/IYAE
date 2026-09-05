"use client";

import type { RegisterRequest } from "@/lib/api";

interface StepAvatarProps {
  data: Partial<RegisterRequest>;
  onChange: (updates: Partial<RegisterRequest>) => void;
}

const AVATAR_PRESETS = [
  { id: "preset_minimal", label: "Minimal", description: "Clean, geometric style" },
  { id: "preset_artistic", label: "Artistic", description: "Expressive & creative" },
  { id: "preset_classic", label: "Classic", description: "Timeless elegance" },
  { id: "preset_playful", label: "Playful", description: "Fun & colorful" },
  { id: "preset_editorial", label: "Editorial", description: "High-fashion look" },
  { id: "preset_sporty", label: "Sporty", description: "Active & dynamic" },
];

export function StepAvatar({ data, onChange }: StepAvatarProps) {
  const mode = data.avatarMode ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">Your avatar</h2>
        <p className="text-sm text-muted-foreground mt-1">How would you like to appear on IYAE?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onChange({ avatarMode: "AI_AVATAR" })}
          className={[
            "rounded-2xl border-2 p-6 text-left transition-all duration-150",
            mode === "AI_AVATAR"
              ? "border-purple-600 bg-purple-50"
              : "border-border bg-card hover:border-purple-300",
          ].join(" ")}
        >
          <div className="text-3xl mb-3">✨</div>
          <div className="font-medium text-foreground">AI Avatar</div>
          <div className="text-xs text-muted-foreground mt-1">Generate a unique AI-powered avatar based on your style</div>
        </button>

        <button
          type="button"
          onClick={() => onChange({ avatarMode: "PROFILE_PHOTO", avatarPreset: undefined })}
          className={[
            "rounded-2xl border-2 p-6 text-left transition-all duration-150",
            mode === "PROFILE_PHOTO"
              ? "border-purple-600 bg-purple-50"
              : "border-border bg-card hover:border-purple-300",
          ].join(" ")}
        >
          <div className="text-3xl mb-3">📷</div>
          <div className="font-medium text-foreground">Profile Photo</div>
          <div className="text-xs text-muted-foreground mt-1">Upload your own photo later from profile settings</div>
        </button>
      </div>

      {mode === "AI_AVATAR" && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Choose a preset style</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ avatarPreset: preset.id })}
                className={[
                  "rounded-xl border-2 p-3 text-left transition-all duration-150",
                  data.avatarPreset === preset.id
                    ? "border-purple-600 bg-purple-50"
                    : "border-border bg-card hover:border-purple-300",
                ].join(" ")}
              >
                <div className="font-medium text-sm text-foreground">{preset.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
