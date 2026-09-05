"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { ProductList } from "@/components/ProductList";
import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Product } from "@/components/ProductListItem";

interface ProductPage {
  content: Product[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page") ?? "0");
  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "createdAt,desc";
  const currentQ = searchParams.get("q") ?? "";
  const currentLocalOnly = searchParams.get("localOnly") === "true";

  const [data, setData] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        size: "20",
        sort: currentSort,
      });
      if (currentCategory) params.set("category", currentCategory);
      if (currentQ) params.set("q", currentQ);
      if (currentLocalOnly) params.set("localOnly", "true");

      const result = await api.get<ProductPage>(
        `/api/products?${params.toString()}`,
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentCategory, currentSort, currentQ, currentLocalOnly]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    if (!("page" in updates)) {
      next.set("page", "0");
    }
    router.push(`/products?${next.toString()}`, { scroll: false });
  }

  const handleSearch = useCallback(
    (q: string) => updateParams({ q }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  );

  const handleCategory = useCallback(
    (category: string) => updateParams({ category }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  );

  const handleSort = useCallback(
    (sort: string) => updateParams({ sort }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  );

  const handleLocal = useCallback(
    (next: boolean) => updateParams({ localOnly: next ? "true" : "" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  );

  const totalPages = data?.totalPages ?? 0;
  const products = data?.content ?? [];

  return (
    <>
      <NavBar />
      <PageShell>
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight leading-none text-foreground">
            Discover
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Curated pieces from independent designers
          </p>
          {data && (
            <p className="mt-2 text-sm tabular-nums text-muted-foreground/60">
              {data.totalElements} pieces
            </p>
          )}
        </div>

        {/* Filters */}
        <SearchFilterBar
          onSearch={handleSearch}
          onCategory={handleCategory}
          onSort={handleSort}
          onLocal={handleLocal}
          localActive={currentLocalOnly}
          className="mb-8"
        />

        {/* Product grid */}
        <ProductList products={products} loading={loading} />

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-16 flex items-center justify-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full p-0"
              disabled={currentPage <= 0}
              onClick={() =>
                updateParams({ page: String(currentPage - 1) })
              }
            >
              <CaretLeft size={16} weight="bold" />
            </Button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum =
                totalPages <= 5
                  ? i
                  : currentPage < 3
                    ? i
                    : currentPage > totalPages - 4
                      ? totalPages - 5 + i
                      : currentPage - 2 + i;
              return (
                <Button
                  key={pageNum}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 w-9 rounded-full p-0 text-sm font-medium tabular-nums transition-colors",
                    pageNum === currentPage
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() =>
                    updateParams({ page: String(pageNum) })
                  }
                >
                  {pageNum + 1}
                </Button>
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full p-0"
              disabled={data?.last ?? true}
              onClick={() =>
                updateParams({ page: String(currentPage + 1) })
              }
            >
              <CaretRight size={16} weight="bold" />
            </Button>
          </div>
        )}
      </PageShell>
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <>
          <NavBar />
          <PageShell>
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-muted rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-72 bg-muted rounded-2xl" />
                ))}
              </div>
            </div>
          </PageShell>
        </>
      }
    >
      <ProductsPageContent />
    </Suspense>
  );
}
