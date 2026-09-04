import { type SelectableProduct } from "@/components/outfits/ProductSelectCard";

export const SLOTS = ["top", "bottom", "shoes", "accessory"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<Slot, string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

export const SLOT_CATEGORY_HINTS: Record<Slot, string> = {
  top: "top",
  bottom: "bottom",
  shoes: "shoes",
  accessory: "accessory",
};

export type SlotMap = Record<Slot, SelectableProduct | null>;

export const EMPTY_SLOTS: SlotMap = {
  top: null,
  bottom: null,
  shoes: null,
  accessory: null,
};
