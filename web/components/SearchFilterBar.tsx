"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { FilterPill } from "@/components/design-system/FilterPill";
import { cn } from "@/lib/utils";

/** Shop filter pill keys — map onto the URL/query filter state in the page. */
export type ShopFilter =
  | "forYou"
  | "newIn"
  | "local"
  | "clothing"
  | "accessories";

const FILTER_PILLS: { key: ShopFilter; label: string }[] = [
  { key: "forYou", label: "For You" },
  { key: "newIn", label: "New In" },
  { key: "local", label: "Local Designers" },
  { key: "clothing", label: "Clothing" },
  { key: "accessories", label: "Accessories" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "createdAt,desc" },
  { label: "Price: Low → High", value: "price,asc" },
  { label: "Price: High → Low", value: "price,desc" },
] as const;

interface SearchFilterBarProps {
  activeFilter: ShopFilter;
  onFilter: (filter: ShopFilter) => void;
  sort: string;
  onSort: (sort: string) => void;
  count: number;
  className?: string;
}

export function SearchFilterBar({
  activeFilter,
  onFilter,
  sort,
  onSort,
  count,
  className,
}: SearchFilterBarProps) {
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Relevance";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      {/* Filter pills */}
      <div role="group" aria-label="Filter pieces" className="flex flex-wrap gap-2">
        {FILTER_PILLS.map((pill) => (
          <FilterPill
            key={pill.key}
            active={activeFilter === pill.key}
            onClick={() => onFilter(pill.key)}
          >
            {pill.label}
          </FilterPill>
        ))}
      </div>

      {/* Count + sort */}
      <div className="flex items-center gap-5">
        <span className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
          {count} {count === 1 ? "piece" : "pieces"}
        </span>
        <Select value={sort} onValueChange={onSort}>
          <SelectTrigger
            aria-label="Sort pieces"
            className="h-auto gap-1 border-0 bg-transparent p-0 text-[12px] font-medium uppercase tracking-[0.12px] text-foreground shadow-none focus:ring-0"
          >
            <span className="text-muted-foreground">SORT:</span>
            <span>{sortLabel}</span>
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
