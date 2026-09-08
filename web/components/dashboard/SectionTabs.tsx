"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_SECTIONS,
  type DashboardSection,
} from "./sections";

/**
 * Accessible tab list that drives the inline dashboard sections. Rendered twice:
 * once in the dark desktop rail (`variant="sidebar"`, vertical) and once as the
 * mobile pill strip (`variant="pills"`, horizontal). Both control the single
 * `#dashboard-panel` tabpanel. Tab ids are namespaced by `idPrefix` so the two
 * instances never collide.
 */
export function SectionTabs({
  active,
  onSelect,
  variant,
  idPrefix,
}: {
  active: DashboardSection;
  onSelect: (section: DashboardSection) => void;
  variant: "sidebar" | "pills";
  idPrefix: string;
}) {
  const isSidebar = variant === "sidebar";
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const count = DASHBOARD_SECTIONS.length;
    const current = DASHBOARD_SECTIONS.findIndex((s) => s.id === active);
    const nextKey = isSidebar ? "ArrowDown" : "ArrowRight";
    const prevKey = isSidebar ? "ArrowUp" : "ArrowLeft";

    let target = -1;
    if (e.key === nextKey) target = (current + 1) % count;
    else if (e.key === prevKey) target = (current - 1 + count) % count;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = count - 1;

    if (target >= 0) {
      e.preventDefault();
      const next = DASHBOARD_SECTIONS[target];
      onSelect(next.id);
      tabRefs.current[target]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      aria-orientation={isSidebar ? "vertical" : "horizontal"}
      onKeyDown={handleKeyDown}
      className={cn(
        isSidebar
          ? "flex flex-col gap-1"
          : "-mx-6 flex gap-2 overflow-x-auto px-6 pb-1"
      )}
    >
      {DASHBOARD_SECTIONS.map((section, i) => {
        const selected = section.id === active;
        return (
          <button
            key={section.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${section.id}`}
            aria-selected={selected}
            aria-controls="dashboard-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(section.id)}
            className={cn(
              "shrink-0 rounded-full text-[13px] font-medium transition-colors",
              isSidebar ? "px-4 py-2.5 text-left" : "px-4 py-2",
              selected
                ? "bg-brand text-primary-foreground"
                : isSidebar
                  ? "text-background/85 hover:bg-background/10 hover:text-background"
                  : "border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );
}
