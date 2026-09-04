"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useCart } from "@/lib/cart-context";
import { api, ApiError } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckoutResponse {
  sessionId: string;
  url: string;
}

// ── Format helper ─────────────────────────────────────────────────────────────

function formatPrice(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const {
    serverItems,
    demoItems,
    totalCount,
    loading: cartLoading,
  } = useCart();
  const router = useRouter();

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverTotal = serverItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const demoTotal = demoItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const grandTotal = serverTotal + demoTotal;
  const isEmpty = totalCount === 0 && !cartLoading;

  async function handlePlaceOrder() {
    setPlacing(true);
    setError(null);
    try {
      const res = await api.post<CheckoutResponse>("/api/checkout");
      if (res.url) {
        window.location.href = res.url;
      } else {
        router.push("/checkout/success");
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to start checkout.";
      setError(message);
      setPlacing(false);
    }
  }

  if (authLoading) {
    return (
      <>
        <NavBar />
        <PageShell>
          <div className="mx-auto max-w-lg space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <NavBar />
      <PageShell>
        <div className="mx-auto max-w-lg">
          <div className="mb-8">
            <h1 className="font-display text-4xl font-semibold text-foreground">
              Checkout
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your order before placing it.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {cartLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-card" />
              ))}
            </div>
          )}

          {!cartLoading && isEmpty && (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">Your cart is empty.</p>
              <Link href="/products" className="mt-4 inline-block">
                <Button className="mt-2 rounded-full bg-brand text-white hover:bg-brand-hover">
                  Browse Products
                </Button>
              </Link>
            </div>
          )}

          {!cartLoading && !isEmpty && (
            <div className="rounded-card bg-card p-6 shadow-soft">
              <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
                Order Summary
              </h2>

              {serverItems.length > 0 && (
                <div className="mb-4 flex flex-col gap-2">
                  {serverItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.name}{" "}
                        <span className="text-muted-foreground">×{item.quantity}</span>
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPrice(item.price * item.quantity, item.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {demoItems.length > 0 && (
                <div className="mb-4 flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    AI recommendations
                  </p>
                  {demoItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.name}{" "}
                        <span className="text-muted-foreground">×{item.quantity}</span>
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-4 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>

              <Button
                onClick={handlePlaceOrder}
                disabled={placing}
                className="mt-6 w-full rounded-full bg-brand py-3 text-white hover:bg-brand-hover"
              >
                {placing ? "Processing..." : "Place Order"}
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                By placing your order you agree to our terms of service.
              </p>
            </div>
          )}
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
