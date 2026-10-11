"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LocalImagePicker } from "@/components/profile/LocalImagePicker";
import type { CreatePostInput, PostType, ProductLink } from "@/lib/community-feed";
import { api, posts as postsApi, ApiError, type CreatePostPayload } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Image,
  Sparkles,
  Camera,
  Smartphone,
  Search,
  X,
  Upload,
  type LucideIcon,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  imageUrl?: string;
}

interface CreateFashionPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePostInput) => void;
  currentUsername: string;
  currentDisplayName: string;
}

const SOURCE_TABS: { key: PostType; label: string; icon: LucideIcon }[] =
  [
    { key: "outfit_photo", label: "Outfit Photo", icon: Image },
    { key: "ai_outfit", label: "AI Outfit", icon: Sparkles },
    { key: "wearing_it", label: "Wearing It", icon: Camera },
    { key: "ar_try_on", label: "AR Try-On", icon: Smartphone },
  ];

export function CreateFashionPostDialog({
  open,
  onOpenChange,
  onSubmit,
  currentUsername,
  currentDisplayName,
}: CreateFashionPostDialogProps) {
  const [postType, setPostType] = useState<PostType>("outfit_photo");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  // `null` until the catalogue request settles — the loading flag reads off that
  // rather than being flipped either side of the fetch.
  const [allProducts, setAllProducts] = useState<Product[] | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductLink[]>([]);
  const loadingProducts = allProducts === null;
  // Phase 6 — Share-a-Look bindings + named-feed dimensions
  const [topic, setTopic] = useState("");
  const [city, setCity] = useState("");
  const [savedLooks, setSavedLooks] = useState<{ id: number; note: string | null }[]>([]);
  const [selectedLookId, setSelectedLookId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchProducts = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const response = await api.get<{ content: Product[] }>("/api/products", {
        signal: abortRef.current.signal,
      });
      setAllProducts(response?.content ?? []);
    } catch {
      // Silently ignore abort or fetch errors, but still settle the loading
      // state — keeping anything already fetched rather than clearing it.
      setAllProducts((prev) => prev ?? []);
    }
  }, []);

  const fetchLooks = useCallback(
    () =>
      api
        .get<{ id: number; note: string | null }[]>("/api/looks")
        .then((looks) => setSavedLooks(looks ?? []))
        .catch(() => {
          // Silently ignore — Share-a-Look binding is optional
        }),
    []
  );

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchLooks();
    }
  }, [open, fetchProducts, fetchLooks]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const query = productSearch.trim().toLowerCase();
      if (!query) {
        setFilteredProducts(allProducts ?? []);
        return;
      }
      setFilteredProducts(
        (allProducts ?? []).filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.brand.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        )
      );
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch, allProducts]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = tagInput.trim();
      if (value && !tags.includes(value)) {
        setTags([...tags, value]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const toggleProduct = (product: Product) => {
    const alreadySelected = selectedProducts.some(
      (p) => p.productId === product.id
    );
    if (alreadySelected) {
      setSelectedProducts(
        selectedProducts.filter((p) => p.productId !== product.id)
      );
    } else {
      const link: ProductLink = {
        id: String(product.id),
        label: product.name,
        href: `/products/${product.id}`,
        productId: product.id,
      };
      setSelectedProducts([...selectedProducts, link]);
    }
  };

  const isProductSelected = (productId: number) =>
    selectedProducts.some((p) => p.productId === productId);

  const resetForm = () => {
    setPostType("outfit_photo");
    setSelectedImage(null);
    setCaption("");
    setTagInput("");
    setTags([]);
    setProductSearch("");
    setSelectedProducts([]);
    setFilteredProducts(allProducts ?? []);
    setTopic("");
    setCity("");
    setSelectedLookId(null);
  };

  const handleSubmit = async () => {
    if (!selectedImage || !caption.trim() || submitting) return;

    // Keep the optimistic local feed update (dashboard/community show it instantly)
    const input: CreatePostInput = {
      creatorUsername: currentUsername,
      creatorName: currentDisplayName,
      image: selectedImage,
      caption: caption.trim(),
      type: postType,
      tags,
      productLinks: selectedProducts,
    };

    // Persist through the server (Share-a-Look binds a saved look + real products + feed dimensions)
    const payload: CreatePostPayload = {
      content: caption.trim(),
      mediaUrls: selectedImage ? [selectedImage] : [],
      savedLookId: selectedLookId ?? undefined,
      productIds: selectedProducts.map((p) => String(p.productId ?? p.id)),
      topic: topic.trim() || undefined,
      city: city.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await postsApi.create(payload);
      onSubmit(input);
      toast.success("Post shared!");
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not share post");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(selectedImage) && caption.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-[2rem] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Create Fashion Post
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-2">
          {/* Left column — Media Upload */}
          <div className="flex flex-col gap-4">
            {/* Source Type Tabs */}
            <Tabs
              value={postType}
              onValueChange={(v) => setPostType(v as PostType)}
            >
              <TabsList className="flex flex-wrap gap-1 h-auto bg-transparent p-0">
                {SOURCE_TABS.map(({ key, label, icon: Icon }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      "data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground",
                      "data-[state=inactive]:bg-background data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-border"
                    )}
                  >
                    <Icon size={13} />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {SOURCE_TABS.map(({ key }) => (
                <TabsContent key={key} value={key} className="mt-4">
                  {!selectedImage ? (
                    <LocalImagePicker
                      onSelect={setSelectedImage}
                      maxDimension={1200}
                      label="Choose a photo for your post"
                    >
                      <div className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors aspect-[4/5]">
                        <Upload
                          size={32}
                          className="text-muted-foreground"
                        />
                        <p className="text-sm text-muted-foreground">
                          Click to upload
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPEG, PNG, or WebP
                        </p>
                      </div>
                    </LocalImagePicker>
                  ) : (
                    <div className="relative">
                      <img
                        src={selectedImage}
                        alt="Preview"
                        className="w-full rounded-2xl object-cover"
                        style={{ aspectRatio: "4/5" }}
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-2 right-2 bg-foreground text-background rounded-full p-1 hover:opacity-80 transition-opacity"
                        aria-label="Remove image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Right column — Post Metadata */}
          <div className="flex flex-col gap-4">
            {/* Caption */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Caption
              </label>
              <Textarea
                placeholder="Describe the fit, vibe, and where you'd wear it..."
                rows={4}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="resize-none rounded-xl"
              />
            </div>

            {/* Style Tags */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Style Tags
              </label>
              <Input
                placeholder="Minimalist, Date night, Streetwear"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="rounded-xl"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove ${tag}`}
                        className="hover:text-destructive transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Share a saved look (optional) */}
            {savedLooks.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Share a saved look
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {savedLooks.map((look) => (
                    <button
                      key={look.id}
                      type="button"
                      onClick={() =>
                        setSelectedLookId((prev) => (prev === look.id ? null : look.id))
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        selectedLookId === look.id
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {look.note?.trim() || `Look #${look.id}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Named-feed dimensions (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Topic</label>
                <Input
                  placeholder="body-confidence"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">City</label>
                <Input
                  placeholder="Toronto"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Tag {BRAND} Products */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Tag {BRAND.name} Products
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-8 rounded-xl"
                />
              </div>

              <ScrollArea className="h-40 rounded-xl border border-border">
                {loadingProducts ? (
                  <div className="flex items-center justify-center h-full py-6">
                    <p className="text-xs text-muted-foreground">
                      Loading products...
                    </p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-6">
                    <p className="text-xs text-muted-foreground">
                      No products found
                    </p>
                  </div>
                ) : (
                  <div className="p-2 flex flex-col gap-1">
                    {filteredProducts.map((product) => {
                      const selected = isProductSelected(product.id);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => toggleProduct(product)}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2 rounded-lg text-left text-xs transition-colors",
                            selected
                              ? "bg-foreground text-background"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-medium truncate">
                              {product.name}
                            </span>
                            <span
                              className={cn(
                                "truncate",
                                selected
                                  ? "opacity-70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {product.brand} &middot; {product.category}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "ml-2 shrink-0 font-medium",
                              selected ? "opacity-70" : "text-muted-foreground"
                            )}
                          >
                            ${product.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedProducts.map((p) => (
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                    >
                      {p.label}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedProducts(
                            selectedProducts.filter((sp) => sp.id !== p.id)
                          )
                        }
                        aria-label={`Remove ${p.label}`}
                        className="hover:text-destructive transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="rounded-full bg-foreground text-background w-full py-3 mt-auto hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {submitting ? "Sharing…" : "Share Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
