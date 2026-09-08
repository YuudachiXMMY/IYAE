"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface OrderLike {
  fulfillmentMethod?: "SHIP" | "PICKUP";
  shippingCarrier?: string | null;
  pickupLocationName?: string | null;
}

export default function CheckoutSuccessPage() {
  const [order, setOrder] = useState<OrderLike | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<OrderLike[]>("/api/orders", { signal: controller.signal })
      .then((orders) => {
        if (orders && orders.length > 0) setOrder(orders[0]);
      })
      .catch(() => {
        /* best-effort — the generic confirmation still renders */
      });
    return () => controller.abort();
  }, []);

  const isPickup = order?.fulfillmentMethod === "PICKUP";

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-success"
              aria-label="Order confirmed"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
            Order Confirmed!
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted-foreground">
            {isPickup
              ? `We'll email you when your order is ready for pickup${
                  order?.pickupLocationName ? ` at ${order.pickupLocationName}` : ""
                }.`
              : order?.shippingCarrier
                ? `Thank you for your purchase. Your order will ship with ${order.shippingCarrier}.`
                : "Thank you for your purchase. We've received your order and will begin processing it right away."}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/orders">
              <Button className="rounded-full bg-brand px-8 text-primary-foreground hover:bg-brand-hover">
                View My Orders
              </Button>
            </Link>
            <Link href="/products">
              <Button variant="outline" className="rounded-full border-border px-8">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
