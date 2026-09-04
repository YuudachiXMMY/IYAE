"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface OutfitDetailsFormProps {
  occasion: string;
  note: string;
  onOccasionChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}

export function OutfitDetailsForm({
  occasion,
  note,
  onOccasionChange,
  onNoteChange,
}: OutfitDetailsFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-semibold text-foreground">
        Details
      </h3>

      <div>
        <label
          htmlFor="outfit-occasion"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Occasion
          <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="outfit-occasion"
          placeholder="e.g. Weekend brunch, Date night…"
          value={occasion}
          onChange={(e) => onOccasionChange(e.target.value)}
          maxLength={80}
        />
      </div>

      <div>
        <label
          htmlFor="outfit-note"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Note
          <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="outfit-note"
          placeholder="Any notes about this outfit…"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={300}
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}
