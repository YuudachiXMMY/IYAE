"use client";

import { useState, useCallback, useEffect, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/ImageUploader";
import { api } from "@/lib/api";

const FALLBACK_CATEGORIES = [
  "TOPS",
  "BOTTOMS",
  "DRESSES",
  "OUTERWEAR",
  "SHOES",
  "ACCESSORIES",
  "BAGS",
  "ACTIVEWEAR",
];

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export interface ProductFormData {
  name: string;
  description: string;
  price: number;
  category: string;
  styleTags: string[];
  colorTags: string[];
  sizes: string[];
  status?: string;
  imageUrl?: string | null;
}

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: Partial<ProductFormData>;
  onSubmit: (data: ProductFormData) => Promise<void>;
  submitting?: boolean;
}

function tagsFromString(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function tagsToString(tags: string[]): string {
  return tags.join(", ");
}

export function ProductForm({ mode, initialData, onSubmit, submitting = false }: ProductFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [price, setPrice] = useState(initialData?.price?.toString() ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [styleTagsRaw, setStyleTagsRaw] = useState(
    tagsToString(initialData?.styleTags ?? []),
  );
  const [colorTagsRaw, setColorTagsRaw] = useState(
    tagsToString(initialData?.colorTags ?? []),
  );
  const [sizesRaw, setSizesRaw] = useState(
    tagsToString(initialData?.sizes ?? []),
  );
  const [status, setStatus] = useState(initialData?.status ?? "DRAFT");
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);

  useEffect(() => {
    const controller = new AbortController();
    api.get<string[]>("/api/products/categories", { signal: controller.signal })
      .then((data) => {
        if (data.length > 0) {
          setCategories(data);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Keep fallback categories on other errors
      });
    return () => controller.abort();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError("Product name is required.");
        return;
      }
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setError("Please enter a valid price.");
        return;
      }
      if (!category) {
        setError("Please select a category.");
        return;
      }

      const data: ProductFormData = {
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        category,
        styleTags: tagsFromString(styleTagsRaw),
        colorTags: tagsFromString(colorTagsRaw),
        sizes: tagsFromString(sizesRaw),
        imageUrl,
        ...(mode === "edit" && { status }),
      };

      try {
        await onSubmit(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      }
    },
    [name, description, price, category, styleTagsRaw, colorTagsRaw, sizesRaw, status, imageUrl, mode, onSubmit],
  );

  return (
    <Card className="rounded-card shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          {mode === "create" ? "New Product" : "Edit Product"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Linen Blouse"
              required
              aria-required="true"
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-description">Description</Label>
            <Textarea
              id="pf-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the product..."
              rows={4}
              disabled={submitting}
            />
          </div>

          {/* Price + Category row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-price">
                Price (USD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pf-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
                aria-required="true"
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={submitting}
                required
              >
                <SelectTrigger id="pf-category" aria-required="true">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Style Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-style-tags">Style Tags</Label>
            <Input
              id="pf-style-tags"
              value={styleTagsRaw}
              onChange={(e) => setStyleTagsRaw(e.target.value)}
              placeholder="casual, minimal, boho (comma-separated)"
              disabled={submitting}
            />
          </div>

          {/* Color Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-color-tags">Color Tags</Label>
            <Input
              id="pf-color-tags"
              value={colorTagsRaw}
              onChange={(e) => setColorTagsRaw(e.target.value)}
              placeholder="white, black, navy (comma-separated)"
              disabled={submitting}
            />
          </div>

          {/* Sizes */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-sizes">Sizes</Label>
            <Input
              id="pf-sizes"
              value={sizesRaw}
              onChange={(e) => setSizesRaw(e.target.value)}
              placeholder="XS, S, M, L, XL (comma-separated)"
              disabled={submitting}
            />
          </div>

          {/* Status — edit mode only */}
          {mode === "edit" && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-status">Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={submitting}
              >
                <SelectTrigger id="pf-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Image */}
          <div className="space-y-1.5" role="group" aria-labelledby="pf-image-label">
            <Label id="pf-image-label">Product Image</Label>
            <ImageUploader
              currentUrl={imageUrl}
              onUpload={(url) => setImageUrl(url)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto bg-brand hover:bg-brand-hover text-white"
          >
            {submitting
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Product"
                : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
