"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { ProductForm, type ProductFormData } from "@/components/ProductForm";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { api } from "@/lib/api";

interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  category: string;
  styleTags: string[];
  colorTags: string[];
  sizes: string[];
  media: string[];
}

export default function NewProductPage() {
  const { loading: authLoading } = useRequireAuth("DESIGNER");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = useCallback(
    async (data: ProductFormData) => {
      setSubmitting(true);
      try {
        const body: CreateProductRequest = {
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          styleTags: data.styleTags,
          colorTags: data.colorTags,
          sizes: data.sizes,
          media: data.imageUrl ? [data.imageUrl] : [],
        };
        await api.post("/api/designer/products", body);
        router.push("/designer/products");
      } finally {
        setSubmitting(false);
      }
    },
    [router],
  );

  if (authLoading) return null;

  return (
    <>
      <NavBar />
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

        <div className="mx-auto max-w-2xl">
          <ProductForm
            mode="create"
            onSubmit={handleCreate}
            submitting={submitting}
          />
        </div>
      </PageShell>
    </>
  );
}
