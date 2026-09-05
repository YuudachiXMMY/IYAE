"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useCart, type CartItem, type DemoCartItem } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

function formatPrice(price: number, currency?: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(price);
}

// ── Placeholder image ─────────────────────────────────────────────────────────

function ImagePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        aria-label="No image"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    </div>
  );
}

// ── Remove icon ───────────────────────────────────────────────────────────────

function RemoveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

// ── Server cart item row ──────────────────────────────────────────────────────

function ServerItemRow({ item }: { item: CartItem }) {
  const { updateServerItem, removeServerItem } = useCart();
  const [busy, setBusy] = useState(false);

  async function handleQuantity(delta: number) {
    setBusy(true);
    try {
      const next = item.quantity + delta;
      if (next <= 0) {
        await removeServerItem(item.id);
      } else {
        await updateServerItem(item.id, next);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await removeServerItem(item.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-card bg-card p-4 shadow-soft">
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} fill sizes="80px" className="object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
        {item.selectedSize && item.selectedSize !== "ONE_SIZE" && (
          <p className="text-xs text-muted-foreground">Size: {item.selectedSize}</p>
        )}
        <p className="text-sm font-semibold text-foreground">
          {formatPrice(item.price, item.currency)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleQuantity(-1)}
          disabled={busy}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-border/60 disabled:opacity-40"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
        <button
          onClick={() => handleQuantity(1)}
          disabled={busy}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-border/60 disabled:opacity-40"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <p className="w-20 text-right text-sm font-semibold text-foreground">
        {formatPrice(item.price * item.quantity, item.currency)}
      </p>

      <button
        onClick={handleRemove}
        disabled={busy}
        className="ml-2 text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-40"
        aria-label="Remove item"
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

// ── Demo cart item row ────────────────────────────────────────────────────────

function DemoItemRow({ item }: { item: DemoCartItem }) {
  const { updateDemoItem, removeDemoItem } = useCart();

  return (
    <div className="flex items-center gap-4 rounded-card bg-card p-4 shadow-soft border border-dashed border-brand/30">
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} fill sizes="80px" className="object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
        {item.selectedSize && item.selectedSize !== "ONE_SIZE" && (
          <p className="text-xs text-muted-foreground">Size: {item.selectedSize}</p>
        )}
        <p className="text-sm font-semibold text-foreground">{formatPrice(item.price)}</p>
        <span className="w-fit rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">
          AI recommendation
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => updateDemoItem(item.id, item.quantity - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-border/60"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
        <button
          onClick={() => updateDemoItem(item.id, item.quantity + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-border/60"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <p className="w-20 text-right text-sm font-semibold text-foreground">
        {formatPrice(item.price * item.quantity)}
      </p>

      <button
        onClick={() => removeDemoItem(item.id)}
        className="ml-2 text-muted-foreground/40 hover:text-destructive transition-colors"
        aria-label="Remove item"
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

// ── Cart page ─────────────────────────────────────────────────────────────────

export default function CartPage() {
  const router = useRouter();
  const { serverItems, demoItems, totalCount, loading } = useCart();
  const { user } = useAuth();

  const serverTotal = serverItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const demoTotal = demoItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const grandTotal = serverTotal + demoTotal;
  const isEmpty = totalCount === 0 && !loading;

  return (
    <>
      <NavBar />
      <PageShell>
        <h1 className="mb-8 font-display text-4xl font-semibold text-foreground">
          Your Cart
        </h1>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-card bg-muted" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">Your cart is empty.</p>
            <Link href="/products">
              <Button className="mt-6 rounded-full bg-brand px-8 text-primary-foreground hover:bg-brand-hover">
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Item list */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              {serverItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  {user && (
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Saved items
                    </p>
                  )}
                  {serverItems.map((item) => (
                    <ServerItemRow key={item.id} item={item} />
                  ))}
                </div>
              )}

              {demoItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    AI recommendations
                  </p>
                  {demoItems.map((item) => (
                    <DemoItemRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>

            {/* Order summary */}
            <div className="h-fit rounded-card bg-card p-6 shadow-soft lg:sticky lg:top-24">
              <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
                Order Summary
              </h2>

              <div className="flex flex-col gap-2 text-sm">
                {serverItems.length > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items ({serverItems.length})</span>
                    <span>{formatPrice(serverTotal)}</span>
                  </div>
                )}
                {demoItems.length > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>AI picks ({demoItems.length})</span>
                    <span>{formatPrice(demoTotal)}</span>
                  </div>
                )}
                <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(grandTotal)}</span>
                </div>
              </div>

              <Button
                className="mt-6 w-full rounded-full bg-brand py-3 text-primary-foreground hover:bg-brand-hover"
                disabled={totalCount === 0}
                onClick={() => router.push("/checkout")}
              >
                Checkout
              </Button>

              {!user && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  <Link href="/login" className="text-brand hover:underline">
                    Sign in
                  </Link>{" "}
                  to save your cart across devices.
                </p>
              )}
            </div>
          </div>
        )}
      </PageShell>
    </>
  );
}
