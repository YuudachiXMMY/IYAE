"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  imageUrl: string | null;
  selectedSize: string;
}

export interface DemoCartItem {
  id: number; // negative integer
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  selectedSize: string;
}

interface ServerCartItemDTO {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  currency: string;
  quantity: number;
  imageUrl: string | null;
  selectedSize: string;
}

interface ServerCartResponse {
  id: number;
  items: ServerCartItemDTO[];
}

function mapServerItem(dto: ServerCartItemDTO): CartItem {
  return {
    id: dto.id,
    productId: dto.productId,
    name: dto.productName,
    price: dto.productPrice,
    currency: dto.currency,
    quantity: dto.quantity,
    imageUrl: dto.imageUrl,
    selectedSize: dto.selectedSize ?? "ONE_SIZE",
  };
}

interface CartContextType {
  serverItems: CartItem[];
  demoItems: DemoCartItem[];
  totalCount: number;
  loading: boolean;
  addServerItem: (productId: number, quantity: number, selectedSize: string) => Promise<void>;
  addDemoItem: (item: Omit<DemoCartItem, "id">) => void;
  updateServerItem: (itemId: number, quantity: number) => Promise<void>;
  updateDemoItem: (itemId: number, quantity: number) => void;
  removeServerItem: (itemId: number) => Promise<void>;
  removeDemoItem: (itemId: number) => void;
  refreshCart: () => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEMO_STORAGE_KEY = "clossette_demo_cart_items";

/** Shared empty list, so a signed-out `serverItems` keeps a stable identity. */
const NO_SERVER_ITEMS: CartItem[] = [];

// ── Context ───────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | null>(null);

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadDemoItems(): DemoCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
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

function saveDemoItems(items: DemoCartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(items));
}

/**
 * One below the lowest id in use, so a new demo item cannot collide with one
 * already in the cart.
 *
 * Derived from the list rather than from the clock, which is what makes it
 * usable inside a state updater: the updater is re-invoked under StrictMode and
 * whenever a pending queue is replayed, and a `Date.now()` id changed on every
 * invocation. The previous `-Math.floor(Date.now() + Math.random() * 1000)`
 * could also collide outright — the random term spans a full second, so two
 * items added within a second of each other had a real chance of sharing an id,
 * and the id is both the React key and what `removeDemoItem` matches on.
 */
function nextDemoId(items: DemoCartItem[]): number {
  return items.reduce((lowest, item) => Math.min(lowest, item.id), 0) - 1;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [fetchedItems, setFetchedItems] = useState<CartItem[]>([]);
  const [fetchedForUserId, setFetchedForUserId] = useState<number | null>(null);
  const [demoItems, setDemoItems] = useState<DemoCartItem[]>(loadDemoItems);

  // Both derived from which user's cart has landed: signed out there is no
  // server cart, and until this user's fetch settles the items on hand belong
  // to nobody we can show them to. That keeps the fetch effect below free of
  // synchronous state resets.
  const serverItems =
    user && fetchedForUserId === user.id ? fetchedItems : NO_SERVER_ITEMS;
  const loading = !!user && fetchedForUserId !== user.id;

  const totalCount = serverItems.length + demoItems.length;

  // Demo items are persisted here, mirroring *committed* state, rather than
  // from inside the `setDemoItems` updaters below. An updater has to be pure:
  // React invokes it twice under StrictMode and re-invokes it whenever a
  // pending queue is replayed on a later render, so a localStorage write in
  // there fires more than once per change — and can fire for a render that is
  // then thrown away, persisting a cart the user never saw.
  //
  // The ref starts holding the mounted value, which came *from* storage, so the
  // first run writes nothing. Comparing identity rather than counting renders
  // also keeps StrictMode's double-invoked mount effect from writing.
  const persistedDemoItems = useRef(demoItems);
  useEffect(() => {
    if (persistedDemoItems.current === demoItems) return;
    persistedDemoItems.current = demoItems;
    saveDemoItems(demoItems);
  }, [demoItems]);

  // Fetch server cart when user logs in
  const refreshCart = useCallback((): Promise<void> => {
    if (!user) return Promise.resolve();
    const userId = user.id;
    return api
      .get<ServerCartResponse>("/api/cart")
      .then((res) => setFetchedItems(res.items.map(mapServerItem)))
      // A 404 means no cart row yet; anything else is handled silently — the
      // cart badge degrades gracefully. Either way the list is emptied rather
      // than left holding items fetched for whoever was signed in before.
      .catch(() => setFetchedItems([]))
      // Settles `loading`, whichever way the request went.
      .finally(() => setFetchedForUserId(userId));
  }, [user]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  // ── Server item operations ─────────────────────────────────────────────────

  const addServerItem = useCallback(
    async (productId: number, quantity: number, selectedSize: string) => {
      const res = await api.post<ServerCartResponse>("/api/cart/items", {
        productId,
        quantity,
        selectedSize,
      });
      setFetchedItems(res.items.map(mapServerItem));
    },
    [],
  );

  const updateServerItem = useCallback(
    async (itemId: number, quantity: number) => {
      if (quantity <= 0) {
        const res = await api.delete<ServerCartResponse>(
          `/api/cart/items/${itemId}`,
        );
        setFetchedItems(res.items.map(mapServerItem));
        return;
      }
      const res = await api.put<ServerCartResponse>(
        `/api/cart/items/${itemId}`,
        { quantity },
      );
      setFetchedItems(res.items.map(mapServerItem));
    },
    [],
  );

  const removeServerItem = useCallback(async (itemId: number) => {
    const res = await api.delete<ServerCartResponse>(
      `/api/cart/items/${itemId}`,
    );
    setFetchedItems(res.items.map(mapServerItem));
  }, []);

  // ── Demo item operations ───────────────────────────────────────────────────

  // All three updaters are pure: they read `prev`, build the next list and
  // return it. Persistence is the effect above.

  const addDemoItem = useCallback((item: Omit<DemoCartItem, "id">) => {
    setDemoItems((prev) => {
      const existing = prev.find(
        (i) => i.name === item.name && i.selectedSize === item.selectedSize,
      );
      return existing
        ? prev.map((i) =>
            i.name === item.name && i.selectedSize === item.selectedSize
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          )
        : [...prev, { ...item, id: nextDemoId(prev) }];
    });
  }, []);

  const updateDemoItem = useCallback((itemId: number, quantity: number) => {
    setDemoItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.id !== itemId)
        : prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
    );
  }, []);

  const removeDemoItem = useCallback((itemId: number) => {
    setDemoItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  return (
    <CartContext.Provider
      value={{
        serverItems,
        demoItems,
        totalCount,
        loading,
        addServerItem,
        addDemoItem,
        updateServerItem,
        updateDemoItem,
        removeServerItem,
        removeDemoItem,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
