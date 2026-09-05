"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, Pencil, Trash2, Sparkles, Plus } from "lucide-react";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { api, ApiError } from "@/lib/api";
import { getDemoLooks, removeDemoLook, type DemoLook } from "@/lib/demo-looks";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedLook {
  id: number;
  recommendationId: number;
  note: string | null;
  items: string[];
  createdAt: string;
  isDemo?: boolean;
}

// ── Look Card ─────────────────────────────────────────────────────────────────

function LookCard({
  look,
  index,
  onDelete,
  onNoteUpdate,
}: {
  look: SavedLook;
  index: number;
  onDelete: (id: number) => void;
  onNoteUpdate: (id: number, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [noteValue, setNoteValue] = useState(look.note ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formattedDate = new Date(look.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      if (!look.isDemo) {
        await api.delete(`/api/looks/${look.id}`);
      }
      onDelete(look.id);
    } catch {
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveNote() {
    setSaving(true);
    try {
      await api.put(`/api/looks/${look.id}`, { note: noteValue });
      onNoteUpdate(look.id, noteValue);
      setEditing(false);
    } catch {
      // Keep editing open on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="group flex flex-col gap-4 rounded-card bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-heavy"
      style={{
        opacity: 0,
        animation: "staggerIn 0.5s ease-out forwards",
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
        {look.isDemo && (
          <Badge
            variant="outline"
            className="rounded-full border-brand/30 text-brand text-[11px] px-2 py-0"
          >
            Demo
          </Badge>
        )}
      </div>

      {/* Items */}
      {look.items && look.items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {look.items.map((item, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground/60">
          No items recorded
        </p>
      )}

      {/* Note */}
      <div className="flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="What makes this look special?"
              className="resize-none text-sm bg-muted/50 border-border/50 focus:border-brand/40"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={saving}
                className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover text-xs h-7 px-3"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNoteValue(look.note ?? "");
                  setEditing(false);
                }}
                className="rounded-full text-xs h-7 px-3"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            className="w-full text-left rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
            onClick={() => setEditing(true)}
            aria-label="Edit note"
          >
            {look.note || (
              <span className="italic text-muted-foreground/40">
                Add a note...
              </span>
            )}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <div className="flex gap-4">
          <Link
            href={`/outfits/${look.recommendationId}/view`}
            className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover transition-colors"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </Link>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit
          </button>
        </div>
        <button
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          disabled={deleting}
          className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-40 ${
            confirmDelete
              ? "text-destructive font-medium"
              : "text-muted-foreground/40 hover:text-destructive/70"
          }`}
          title={confirmDelete ? "Click again to confirm" : "Delete look"}
          aria-label={confirmDelete ? "Confirm delete" : "Delete look"}
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          {deleting ? "..." : confirmDelete ? "Confirm?" : ""}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LooksPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();
    const demoLooks = getDemoLooks().map((dl: DemoLook): SavedLook => ({
      id: dl.id,
      recommendationId: dl.id,
      note: dl.note,
      items: [],
      createdAt: dl.savedAt,
      isDemo: true,
    }));
    api
      .get<SavedLook[]>("/api/looks", { signal: controller.signal })
      .then((serverLooks) => {
        setLooks([...serverLooks, ...demoLooks]);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLooks(demoLooks);
        setError(
          err instanceof ApiError ? err.message : "Failed to load looks.",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [authLoading, user]);

  function handleDelete(id: number) {
    if (id < 0) {
      removeDemoLook(id);
    }
    setLooks((prev) => prev.filter((l) => l.id !== id));
  }

  function handleNoteUpdate(id: number, note: string) {
    setLooks((prev) => prev.map((l) => (l.id === id ? { ...l, note } : l)));
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <NavBar />
      <PageShell>
        {/* Header */}
        <header className="mb-12 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              My Looks
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {loading
                ? "Loading your collection..."
                : looks.length > 0
                  ? `${looks.length} curated outfit${looks.length !== 1 ? "s" : ""} saved`
                  : "Your curated collection awaits"}
            </p>
          </div>
          <Link href="/chat" className="mt-4 sm:mt-0 shrink-0">
            <Button className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover gap-1.5 transition-all active:scale-[0.98]">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Look
            </Button>
          </Link>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-8 rounded-2xl bg-destructive/10 px-5 py-3.5 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 rounded-card bg-card p-6"
                style={{
                  opacity: 0,
                  animation: "staggerIn 0.5s ease-out forwards",
                  animationDelay: `${i * 80}ms`,
                }}
              >
                <Skeleton className="h-4 w-28" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="mt-auto h-px w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && looks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-6 py-28 text-center">
            <div className="relative">
              <div className="rounded-2xl bg-brand/8 p-6">
                <Sparkles
                  className="h-8 w-8 text-brand"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand/20 motion-safe:animate-editorial-float" />
            </div>
            <div className="max-w-sm">
              <p className="font-display text-2xl font-semibold text-foreground">
                Your lookbook starts here
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Chat with our AI Stylist to discover outfits curated for your
                style. Every look you save appears here.
              </p>
            </div>
            <Button
              asChild
              className="rounded-full bg-brand text-primary-foreground hover:bg-brand-hover gap-1.5 transition-all active:scale-[0.98]"
            >
              <Link href="/chat">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Start styling
              </Link>
            </Button>
          </div>
        )}

        {/* Cards grid */}
        {!loading && looks.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {looks.map((look, i) => (
              <LookCard
                key={look.id}
                look={look}
                index={i}
                onDelete={handleDelete}
                onNoteUpdate={handleNoteUpdate}
              />
            ))}
          </div>
        )}
      </PageShell>
      <Footer />
    </>
  );
}
