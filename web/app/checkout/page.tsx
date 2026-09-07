"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useCart } from "@/lib/cart-context";
import {
  api,
  ApiError,
  fulfillment as fulfillmentApi,
  type PickupLocation,
  type ShippingOption,
  type FulfillmentMethod,
  type CheckoutRequestBody,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckoutResponse {
  sessionId: string;
  url: string;
}

// ── Format helper ─────────────────────────────────────────────────────────────

function formatPrice(amount: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { serverItems, demoItems, totalCount, loading: cartLoading } = useCart();
  const router = useRouter();

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fulfillment selection
  const [method, setMethod] = useState<FulfillmentMethod>("SHIP");
  const [carrier, setCarrier] = useState<string | null>(null);
  const [pickupLocationId, setPickupLocationId] = useState<number | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fulfillmentApi.shippingOptions(controller.signal),
      fulfillmentApi.pickupLocations(controller.signal),
    ])
      .then(([options, locations]) => {
        setShippingOptions(options);
        setPickupLocations(locations);
        // Default carrier = first non-Canada-Post (strike-resilient), else first.
        const preferred =
          options.find((o) => o.carrier !== "CANADA_POST") ?? options[0];
        if (preferred) setCarrier(preferred.carrier);
        if (locations[0]) setPickupLocationId(locations[0].id);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Options are advisory for display; a failure shouldn't hard-block a ship default.
        setError((prev) => prev ?? "Couldn't load delivery options. Please retry.");
      })
      .finally(() => setOptionsLoading(false));
    return () => controller.abort();
  }, []);

  const serverTotal = serverItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const demoTotal = demoItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = serverTotal + demoTotal;
  const isEmpty = totalCount === 0 && !cartLoading;

  const selectedFee =
    method === "PICKUP"
      ? 0
      : shippingOptions.find((o) => o.carrier === carrier)?.fee ?? 0;
  const grandTotal = subtotal + selectedFee;

  const selectionValid =
    method === "PICKUP" ? pickupLocationId != null : carrier != null;

  async function handlePlaceOrder() {
    setPlacing(true);
    setError(null);
    try {
      const body: CheckoutRequestBody =
        method === "PICKUP"
          ? { fulfillmentMethod: "PICKUP", pickupLocationId }
          : { fulfillmentMethod: "SHIP", shippingCarrier: carrier };
      const res = await api.post<CheckoutResponse>("/api/checkout", body);
      if (res.url) {
        window.location.href = res.url;
      } else {
        router.push("/checkout/success");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start checkout.");
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
            <h1 className="font-display text-4xl font-semibold text-foreground">Checkout</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how you want it, then review your order.
            </p>
          </div>

          {error && (
            <div
              id="checkout-error"
              role="alert"
              className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
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
                <Button className="mt-2 rounded-full bg-brand text-primary-foreground hover:bg-brand-hover">
                  Browse Products
                </Button>
              </Link>
            </div>
          )}

          {!cartLoading && !isEmpty && (
            <div className="flex flex-col gap-6">
              {/* Fulfillment selector */}
              <div className="rounded-card bg-card p-6 shadow-soft">
                <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
                  How do you want it?
                </h2>

                <div className="mb-5 grid grid-cols-2 gap-3" role="group" aria-label="Fulfillment method">
                  <button
                    type="button"
                    aria-pressed={method === "SHIP"}
                    onClick={() => setMethod("SHIP")}
                    className={`rounded-card border px-4 py-3 text-sm font-medium transition-colors ${
                      method === "SHIP"
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border bg-background text-foreground hover:border-brand/40"
                    }`}
                  >
                    Ship it
                  </button>
                  <button
                    type="button"
                    aria-pressed={method === "PICKUP"}
                    onClick={() => setMethod("PICKUP")}
                    className={`rounded-card border px-4 py-3 text-sm font-medium transition-colors ${
                      method === "PICKUP"
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border bg-background text-foreground hover:border-brand/40"
                    }`}
                  >
                    Pick it up
                  </button>
                </div>

                {optionsLoading && <Skeleton className="h-24 rounded-card" />}

                {!optionsLoading && method === "SHIP" && (
                  <div className="flex flex-col gap-2" role="group" aria-label="Shipping carrier">
                    {shippingOptions.map((o) => (
                      <button
                        key={o.carrier}
                        type="button"
                        aria-pressed={carrier === o.carrier}
                        onClick={() => setCarrier(o.carrier)}
                        className={`flex items-center justify-between rounded-card border px-4 py-3 text-sm transition-colors ${
                          carrier === o.carrier
                            ? "border-brand bg-brand/10"
                            : "border-border bg-background hover:border-brand/40"
                        }`}
                      >
                        <span className="font-medium text-foreground">{o.displayName}</span>
                        <span className="text-muted-foreground">{formatPrice(o.fee)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!optionsLoading && method === "PICKUP" && (
                  <div className="flex flex-col gap-2" role="group" aria-label="Pickup location">
                    {pickupLocations.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No pickup locations available right now.
                      </p>
                    )}
                    {pickupLocations.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        aria-pressed={pickupLocationId === loc.id}
                        onClick={() => setPickupLocationId(loc.id)}
                        className={`flex flex-col items-start gap-1 rounded-card border px-4 py-3 text-left text-sm transition-colors ${
                          pickupLocationId === loc.id
                            ? "border-brand bg-brand/10"
                            : "border-border bg-background hover:border-brand/40"
                        }`}
                      >
                        <span className="font-medium text-foreground">{loc.name}</span>
                        <span className="text-xs text-muted-foreground">{loc.addressLine}</span>
                        <span className="text-xs text-muted-foreground">
                          Free · {loc.instructions ?? "Usually ready in 24h"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Order summary */}
              <div className="rounded-card bg-card p-6 shadow-soft">
                <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
                  Order Summary
                </h2>

                {serverItems.length > 0 && (
                  <div className="mb-4 flex flex-col gap-2">
                    {serverItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.name} <span className="text-muted-foreground">×{item.quantity}</span>
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
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.name} <span className="text-muted-foreground">×{item.quantity}</span>
                        </span>
                        <span className="font-medium text-foreground">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span data-testid="checkout-subtotal">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Taxes</span>
                    <span>Calculated at payment</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{method === "PICKUP" ? "Pickup" : "Shipping"}</span>
                    <span data-testid="checkout-shipping">
                      {method === "PICKUP" || selectedFee === 0 ? "Free" : formatPrice(selectedFee)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-border pt-4 text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span data-testid="checkout-total">{formatPrice(grandTotal)}</span>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={placing || !selectionValid}
                  className="mt-6 w-full rounded-full bg-brand py-3 text-primary-foreground hover:bg-brand-hover"
                >
                  {placing ? "Processing..." : "Place Order"}
                </Button>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  By placing your order you agree to our terms of service. Taxes, if any, are shown
                  before you confirm payment. No subscriptions or recurring charges are added.
                </p>
              </div>
            </div>
          )}
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
