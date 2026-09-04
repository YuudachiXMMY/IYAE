"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PromotionResponse } from "@/lib/api";

interface PromotionListProps {
  promotions: PromotionResponse[];
  onEdit: (promotion: PromotionResponse) => void;
  onDelete: (id: number) => void;
  deleting: number | null;
}

function slotBadgeClass(slotType: string) {
  return slotType === "FEATURED"
    ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
    : "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400";
}

function isActive(p: PromotionResponse): boolean {
  const now = Date.now();
  return p.active && new Date(p.startAt).getTime() <= now && new Date(p.endAt).getTime() >= now;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PromotionList({ promotions, onEdit, onDelete, deleting }: PromotionListProps) {
  if (promotions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="rounded-full bg-muted p-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden="true">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">No promotions yet. Create one to feature your products.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {promotions.map((p) => {
        const active = isActive(p);
        return (
          <Card key={p.id} className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-foreground line-clamp-2">{p.productName}</p>
              <Badge
                variant="outline"
                className={`shrink-0 rounded-full text-xs ${slotBadgeClass(p.slotType)}`}
              >
                {p.slotType}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Weight: <span className="font-medium text-foreground">{p.weight}</span></span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                {active ? "Active" : "Inactive"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {formatDate(p.startAt)} — {formatDate(p.endAt)}
            </p>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(p)}
                className="rounded-full border-border text-xs"
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(p.id)}
                disabled={deleting === p.id}
                className="rounded-full text-xs text-muted-foreground hover:text-destructive"
              >
                {deleting === p.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
