"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, promotions, type PromotionResponse, type CreatePromotionRequest, type UpdatePromotionRequest } from "@/lib/api";

interface ProductOption {
  id: number;
  name: string;
}

interface PromotionFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (promotion: PromotionResponse) => void;
  editing?: PromotionResponse | null;
}

function toDateInputValue(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function PromotionForm({ open, onClose, onSaved, editing }: PromotionFormProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-card bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-foreground">
            {editing ? "Edit Promotion" : "New Promotion"}
          </DialogTitle>
        </DialogHeader>

        {/* The fields seed themselves from `editing` on mount, so the dialog body
            is remounted per open (and per promotion) instead of an effect
            overwriting whatever the designer has already typed. */}
        <PromotionFields
          key={`${open}-${editing?.id ?? "new"}`}
          editing={editing ?? null}
          onClose={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function PromotionFields({
  editing,
  onClose,
  onSaved,
}: {
  editing: PromotionResponse | null;
  onClose: () => void;
  onSaved: (promotion: PromotionResponse) => void;
}) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState(editing ? String(editing.productId) : "");
  const [slotType, setSlotType] = useState<"FEATURED" | "SPONSORED">(
    editing?.slotType ?? "FEATURED"
  );
  const [weight, setWeight] = useState(editing ? String(editing.weight) : "1");
  const [startAt, setStartAt] = useState(editing ? toDateInputValue(editing.startAt) : "");
  const [endAt, setEndAt] = useState(editing ? toDateInputValue(editing.endAt) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load designer's products for the select
  useEffect(() => {
    const controller = new AbortController();
    api.get<{ id: number; name: string }[]>("/api/designer/products", { signal: controller.signal })
      .then((data) => setProducts(data))
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedProductId = parseInt(productId, 10);
    const parsedWeight = parseInt(weight, 10);
    if (!productId || isNaN(parsedProductId)) {
      setError("Please select a product.");
      return;
    }
    if (isNaN(parsedWeight) || parsedWeight < 1) {
      setError("Weight must be a positive integer.");
      return;
    }
    if (!startAt || !endAt) {
      setError("Please set both start and end dates.");
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError("End date must be after start date.");
      return;
    }

    setSubmitting(true);
    try {
      let result: PromotionResponse;
      if (editing) {
        const payload: UpdatePromotionRequest = {
          slotType,
          weight: parsedWeight,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        };
        result = await promotions.update(editing.id, payload);
      } else {
        const payload: CreatePromotionRequest = {
          productId: parsedProductId,
          slotType,
          weight: parsedWeight,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        };
        result = await promotions.create(payload);
      }
      onSaved(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save promotion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Product */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-product">Product</Label>
        <Select value={productId} onValueChange={setProductId} disabled={!!editing || submitting}>
          <SelectTrigger id="pf-product">
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Slot type */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-slot">Slot Type</Label>
        <Select value={slotType} onValueChange={(v) => setSlotType(v as "FEATURED" | "SPONSORED")} disabled={submitting}>
          <SelectTrigger id="pf-slot">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FEATURED">Featured</SelectItem>
            <SelectItem value="SPONSORED">Sponsored</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Weight */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-weight">Weight</Label>
        <Input
          id="pf-weight"
          type="number"
          min="1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          disabled={submitting}
        />
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pf-start">Start Date</Label>
          <Input
            id="pf-start"
            type="date"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-end">End Date</Label>
          <Input
            id="pf-end"
            type="date"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="rounded-full border-border text-xs">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover text-xs">
          {submitting ? "Saving..." : editing ? "Save Changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}
