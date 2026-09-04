"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { api, ApiError } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  currency?: string;
}

interface Order {
  id: number;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_STEPS = ["PENDING", "PAID", "SHIPPED", "COMPLETED"];

function statusStyle(status: string): string {
  switch (status.toUpperCase()) {
    case "PAID":
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "PENDING":
      return "bg-yellow-100 text-yellow-700";
    case "CANCELLED":
      return "bg-red-100 text-red-600";
    case "SHIPPED":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ── Status Timeline ───────────────────────────────────────────────────────────

function StatusTimeline({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const isCancelled = upper === "CANCELLED";
  const currentIdx = STATUS_STEPS.indexOf(upper);

  if (isCancelled) {
    return (
      <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
        This order was cancelled.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0">
      {STATUS_STEPS.map((step, idx) => {
        const done = currentIdx >= idx;
        const active = currentIdx === idx;
        return (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  done ? "bg-brand text-white" : "bg-muted text-muted-foreground"
                } ${active ? "ring-2 ring-brand ring-offset-2" : ""}`}
              >
                {done ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <p className="text-center text-[10px] font-medium capitalize text-muted-foreground">
                {step.toLowerCase()}
              </p>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={`mb-4 h-0.5 flex-1 transition-colors ${
                  currentIdx > idx ? "bg-brand" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const params = useParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !params.id) return;

    api
      .get<Order>(`/api/orders/${params.id}`)
      .then(setOrder)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : "Failed to load order.",
        );
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, params.id]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <NavBar />
      <PageShell>
        <Link
          href="/orders"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to orders
        </Link>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-40 rounded-card" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && !order && (
          <div className="py-24 text-center">
            <p className="text-muted-foreground">Order not found.</p>
            <Link href="/orders" className="mt-4 inline-block">
              <Button
                variant="outline"
                className="rounded-full border-border"
              >
                View All Orders
              </Button>
            </Link>
          </div>
        )}

        {!loading && order && (
          <div className="flex max-w-2xl flex-col gap-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-4xl font-semibold text-foreground">
                  Order #{order.id}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Placed on{" "}
                  {new Date(order.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${statusStyle(order.status)}`}
              >
                {order.status}
              </span>
            </div>

            {/* Status timeline */}
            <div className="rounded-card bg-card p-6 shadow-soft">
              <h2 className="mb-6 font-display text-xl font-semibold text-foreground">
                Order Status
              </h2>
              <StatusTimeline status={order.status} />
            </div>

            {/* Items */}
            <div className="rounded-card bg-card p-6 shadow-soft">
              <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
                Items
              </h2>
              {order.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items recorded.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      {item.price !== undefined && (
                        <p className="text-sm font-semibold text-foreground">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency:
                              item.currency || order.currency || "USD",
                          }).format(item.price * item.quantity)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">Total</p>
                <p className="text-base font-semibold text-foreground">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: order.currency || "USD",
                  }).format(order.total)}
                </p>
              </div>
            </div>
          </div>
        )}
      </PageShell>
      <Footer />
    </>
  );
}
