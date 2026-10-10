"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ProductSelectCard, type SelectableProduct } from "./ProductSelectCard";

interface ProductListItem {
  id: number;
  name: string;
  price: number;
  category: string;
  media: string;
  glbUrl: string | null;
  status: string;
}

interface ProductListResponse {
  content: ProductListItem[];
  totalPages: number;
  totalElements: number;
  number: number;
}

interface ProductPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (product: SelectableProduct) => void;
  initialCategory?: string;
  excludeProductIds?: number[];
  slotLabel?: string;
}

function parseMedia(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl bg-card p-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProductPickerDialog({
  open,
  onClose,
  onSelect,
  initialCategory = "",
  excludeProductIds = [],
  slotLabel,
}: ProductPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-foreground">
            {slotLabel ? `Choose ${slotLabel}` : "Choose Product"}
          </DialogTitle>
        </DialogHeader>

        {/* The body seeds its filter from the slot's category on mount, so it is
            remounted per open rather than re-seeded by an effect. */}
        <PickerBody
          key={`${open}-${initialCategory}`}
          initialCategory={initialCategory}
          excludeProductIds={excludeProductIds}
          onSelect={onSelect}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  initialCategory,
  excludeProductIds,
  onSelect,
  onClose,
}: {
  initialCategory: string;
  excludeProductIds: number[];
  onSelect: (product: SelectableProduct) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Tagged with the query it answers, so "no result for this query yet" — the
  // loading state — is derived instead of being flipped by the fetch effect.
  const queryKey = `${debouncedSearch}\u0000${category}`;
  const [result, setResult] = useState<{
    queryKey: string;
    products: SelectableProduct[];
    page: number;
    totalPages: number;
  } | null>(null);
  const current = result?.queryKey === queryKey ? result : null;
  const loading = current === null;
  const page = current?.page ?? 0;
  const totalPages = current?.totalPages ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<string[]>("/api/products/categories", { signal: controller.signal })
      .then((data) => setCategories(data))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const fetchProducts = useCallback(
    async (pageNum: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        page: String(pageNum),
        size: "12",
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (category) params.set("category", category);

      const data = await api.get<ProductListResponse>(
        `/api/products?${params.toString()}`,
        { signal }
      );

      const mapped: SelectableProduct[] = data.content.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        media: parseMedia(p.media),
        glbUrl: p.glbUrl,
      }));

      return { products: mapped, totalPages: data.totalPages };
    },
    [debouncedSearch, category]
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts(0, controller.signal)
      .then(({ products: fetched, totalPages: tp }) =>
        setResult({ queryKey, products: fetched, page: 0, totalPages: tp })
      )
      // Settle the query anyway so the empty state replaces the skeleton. A
      // newer query has its own key, so a late abort cannot resurrect this one.
      .catch(() =>
        setResult({ queryKey, products: [], page: 0, totalPages: 0 })
      );

    return () => controller.abort();
  }, [queryKey, fetchProducts]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    const controller = new AbortController();
    setLoadingMore(true);
    try {
      const { products: more, totalPages: tp } = await fetchProducts(
        nextPage,
        controller.signal
      );
      setResult((prev) =>
        prev?.queryKey === queryKey
          ? {
              queryKey,
              products: [...prev.products, ...more],
              page: nextPage,
              totalPages: tp,
            }
          : prev
      );
    } catch {
      // aborted or error — ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelect = (product: SelectableProduct) => {
    onSelect(product);
    onClose();
  };

  // Slots already filled are hidden here rather than in the request, so a fresh
  // `excludeProductIds` array from the parent cannot re-trigger the fetch.
  const products = (current?.products ?? []).filter(
    (p) => !excludeProductIds.includes(p.id)
  );
  const hasMore = page + 1 < totalPages;

  return (
    <>
      <div className="shrink-0 flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row">
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand sm:w-48"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <SkeletonGrid />
        ) : products.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No products found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((product) => (
                <ProductSelectCard
                  key={product.id}
                  product={product}
                  onSelect={() => handleSelect(product)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
