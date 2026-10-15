"use client";

import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PromotionList } from "@/components/designer/PromotionList";
import { PromotionForm } from "@/components/designer/PromotionForm";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { CATALOG_MANAGER_ROLES } from "@/lib/roles";
import { promotions as promotionsApi, ApiError, type PromotionResponse } from "@/lib/api";

export default function PromotionsPage() {
  const { user, loading: authLoading } = useRequireAuth(CATALOG_MANAGER_ROLES);

  // `null` is "not loaded yet" — the skeleton state — so the fetch below has no
  // loading flag to set.
  const [promotions, setPromotions] = useState<PromotionResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionResponse | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loading = promotions === null;
  const items = promotions ?? [];

  useEffect(() => {
    if (authLoading || !user) return;
    async function fetchPromotions() {
      try {
        const data = await promotionsApi.list();
        setPromotions(data);
        setError(null);
      } catch (err) {
        setPromotions([]);
        setError(err instanceof ApiError ? err.message : "Failed to load promotions.");
      }
    }
    void fetchPromotions();
  }, [authLoading, user]);

  function handleSaved(promotion: PromotionResponse) {
    setPromotions((prev) => {
      const current = prev ?? [];
      const idx = current.findIndex((p) => p.id === promotion.id);
      if (idx >= 0) {
        return [...current.slice(0, idx), promotion, ...current.slice(idx + 1)];
      }
      return [promotion, ...current];
    });
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await promotionsApi.delete(id);
      setPromotions((prev) => (prev ?? []).filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete promotion.");
    } finally {
      setDeleting(null);
    }
  }

  function handleEdit(promotion: PromotionResponse) {
    setEditing(promotion);
    setFormOpen(true);
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditing(null);
  }

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
      <SiteHeader variant="app" />
      <PageShell>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-serif text-4xl font-semibold text-foreground">Promotions</h1>
            {!loading && (
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length} promotion{items.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
          >
            New Promotion
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
        )}

        {!loading && (
          <PromotionList
            promotions={items}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deleting={deleting}
          />
        )}
      </PageShell>
      <Footer />

      <PromotionForm
        open={formOpen}
        onClose={handleFormClose}
        onSaved={handleSaved}
        editing={editing}
      />
    </>
  );
}
