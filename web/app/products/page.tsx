"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { SectionKicker } from "@/components/design-system/SectionKicker";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { ProductCard } from "@/components/design-system/ProductCard";
import { SearchFilterBar, type ShopFilter } from "@/components/SearchFilterBar";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { api } from "@/lib/api";
import { toggleSavedProduct, useSavedProductIds } from "@/lib/saved-products";
import type { Product } from "@/components/ProductListItem";

interface ProductPage {
  content: Product[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(price);
}

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page") ?? "0");
  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "createdAt,desc";
  const currentQ = searchParams.get("q") ?? "";
  const currentLocalOnly = searchParams.get("localOnly") === "true";
  const currentView = searchParams.get("view") ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<{
    totalElements: number;
    totalPages: number;
    last: boolean;
  } | null>(null);
  const savedIds = useSavedProductIds();

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(currentPage),
      size: "20",
      sort: currentSort,
    });
    if (currentCategory) params.set("category", currentCategory);
    if (currentQ) params.set("q", currentQ);
    if (currentLocalOnly) params.set("localOnly", "true");
    return params.toString();
  }, [currentPage, currentCategory, currentSort, currentQ, currentLocalOnly]);

  // The query string doubles as the identity of what is on screen: "we have no
  // answer for this query yet" *is* the loading state, so changing filters or
  // page enters it during render instead of through a set in the effect.
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const loading = loadedQuery !== query;

  useEffect(() => {
    async function fetchProducts() {
      try {
        const result = await api.get<ProductPage>(`/api/products?${query}`);
        setMeta({
          totalElements: result.totalElements,
          totalPages: result.totalPages,
          last: result.last,
        });
        // Page 0 (fresh filter/search) replaces; later pages accumulate (LOAD MORE).
        setProducts((prev) => {
          if (currentPage === 0) return result.content;
          // Append by id, never blindly: a re-run of this effect (React Strict
          // Mode double-invokes it in dev) would otherwise append the same page
          // twice and collide React keys.
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...result.content.filter((p) => !seen.has(p.id))];
        });
      } catch {
        if (currentPage === 0) {
          setProducts([]);
          setMeta(null);
        }
      } finally {
        setLoadedQuery(query);
      }
    }
    void fetchProducts();
  }, [query, currentPage]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
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
    },
    [router, searchParams],
  );

  // --- Search (debounced, mirrors previous SearchFilterBar behaviour) ---
  const [rawQuery, setRawQuery] = useState(currentQ);
  const debouncedQuery = useDebounce(rawQuery, 300);

  useEffect(() => {
    if (debouncedQuery !== currentQ) {
      updateParams({ q: debouncedQuery });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // --- Filter pills → existing filter state ---
  const activeFilter: ShopFilter = currentLocalOnly
    ? "local"
    : currentCategory === "Accessories"
      ? "accessories"
      : currentCategory
        ? "clothing"
        : currentView === "newIn"
          ? "newIn"
          : "forYou";

  const handleFilter = useCallback(
    (filter: ShopFilter) => {
      switch (filter) {
        case "forYou":
          updateParams({ category: "", localOnly: "", view: "" });
          break;
        case "newIn":
          updateParams({
            category: "",
            localOnly: "",
            view: "newIn",
            sort: "createdAt,desc",
          });
          break;
        case "local":
          updateParams({
            localOnly: currentLocalOnly ? "" : "true",
            category: "",
            view: "",
          });
          break;
        case "clothing":
          updateParams({ category: "Clothing", localOnly: "", view: "" });
          break;
        case "accessories":
          updateParams({ category: "Accessories", localOnly: "", view: "" });
          break;
      }
    },
    [updateParams, currentLocalOnly],
  );

  const handleSort = useCallback(
    (sort: string) => updateParams({ sort }),
    [updateParams],
  );

  const loadMore = useCallback(
    () => updateParams({ page: String(currentPage + 1) }),
    [updateParams, currentPage],
  );

  const count = meta?.totalElements ?? 0;
  const initialLoading = loading && products.length === 0;

  return (
    <>
      <SiteHeader variant="app" />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-12 lg:px-12">
          {/* Editorial header + search */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <SectionKicker>SHOP</SectionKicker>
              <EditorialHeading as="h1" className="mt-3">
                Pieces, considered for you.
              </EditorialHeading>
            </div>

            <div className="w-full sm:max-w-xs">
              <label htmlFor="shop-search" className="sr-only">
                Search pieces
              </label>
              <div className="flex items-center gap-2 border-b border-foreground py-2">
                <Search
                  width={16}
                  height={16}
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                />
                <input
                  id="shop-search"
                  type="search"
                  value={rawQuery}
                  onChange={(e) => setRawQuery(e.target.value)}
                  placeholder="Search designers, pieces, colours…"
                  aria-label="Search pieces"
                  className="w-full border-0 bg-transparent p-0 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Filter row */}
          <SearchFilterBar
            activeFilter={activeFilter}
            onFilter={handleFilter}
            sort={currentSort}
            onSort={handleSort}
            count={count}
            className="mt-10"
          />

          {/* Product grid */}
          {initialLoading ? (
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-[276/300] w-full animate-pulse rounded-[2px] bg-muted" />
                  <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center py-24 text-center">
              <EditorialHeading as="h2" className="text-[24px]">
                No pieces found
              </EditorialHeading>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Try adjusting your search or filters to discover something new.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  price={formatPrice(product.price, product.currency)}
                  imageUrl={product.media?.[0]}
                  href={`/products/${product.id}`}
                  saved={savedIds.has(product.id)}
                  onToggleSave={() => {
                    // Optimistic: the store updates synchronously, so the heart
                    // flips now. The promise settles the server write and never
                    // rejects — a failure rolls the store back on its own.
                    void toggleSavedProduct(product.id);
                  }}
                />
              ))}
            </div>
          )}

          {/* Recommendation line + LOAD MORE */}
          {!initialLoading && products.length > 0 && (
            <div className="mt-14">
              <p className="text-brand text-[12px]">
                Recommended because you liked structured silhouettes
              </p>
              <div className="mt-4 border-t border-border" />
              {!(meta?.last ?? true) && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline-pill"
                    size="pill"
                    onClick={loadMore}
                    disabled={loading}
                  >
                    {loading ? "LOADING…" : "LOAD MORE"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader variant="app" />
          <main className="min-h-screen bg-background">
            <div className="mx-auto max-w-7xl px-6 pb-20 pt-12 lg:px-12">
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-48 rounded bg-muted" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[276/300] rounded-[2px] bg-muted" />
                  ))}
                </div>
              </div>
            </div>
          </main>
        </>
      }
    >
      <ProductsPageContent />
    </Suspense>
  );
}
