"use client";

import { useState, useEffect, useCallback } from "react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PromotionList } from "@/components/designer/PromotionList";
import { PromotionForm } from "@/components/designer/PromotionForm";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { promotions as promotionsApi, ApiError, type PromotionResponse } from "@/lib/api";

export default function PromotionsPage() {
  const { user, loading: authLoading } = useRequireAuth("DESIGNER");

  const [promotions, setPromotions] = useState<PromotionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionResponse | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await promotionsApi.list();
      setPromotions(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load promotions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void fetchPromotions();
  }, [authLoading, user, fetchPromotions]);

  function handleSaved(promotion: PromotionResponse) {
    setPromotions((prev) => {
      const idx = prev.findIndex((p) => p.id === promotion.id);
      if (idx >= 0) {
        return [...prev.slice(0, idx), promotion, ...prev.slice(idx + 1)];
      }
      return [promotion, ...prev];
    });
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await promotionsApi.delete(id);
      setPromotions((prev) => prev.filter((p) => p.id !== id));
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
                {promotions.length} promotion{promotions.length !== 1 ? "s" : ""}
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
            promotions={promotions}
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
