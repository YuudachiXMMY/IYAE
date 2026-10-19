/**
 * The demo cart's storage, in one place.
 *
 * Demo items are device-level: negative ids, no server row, added while browsing
 * so an unauthenticated visitor can see a cart at all. `CartProvider` owns the
 * live list; this module owns where it is kept.
 *
 * It is its own module because both `cart-context` and `auth-context` need the
 * key — `logout()` clears the stored copy, `CartProvider` clears the one on
 * screen — and `cart-context` already imports `auth-context`, so the key cannot
 * live in either without a cycle. It used to be a string literal written out
 * twice, which is how the two halves of the clear drifted apart.
 */

export interface DemoCartItem {
  id: number; // negative integer
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  selectedSize: string;
}

const DEMO_CART_STORAGE_KEY = "clossette_demo_cart_items";

export function loadDemoCartItems(): DemoCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<DemoCartItem> & { id: number }>;
    return parsed.map((item) => ({
      ...item,
      selectedSize: item.selectedSize ?? "ONE_SIZE",
    })) as DemoCartItem[];
  } catch {
    return [];
  }
}

export function saveDemoCartItems(items: DemoCartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_CART_STORAGE_KEY, JSON.stringify(items));
}

export function clearDemoCartItems(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEMO_CART_STORAGE_KEY);
}
