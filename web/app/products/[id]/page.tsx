"use client";

import { useState, useEffect, use, Component } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SizeSelector } from "@/components/SizeSelector";
import { RecommendedSizeHint } from "@/components/RecommendedSizeHint";
import { api, ApiError, sizing, type SizeRecommendationResponse } from "@/lib/api";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { SmartARViewer } from "@/components/SmartARViewer";
import type { Product } from "@/components/ProductListItem";

interface ProductWithAsset extends Product {
  glbAssetUrl?: string | null;
  usdzAssetUrl?: string | null;
  assetStatus?: string | null;
}

interface Review {
  id: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

interface BackendReview {
  id: number;
  userId: number;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface PagedReviewResponse {
  content: BackendReview[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

class ViewerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <p className="text-sm text-muted-foreground italic">
          3D preview unavailable
        </p>
      );
    }
    return this.props.children;
  }
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(price);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={i < rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          className={i < rating ? "text-warning" : "text-muted-foreground"}
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { addServerItem, addDemoItem } = useCart();

  const [product, setProduct] = useState<ProductWithAsset | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeRec, setSizeRec] = useState<SizeRecommendationResponse | null>(null);

  useEffect(() => {
    setProductLoading(true);
    setError("");
    // Reset size state so a stale size/rec from the previous product can't be
    // carried over (and later added to cart) when navigating between products.
    setSelectedSize(null);
    setSizeRec(null);
    api
      .get<ProductWithAsset>(`/api/products/${id}`)
      .then((p) => {
        setProduct({
          ...p,
          media: p.media ?? [],
          sizes: p.sizes ?? [],
          styleTags: p.styleTags ?? [],
          colorTags: p.colorTags ?? [],
        });
        setSelectedImage(0);
      })
      .catch(() => setError("Product not found."))
      .finally(() => setProductLoading(false));
  }, [id]);

  useEffect(() => {
    setReviewsLoading(true);
    api
      .get<PagedReviewResponse>(`/api/products/${id}/reviews`)
      .then((res) =>
        setReviews(
          res.content.map((r) => ({
            id: r.id,
            authorName: r.userName,
            rating: r.rating,
            body: r.comment,
            createdAt: r.createdAt,
          }))
        )
      )
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  // Recommended size — authed users only. Guests skip silently: an unauthenticated
  // 401 in api.ts would redirect a browsing guest to /login, which we must avoid.
  useEffect(() => {
    if (!user || !product) return;
    const controller = new AbortController();
    sizing
      .getRecommendedSize(product.id, controller.signal)
      .then((rec) => {
        setSizeRec(rec);
        // Only pre-select a recommendation that is actually stocked. Guarding on
        // product.sizes (the exact array SizeSelector renders, case-sensitive)
        // prevents an unstocked/mis-cased size from leaving the selector blank
        // while Add-to-Cart stays enabled (M5).
        const size = rec.recommendedSize;
        if (size && product.sizes?.includes(size)) {
          setSelectedSize((prev) => prev ?? size);
        }
      })
      .catch(() => {
        // Aborted, unauthorized, or endpoint unavailable — degrade gracefully (hide hint).
      });
    return () => controller.abort();
  }, [user, product]);

  async function handleAddToCart() {
    if (!product) return;
    setAdding(true);
    setAddedMessage("");
    const sizeToSend = selectedSize ?? "ONE_SIZE";
    try {
      if (user) {
        await addServerItem(product.id, 1, sizeToSend);
      } else {
        addDemoItem({
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.media?.[0] ?? null,
          selectedSize: sizeToSend,
        });
      }
      setAddedMessage("Added to cart!");
      setTimeout(() => setAddedMessage(""), 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        setAddedMessage(`Error: ${err.message}`);
      } else {
        setAddedMessage("Failed to add to cart.");
      }
    } finally {
      setAdding(false);
    }
  }

  if (error) {
    return (
      <>
        <NavBar />
        <PageShell>
          <div className="py-20 text-center text-muted-foreground">
            <p className="text-lg">{error}</p>
            <Link
              href="/products"
              className="mt-4 inline-block text-brand hover:underline"
            >
              Back to products
            </Link>
          </div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <PageShell>
        {productLoading ? (
          <div className="grid gap-10 md:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-card" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="mt-4 h-12 w-40 rounded-full" />
            </div>
          </div>
        ) : product ? (
          <div className="grid gap-10 md:grid-cols-2">
            {/* Image gallery */}
            <div className="flex flex-col gap-3">
              <div className="relative aspect-square w-full overflow-hidden rounded-card bg-muted">
                {product.media?.[selectedImage] ? (
                  <Image
                    src={product.media[selectedImage]}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="64"
                      height="64"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      aria-label="No image"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {product.media && product.media.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {product.media.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                        i === selectedImage
                          ? "border-brand"
                          : "border-transparent hover:border-border"
                      }`}
                    >
                      <Image
                        src={src}
                        alt={`${product.name} view ${i + 1}`}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="flex flex-col gap-4">
              <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {product.category.charAt(0) + product.category.slice(1).toLowerCase()}
              </span>

              <h1 className="font-display text-3xl font-semibold text-foreground leading-tight">
                {product.name}
              </h1>

              <p className="text-2xl font-semibold text-foreground">
                {formatPrice(product.price, product.currency)}
              </p>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>

              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Size</span>
                  {sizeRec && (
                    <RecommendedSizeHint
                      recommendedSize={sizeRec.recommendedSize}
                      basis={sizeRec.basis}
                    />
                  )}
                  <SizeSelector
                    sizes={product.sizes}
                    selectedSize={selectedSize}
                    onSelect={setSelectedSize}
                  />
                  {product.sizes.length > 0 && !selectedSize && (
                    <p className="text-xs text-muted-foreground">Please select a size</p>
                  )}
                </div>
              )}

              {/* Style tags */}
              {product.styleTags && product.styleTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.styleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Color tags */}
              {product.colorTags && product.colorTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.colorTags.map((color) => (
                    <span
                      key={color}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize"
                    >
                      {color}
                    </span>
                  ))}
                </div>
              )}

              {/* 3D/AR viewer */}
              {(product.assetStatus === "PENDING" || product.assetStatus === "RUNNING") ? (
                <p className="text-sm text-muted-foreground italic">3D model generating...</p>
              ) : (() => {
                const glbUrl = product.glbAssetUrl ?? product.glbUrl ?? null;
                const usdzUrl = product.usdzAssetUrl ?? undefined;
                return glbUrl ? (
                  <ViewerErrorBoundary>
                    <SmartARViewer
                      glbUrls={[glbUrl]}
                      usdzUrl={usdzUrl}
                      previewImageUrl={product.media?.[0] ?? undefined}
                    />
                  </ViewerErrorBoundary>
                ) : null;
              })()}

              {/* Add to cart */}
              <div className="mt-2 flex flex-col gap-2">
                <Button
                  onClick={handleAddToCart}
                  disabled={adding || (product.sizes && product.sizes.length > 0 && !selectedSize)}
                  className="w-fit rounded-full bg-brand px-8 py-3 text-primary-foreground hover:bg-brand-hover"
                >
                  {adding ? "Adding..." : "Add to Cart"}
                </Button>
                {addedMessage && (
                  <p
                    className={`text-sm ${
                      addedMessage.startsWith("Error") ||
                      addedMessage.startsWith("Failed")
                        ? "text-destructive"
                        : "text-success"
                    }`}
                  >
                    {addedMessage}
                  </p>
                )}
                {!user && (
                  <p className="text-xs text-muted-foreground">
                    Browsing as guest —{" "}
                    <Link href="/login" className="text-brand hover:underline">
                      sign in
                    </Link>{" "}
                    to save to your cart.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Reviews */}
        <div className="mt-16">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-6">
            Reviews
          </h2>

          {reviewsLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-card bg-card p-5 shadow-soft">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-1" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-card bg-card p-5 shadow-soft"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {review.authorName}
                    </span>
                    <StarRating rating={review.rating} />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {review.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}
