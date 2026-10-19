const STORAGE_KEY = "clossette_demo_looks";

export interface DemoLook {
  id: number;           // negative integer
  outfitData: unknown;  // outfit recommendation data
  note: string;
  savedAt: string;      // ISO timestamp
}

export function getDemoLooks(): DemoLook[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DemoLook[];
  } catch {
    return [];
  }
}

export function removeDemoLook(id: number): void {
  if (typeof window === "undefined") return;
  const updated = getDemoLooks().filter((l) => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
