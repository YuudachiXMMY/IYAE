"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const FALLBACK_CATEGORIES = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Outerwear",
  "Shoes",
  "Accessories",
  "Bags",
  "Jewelry",
];

const SORT_OPTIONS = [
  { label: "Newest", value: "createdAt,desc" },
  { label: "Price: Low → High", value: "price,asc" },
  { label: "Price: High → Low", value: "price,desc" },
] as const;

interface SearchFilterBarProps {
  onSearch: (query: string) => void;
  onCategory: (category: string) => void;
  onSort: (sort: string) => void;
  onLocal?: (next: boolean) => void;
  localActive?: boolean;
  className?: string;
}

export function SearchFilterBar({
  onSearch,
  onCategory,
  onSort,
  onLocal,
  localActive = false,
  className,
}: SearchFilterBarProps) {
  const [rawQuery, setRawQuery] = useState("");
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const debouncedQuery = useDebounce(rawQuery, 300);

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

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    <div
      role="search"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      {/* Search input */}
      <div className="relative flex-1">
        <MagnifyingGlass
          size={18}
          weight="regular"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder="Search products..."
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          aria-label="Search products"
          className="h-10 w-full rounded-full bg-card pl-11 pr-4 shadow-soft placeholder:text-muted-foreground"
        />
      </div>

      {/* Category filter */}
      <Select
        defaultValue="All"
        onValueChange={(val) => onCategory(val === "All" ? "" : val)}
      >
        <SelectTrigger aria-label="Filter by category" className="h-10 w-full rounded-full bg-card shadow-soft sm:w-44">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        defaultValue="createdAt,desc"
        onValueChange={(val) => onSort(val)}
      >
        <SelectTrigger aria-label="Sort products" className="h-10 w-full rounded-full bg-card shadow-soft sm:w-52">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Local designers toggle */}
      {onLocal && (
        <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-card px-4 shadow-soft">
          <Checkbox
            checked={localActive}
            onCheckedChange={(v) => onLocal(v === true)}
            aria-label="Show only local designers"
          />
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            Local designers
          </span>
        </label>
      )}
    </div>
  );
}
