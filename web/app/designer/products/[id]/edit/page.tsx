"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm, type ProductFormData } from "@/components/ProductForm";
import { GenerationStatusCard } from "@/components/GenerationStatusCard";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useGenerationStatus } from "@/lib/hooks/useGenerationStatus";
import { RiggingStatusCard } from "@/components/RiggingStatusCard";
import { api, type SizeMeasurement } from "@/lib/api";
import type { Product } from "@/components/ProductListItem";

interface UpdateProductRequest {
  name: string;
  description: string;
  price: number;
  category: string;
  styleTags: string[];
  colorTags: string[];
  sizes: string[];
  status: string;
  media: string[];
  measurements: SizeMeasurement[];
}

export default function EditProductPage() {
  const { loading: authLoading } = useRequireAuth("DESIGNER");
  const router = useRouter();
  const params = useParams();
  const productId = Number(params.id);

  const { status: generationStatus } = useGenerationStatus(productId, true);
  const [fetched, setFetched] = useState<{
    productId: number;
    product: Product | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // `Number("abc")` is NaN and `Number("")` is 0 — neither is a product id.
  const validId = Number.isFinite(productId) && productId !== 0;
  // The fetched product is tagged with the id it belongs to, so "no answer for
  // this id yet" is the skeleton and an unusable id is straight to not-found —
  // neither needs a flag set from the effect.
  const loading = validId && fetched?.productId !== productId;
  const product = fetched?.productId === productId ? fetched.product : null;

  useEffect(() => {
    if (authLoading || !validId) return;
    async function fetchProduct() {
      try {
        const products = await api.get<Product[]>("/api/designer/products");
        setFetched({
          productId,
          product: products.find((p) => p.id === productId) ?? null,
        });
      } catch {
        setFetched({ productId, product: null });
      }
    }
    void fetchProduct();
  }, [authLoading, validId, productId]);

  const handleUpdate = useCallback(
    async (data: ProductFormData) => {
      if (!product) return;
      setSubmitting(true);
      try {
        const body: UpdateProductRequest = {
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          styleTags: data.styleTags,
          colorTags: data.colorTags,
          sizes: data.sizes,
          status: data.status ?? product.status,
          media: data.imageUrl ? [data.imageUrl] : [],
          measurements: data.measurements ?? [],
        };
        await api.put(`/api/designer/products/${product.id}`, body);
        router.push("/designer/products");
      } finally {
        setSubmitting(false);
      }
    },
    [product, router],
  );

  if (authLoading || loading) {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-96 w-full rounded-card" />
          </div>
        </PageShell>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-lg font-medium text-muted-foreground">Product not found</p>
            <button
              onClick={() => router.push("/designer/products")}
              className="mt-4 text-sm text-brand hover:underline"
            >
              Back to Products
            </button>
          </div>
        </PageShell>
      </>
    );
  }

  const initialData: ProductFormData = {
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category.toUpperCase(),
    styleTags: product.styleTags,
    colorTags: product.colorTags,
    sizes: product.sizes,
    status: product.status,
    imageUrl: product.media?.[0] ?? null,
    measurements: product.measurements ?? [],
  };

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="mb-6">
          <button
            onClick={() => router.push("/designer/products")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span>
            Back to Products
          </button>
        </div>

        <div className="mx-auto max-w-2xl space-y-6">
          {/* Edit form */}
          <ProductForm
            mode="edit"
            initialData={initialData}
            onSubmit={handleUpdate}
            submitting={submitting}
          />

          {/* 3D generation status */}
          <GenerationStatusCard productId={product.id} />

          {/* Garment Rigging — only shown when 3D model is ready */}
          {(generationStatus?.status === "READY") && (
            <RiggingStatusCard productId={product.id} />
          )}
        </div>
      </PageShell>
    </>
  );
}
