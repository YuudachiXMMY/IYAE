"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { resale, ApiError, type ResaleEligibleItem, type ResaleCondition } from "@/lib/api";

const CONDITIONS: { value: ResaleCondition; label: string }[] = [
  { value: "NEW_WITH_TAGS", label: "New with tags" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
];

export function ResaleListingForm({
  item,
  onCreated,
}: {
  item: ResaleEligibleItem;
  onCreated: () => void;
}) {
  const [condition, setCondition] = useState<ResaleCondition>("EXCELLENT");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const asking = Number(price);
    if (!asking || asking < 0.01) {
      toast.error("Enter a valid asking price.");
      return;
    }
    setSubmitting(true);
    try {
      await resale.create({
        productId: item.productId,
        sizeLabel: item.sizeLabel,
        condition,
        askingPrice: asking,
        sellerNote: note || undefined,
      });
      toast.success("Listed! Your pre-loved piece is now live.");
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create listing.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card bg-card p-5 shadow-soft">
      <div>
        <p className="text-sm font-semibold text-foreground">{item.productName}</p>
        <p className="text-xs text-muted-foreground">Size {item.sizeLabel}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resale-condition">Condition</Label>
        <select
          id="resale-condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ResaleCondition)}
          className="h-10 rounded-button border border-border bg-background px-3 text-sm text-foreground"
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resale-price">Asking price (CAD)</Label>
        <Input
          id="resale-price"
          type="number"
          min="0.01"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="32.00"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resale-note">Note (optional)</Label>
        <Textarea
          id="resale-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="Worn twice, no flaws…"
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
      >
        {submitting ? "Listing…" : "List it"}
      </Button>
    </form>
  );
}
