const STORAGE_KEY = "clossette_demo_looks";

function generateDemoId(): number {
  const existing = getDemoLooks();
  const min = existing.reduce((acc, l) => Math.min(acc, l.id), 0);
  return min - 1;
}

export function isDemoOutfitId(id: number | string): boolean {
  const n = typeof id === "number" ? id : parseInt(id as string, 10);
  return !isNaN(n) && n < 0;
}

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

function saveDemoLooksToStorage(looks: DemoLook[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(looks));
}

export function saveDemoLook(outfitData: unknown, note = ""): DemoLook {
  const look: DemoLook = {
    id: generateDemoId(),
    outfitData,
    note,
    savedAt: new Date().toISOString(),
  };
  const existing = getDemoLooks();
  saveDemoLooksToStorage([look, ...existing]);
  return look;
}

export function removeDemoLook(id: number): void {
  const updated = getDemoLooks().filter((l) => l.id !== id);
  saveDemoLooksToStorage(updated);
}

export function clearDemoLooks(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
