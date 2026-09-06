import { type SelectableProduct } from "@/components/outfits/ProductSelectCard";
import { type SlotName } from "@/lib/api";

// One canonical slot union lives in `@/lib/api` (`SlotName`, mirroring the server
// contract). `SLOTS` is the runtime companion; `satisfies` keeps the two in lockstep
// so adding a slot in one place without the other is a compile error.
export const SLOTS = ["top", "bottom", "shoes", "accessory"] as const satisfies readonly SlotName[];
export type Slot = SlotName;

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
