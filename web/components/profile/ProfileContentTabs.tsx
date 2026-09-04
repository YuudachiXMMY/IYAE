"use client";

import { cn } from "@/lib/utils";
import type { DashboardTab } from "@/lib/profile-dashboard";

interface ProfileContentTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  postCounts?: Record<DashboardTab, number>;
}

const TABS: { key: DashboardTab; label: string }[] = [
  { key: "outfit-posts", label: "Outfit Posts" },
  { key: "saved", label: "Saved Outfits" },
  { key: "reposted", label: "Reposted" },
  { key: "tagged", label: "Tagged Looks" },
  { key: "archives", label: "Archives" },
];

export function ProfileContentTabs({
  activeTab,
  onTabChange,
  postCounts,
}: ProfileContentTabsProps) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
      {/* Tab pill buttons — horizontally scrollable on mobile */}
      <div
        role="tablist"
        className="rounded-[2.4rem] bg-card/80 backdrop-blur-xl p-1.5 flex gap-1 shadow-heavy overflow-x-auto scrollbar-none"
      >
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          const count = postCounts?.[key];

          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(key)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-150 flex items-center gap-1.5 active:scale-[0.97]",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums min-w-[1.25rem]",
                    isActive
                      ? "bg-background/20 text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
