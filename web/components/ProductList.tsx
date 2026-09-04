"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductListItem, type Product } from "@/components/ProductListItem";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 8;
const LOAD_MORE_COUNT = 8;
const PRIORITY_COUNT = 4;

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

interface ProductListProps {
  products: Product[];
  loading?: boolean;
  className?: string;
}

function ProductSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-card shadow-soft">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-3.5 w-16 rounded-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/3 mt-2" />
      </div>
    </div>
  );
}

export function ProductList({ products, loading, className }: ProductListProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Reset visible count when products change (e.g. filter/search)
    setVisibleCount(INITIAL_VISIBLE);
  }, [products]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, products.length));
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [products.length]);

  const visibleProducts = products.slice(0, visibleCount);
  const gridClasses = cn(
    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
    className,
  );

  return (
    <div>
      {loading ? (
        <div className={gridClasses}>
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <MagnifyingGlass size={32} weight="light" className="text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">
            No products found
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            Try adjusting your search or filters to discover something new.
          </p>
        </div>
      ) : (
        <motion.div
          className={gridClasses}
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={reduce ? undefined : staggerContainer}
        >
          {visibleProducts.map((product, index) => (
            <motion.div key={product.id} variants={reduce ? undefined : fadeUpItem}>
              <ProductListItem
                product={product}
                priority={index < PRIORITY_COUNT}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Sentinel element for IntersectionObserver — only rendered when there are more items to load */}
      {!loading && visibleCount < products.length && (
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      )}
    </div>
  );
}
