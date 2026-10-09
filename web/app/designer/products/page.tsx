"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Ellipsis, Pencil, Trash2, Package } from "lucide-react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GenerationStatusBadge } from "@/components/GenerationStatusBadge";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { TONE_CLASS } from "@/lib/status";
import type { Product } from "@/components/ProductListItem";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: TONE_CLASS.neutral,
  PUBLISHED: TONE_CLASS.success,
  ARCHIVED: TONE_CLASS.warning,
};

const FILTER_TABS = ["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as const;

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(price);
}

function formatLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function DesignerProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ALL");

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Product[]>("/api/designer/products");
      setProducts(data);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && user.role === "DESIGNER") {
      void fetchProducts();
    } else if (!authLoading && user) {
      setLoading(false);
    }
  }, [authLoading, user, fetchProducts]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: products.length };
    for (const p of products) {
      counts[p.status] = (counts[p.status] ?? 0) + 1;
    }
    return counts;
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      activeTab === "ALL"
        ? products
        : products.filter((p) => p.status === activeTab),
    [products, activeTab],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/designer/products/${deleteTarget.id}`);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError("Failed to delete product. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

  /* ─── Loading skeleton ─── */
  if (authLoading) {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="space-y-6">
            <div>
              <Skeleton className="h-10 w-48" />
              <Skeleton className="mt-2 h-4 w-32" />
            </div>
            <Skeleton className="h-9 w-80 rounded-full" />
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-soft"
                >
                  <Skeleton className="h-20 w-16 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-md" />
                      <Skeleton className="h-5 w-14 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PageShell>
      </>
    );
  }

  /* ─── Non-designer gate ─── */
  if (user && user.role !== "DESIGNER") {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-card bg-card p-10 shadow-soft max-w-md w-full">
              <h2 className="font-display text-2xl font-semibold text-foreground mb-3">
                Designer area
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                This area is for designers. Apply to become a designer to access
                these features.
              </p>
              <Button
                className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover"
                onClick={() => router.push("/dashboard")}
              >
                Go to dashboard
              </Button>
            </div>
          </div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        {/* ─── Header ─── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
              My products
            </h1>
            {!loading && (
              <p className="mt-1 text-sm text-muted-foreground">
                {products.length}{" "}
                {products.length === 1 ? "product" : "products"} in your catalog
              </p>
            )}
          </div>
          <Button
            onClick={() => router.push("/designer/products/new")}
            className="bg-brand hover:bg-brand-hover text-primary-foreground gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Create product
          </Button>
        </div>

        {/* ─── Status filter pills ─── */}
        {!loading && products.length > 0 && (
          <nav
            className="mb-6 flex gap-1 overflow-x-auto pb-1"
            aria-label="Filter by status"
          >
            {FILTER_TABS.map((tab) => {
              const count = statusCounts[tab] ?? 0;
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  // A filter chip is a toggle, not a location: `aria-pressed`
                  // is what conveys "this filter is on" to assistive tech.
                  aria-pressed={isActive}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab === "ALL" ? "All" : formatLabel(tab)}
                  <span
                    className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                      isActive ? "bg-background/20" : "bg-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* ─── Product list ─── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-soft"
              >
                <Skeleton className="h-20 w-16 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-28" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-5 w-14 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          /* ─── Empty state ─── */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Package className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">
              {activeTab === "ALL"
                ? "No products yet"
                : `No ${formatLabel(activeTab).toLowerCase()} products`}
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {activeTab === "ALL"
                ? "Create your first product to start building your catalog."
                : "Products will appear here when you change their status."}
            </p>
            {activeTab === "ALL" && (
              <Button
                className="mt-6 bg-brand hover:bg-brand-hover text-primary-foreground gap-1.5"
                onClick={() => router.push("/designer/products/new")}
              >
                <Plus className="h-4 w-4" />
                Create product
              </Button>
            )}
          </div>
        ) : (
          /* ─── Product cards ─── */
          <div className="space-y-2">
            {filteredProducts.map((product, i) => {
              const img = product.media?.[0] ?? null;
              return (
                <article
                  key={product.id}
                  className="group relative flex items-center gap-4 rounded-2xl bg-card px-4 py-3 shadow-soft transition-shadow duration-200 hover:shadow-heavy"
                  style={{
                    animation: "staggerIn 0.35s ease-out both",
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  {/* Stretched edit link — covers entire card */}
                  <Link
                    href={`/designer/products/${product.id}/edit`}
                    className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Edit ${product.name}`}
                  />

                  {/* Thumbnail */}
                  <div className="pointer-events-none relative z-[1] h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {img ? (
                      <Image
                        src={img}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="pointer-events-none relative z-[1] flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-medium text-foreground transition-colors group-hover:text-brand">
                      {product.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatLabel(product.category)}
                      <span className="mx-1.5 text-border">·</span>
                      {formatPrice(product.price, product.currency)}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[product.status] ?? STATUS_STYLES.DRAFT
                        }`}
                      >
                        {formatLabel(product.status)}
                      </span>
                      <GenerationStatusBadge
                        status={product.glbUrl ? "READY" : null}
                      />
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <div className="relative z-[2]">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                          aria-label={`Actions for ${product.name}`}
                        >
                          <Ellipsis className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(
                              `/designer/products/${product.id}/edit`,
                            )
                          }
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ─── Delete confirmation dialog ─── */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete product</DialogTitle>
              <DialogDescription>
                This will permanently delete{" "}
                <span className="font-medium text-foreground">
                  {deleteTarget?.name}
                </span>
                . This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
              <p
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {deleteError}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </>
  );
}
