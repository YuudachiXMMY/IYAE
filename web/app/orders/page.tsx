"use client";

import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { OrdersPanel } from "@/components/dashboard/OrdersPanel";

// Standalone /orders route. The order-history content lives in OrdersPanel so it
// can also be surfaced inline by the /dashboard "Orders" tab (single source).
export default function OrdersPage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <OrdersPanel />
      </PageShell>
      <Footer />
    </>
  );
}
