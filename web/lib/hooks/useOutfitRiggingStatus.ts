"use client";
import { useState, useEffect, useRef } from "react";
import { api, ApiError, type OutfitItem } from "@/lib/api";
import type { RiggingStatusResponse } from "@/lib/api";

interface UseOutfitRiggingStatusResult {
  items: OutfitItem[];
  pendingCount: number;
}

export function useOutfitRiggingStatus(
  initialItems: OutfitItem[]
): UseOutfitRiggingStatusResult {
  const [items, setItems] = useState<OutfitItem[]>(initialItems);
  // Track which product IDs are actively being rigged (PENDING or RUNNING)
  const [activeRigging, setActiveRigging] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync items when the *content* of initialItems changes (outfit reloaded).
  // Keyed on a content signature — NOT the array reference — because callers
  // legitimately pass an unstable array (e.g. `outfit?.items ?? []`, which is a
  // fresh [] every render while the outfit is still loading). Depending on the
  // raw reference here caused an infinite setItems→render→new-[]→effect loop
  // (hung the outfit viewer and the unit test).
  const initialItemsKey = initialItems
    .map((item) => `${item.productId}:${item.riggedGlbUrl ?? ""}`)
    .join("|");
  useEffect(() => {
    setItems(initialItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItemsKey]);

  useEffect(() => {
    const candidateItems = items.filter(
      (item) => !item.riggedGlbUrl && item.productId > 0
    );

    if (candidateItems.length === 0) {
      setActiveRigging(new Set());
      return;
    }

    const poll = async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      const updates: Record<number, string> = {};
      const nowActive = new Set<number>();

      await Promise.all(
        candidateItems.map(async (item) => {
          try {
            const data = await api.get<RiggingStatusResponse>(
              `/api/designer/products/${item.productId}/rigging-status`,
              { signal: controller.signal }
            );
            if (data.status === "READY" && data.riggedGlbUrl) {
              updates[item.productId] = data.riggedGlbUrl;
            } else if (data.status === "PENDING" || data.status === "RUNNING") {
              nowActive.add(item.productId);
            }
            // NONE, FAILED, or READY without URL → not actively rigging
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            // 403 (buyer), 404, or other errors → not actively rigging
          }
        })
      );

      if (controller.signal.aborted) return;

      setActiveRigging(nowActive);

      if (Object.keys(updates).length > 0) {
        setItems((prev) =>
          prev.map((item) =>
            updates[item.productId]
              ? { ...item, riggedGlbUrl: updates[item.productId] }
              : item
          )
        );
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    items
      .filter((item) => !item.riggedGlbUrl && item.productId > 0)
      .map((item) => item.productId)
      .join(","),
  ]);

  // Only count items confirmed to be actively rigging (PENDING/RUNNING)
  const pendingCount = activeRigging.size;

  return { items, pendingCount };
}
