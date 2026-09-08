"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  api,
  ApiError,
  type AvatarResponse,
  type OutfitDetail,
  type ManualOutfitRequest,
} from "@/lib/api";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import {
  SLOTS,
  type Slot,
  SLOT_LABELS,
  SLOT_CATEGORY_HINTS,
  type SlotMap,
  EMPTY_SLOTS,
} from "@/lib/outfit-slots";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OutfitBuilderPreview } from "@/components/outfits/OutfitBuilderPreview";
import { OutfitSlotSidebarItem } from "@/components/outfits/OutfitSlotSidebarItem";
import { OutfitDetailsForm } from "@/components/outfits/OutfitDetailsForm";
import { ProductPickerDialog } from "@/components/outfits/ProductPickerDialog";
import { type SelectableProduct } from "@/components/outfits/ProductSelectCard";

export default function NewOutfitPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();

  const [slots, setSlots] = useState<SlotMap>({ ...EMPTY_SLOTS });
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [occasion, setOccasion] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    api
      .get<AvatarResponse>("/api/avatar")
      .then((res) => setAvatarUrl(res.avatarUrl))
      .catch(() => setAvatarUrl(null));
  }, [authLoading, user]);

  const excludeProductIds = SLOTS.flatMap((s) => (slots[s] ? [slots[s]!.id] : []));
  const hasAtLeastOneSlot = SLOTS.some((s) => slots[s] !== null);
  const filledCount = SLOTS.filter((s) => slots[s] !== null).length;
  const activeSlotLabel = activeSlot ? SLOT_LABELS[activeSlot as Slot] : undefined;
  const activeSlotCategory = activeSlot ? SLOT_CATEGORY_HINTS[activeSlot as Slot] : "";

  const handleSelect = (product: SelectableProduct) => {
    if (!activeSlot) return;
    setSlots((prev) => ({ ...prev, [activeSlot]: product }));
    setActiveSlot(null);
  };

  const handleRemove = (slot: Slot) => {
    setSlots((prev) => ({ ...prev, [slot]: null }));
  };

  const handleSave = async () => {
    if (!hasAtLeastOneSlot || saving) return;
    setSaving(true);

    const slotsRecord: Record<string, number> = {};
    for (const s of SLOTS) {
      if (slots[s] !== null) {
        slotsRecord[s] = slots[s]!.id;
      }
    }

    const payload: ManualOutfitRequest = {
      slots: slotsRecord,
      ...(occasion.trim() ? { occasion: occasion.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };

    try {
      const result = await api.post<OutfitDetail>("/api/outfits/manual", payload);
      toast.success("Outfit saved!");
      router.push(`/outfits/${result.id}/view`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save outfit");
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:pb-8">
        {/* Back link */}
        <Link
          href="/outfits"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All Outfits
        </Link>

        {/* Main layout */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left: Preview */}
          <div className="flex-1 lg:sticky lg:top-24 lg:self-start">
            <OutfitBuilderPreview slots={slots} avatarUrl={avatarUrl ?? undefined} />
          </div>

          {/* Right: Sidebar */}
          <aside className="w-full lg:w-96 flex flex-col gap-6">
            {/* Header */}
            <div>
              <h1 className="font-display text-3xl font-semibold text-foreground">
                Build Your Look
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {filledCount} of {SLOTS.length} pieces selected
              </p>
            </div>

            {/* Slot list */}
            <div className="flex flex-col gap-3">
              {SLOTS.map((slot) => (
                <OutfitSlotSidebarItem
                  key={slot}
                  slot={slot}
                  label={SLOT_LABELS[slot]}
                  product={slots[slot] ?? undefined}
                  onAdd={() => setActiveSlot(slot)}
                  onRemove={() => handleRemove(slot)}
                />
              ))}
            </div>

            {/* Details form */}
            <OutfitDetailsForm
              occasion={occasion}
              note={note}
              onOccasionChange={setOccasion}
              onNoteChange={setNote}
            />

            {/* Actions (desktop) */}
            <div className="hidden lg:flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-full border-border"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
                onClick={handleSave}
                disabled={!hasAtLeastOneSlot || saving}
              >
                {saving ? "Saving…" : "Save Outfit"}
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card p-4 lg:hidden">
        <div className="flex gap-3 max-w-7xl mx-auto">
          <Button
            variant="outline"
            className="flex-1 rounded-full border-border"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
            onClick={handleSave}
            disabled={!hasAtLeastOneSlot || saving}
          >
            {saving ? "Saving…" : "Save Outfit"}
          </Button>
        </div>
      </div>

      {/* Product picker dialog */}
      <ProductPickerDialog
        open={activeSlot !== null}
        onClose={() => setActiveSlot(null)}
        onSelect={handleSelect}
        excludeProductIds={excludeProductIds}
        slotLabel={activeSlotLabel}
        initialCategory={activeSlotCategory}
      />
    </>
  );
}
