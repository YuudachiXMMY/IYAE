"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { api, ApiError } from "@/lib/api";
import { toneForStatus, TONE_CLASS } from "@/lib/status";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

interface Order {
  id: number;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function statusStyle(status: string): string {
  return TONE_CLASS[toneForStatus(status)];
}

// ── Order Row ─────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formattedTotal = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: order.currency || "CAD",
  }).format(order.total);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="group flex items-center justify-between gap-4 rounded-card bg-card p-5 shadow-soft transition-shadow hover:shadow-md"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            Order #{order.id}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(order.status)}`}
          >
            {order.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formattedDate} &middot;{" "}
          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
        </p>
        {order.items.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {order.items.map((i) => i.name).join(", ")}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-semibold text-foreground">{formattedTotal}</p>
        <span className="text-xs text-muted-foreground transition-colors group-hover:text-brand">
          View →
        </span>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    api
      .get<Order[]>("/api/orders")
      .then(setOrders)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : "Failed to load orders.",
        );
      })
      .finally(() => setLoading(false));
  }, [authLoading, user]);

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
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold text-foreground">
            My Orders
          </h1>
          {!loading && orders.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="rounded-full bg-brand/10 p-5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brand"
                aria-label="No orders"
              >
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect width="6" height="4" x="9" y="3" rx="2" />
                <path d="M9 12h6M9 16h4" />
              </svg>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-foreground">
                No orders yet
              </p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Browse our collection and place your first order.
              </p>
            </div>
            <Button
              asChild
              className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
            >
              <Link href="/products">Browse Products</Link>
            </Button>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </PageShell>
      <Footer />
    </>
  );
}
