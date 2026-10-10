"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import {
  admin,
  adminReports,
  ApiError,
  type AdminProduct,
  type AdminProductStatus,
  type AdminPost,
  type AdminPostStatus,
  type PostReport,
  type CommunityReportStatus,
  type PromotionResponse,
  type PromotionSlotType,
} from "@/lib/api";
import { toast } from "sonner";

const PRODUCT_TABS = ["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as const;
const POST_TABS = ["ALL", "ACTIVE", "ARCHIVED", "PENDING_DELETE"] as const;
const REPORT_TABS = ["OPEN", "RESOLVED", "DISMISSED"] as const;

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(price);
}

function title(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
      {status.replace("_", " ")}
    </Badge>
  );
}

// ── One moderation list ─────────────────────────────────────────────────────────

interface AdminList<T> {
  items: T[];
  /**
   * Set when the load failed. Rendered *in place of* the list, because to a
   * moderator "nothing to review" and "we could not find out" are opposite
   * answers and only one of them means they can stop looking.
   */
  error: string | null;
  loading: boolean;
  setItems: Dispatch<SetStateAction<T[]>>;
  retry: () => void;
}

/**
 * One moderation list, owned by the effect that loaded it.
 *
 * All four sections of this console carried their own copy of
 * `try { setX(await …) } catch { setX([]) }`. Two faults came with it, four
 * times over:
 *
 *  - A failed request — an outage, a 403 from an expired session — rendered as
 *    "No posts." An admin reading that concludes the queue is clear.
 *  - Nothing cancelled a superseded request. `loading` is derived as "what is
 *    loaded is not what is wanted", so a stale reply landing *after* the current
 *    one both showed the wrong rows and pinned the section on "Loading…", with
 *    no further effect run left to correct it. (Same shape as the product grid's
 *    stuck LOAD MORE.)
 *
 * `load` is the key: callers memoise it on whatever the request depends on (the
 * tab), the way `useRiggingStatus` keys on its own loader.
 */
function useAdminList<T>(load: (signal: AbortSignal) => Promise<T[]>): AdminList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Identity of the request currently wanted; `retry` mints a new one.
  const request = useMemo(() => ({ load, attempt }), [load, attempt]);
  const [loaded, setLoaded] = useState<typeof request | null>(null);
  const loading = loaded !== request;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await request.load(controller.signal);
        if (controller.signal.aborted) return;
        setItems(next);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn’t load this list. Check your connection and try again."
        );
      } finally {
        if (!controller.signal.aborted) setLoaded(request);
      }
    })();
    return () => controller.abort();
  }, [request]);

  return {
    items,
    error,
    loading,
    setItems,
    retry: () => setAttempt((n) => n + 1),
  };
}

function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-card border border-destructive/40 bg-destructive/5 p-4"
    >
      <p className="min-w-0 flex-1 text-sm text-destructive">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

// ── Catalog moderation ──────────────────────────────────────────────────────────

function CatalogModeration() {
  const [tab, setTab] = useState<(typeof PRODUCT_TABS)[number]>("ALL");
  const [confirm, setConfirm] = useState<AdminProduct | null>(null);

  const load = useCallback(
    (signal: AbortSignal) =>
      admin.listProducts(tab === "ALL" ? undefined : (tab as AdminProductStatus), signal),
    [tab]
  );
  const {
    items: products,
    error,
    loading,
    setItems: setProducts,
    retry,
  } = useAdminList(load);

  async function setStatus(p: AdminProduct, status: AdminProductStatus) {
    try {
      const updated = await admin.setProductStatus(p.id, status);
      setProducts((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      toast.success(`"${p.name}" set to ${title(status)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRODUCT_TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={t === tab ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setTab(t)}
          >
            {title(t)}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ListError message={error} onRetry={retry} />
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 rounded-card border border-border/60 bg-card">
          {products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.designerDisplayName ?? "—"}
                  {p.designerLocal ? " · Local" : ""} · {formatPrice(p.price, p.currency)}
                </p>
              </div>
              <StatusBadge status={p.status} />
              <div className="flex gap-1.5">
                {p.status !== "PUBLISHED" && (
                  <Button size="sm" variant="outline" onClick={() => void setStatus(p, "PUBLISHED")}>
                    Publish
                  </Button>
                )}
                {p.status === "PUBLISHED" && (
                  <Button size="sm" variant="outline" onClick={() => void setStatus(p, "DRAFT")}>
                    Unpublish
                  </Button>
                )}
                {p.status !== "ARCHIVED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setConfirm(p)}
                  >
                    Archive
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive product?</DialogTitle>
            <DialogDescription>
              “{confirm?.name}” will be hidden from the public catalog. You can republish it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm) void setStatus(confirm, "ARCHIVED");
                setConfirm(null);
              }}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Community moderation ─────────────────────────────────────────────────────────

function CommunityModeration() {
  const [tab, setTab] = useState<(typeof POST_TABS)[number]>("ACTIVE");
  const [confirm, setConfirm] = useState<AdminPost | null>(null);

  const load = useCallback(
    (signal: AbortSignal) =>
      admin.listPosts(tab === "ALL" ? undefined : (tab as AdminPostStatus), signal),
    [tab]
  );
  const {
    items: posts,
    error,
    loading,
    setItems: setPosts,
    retry,
  } = useAdminList(load);

  async function archive(post: AdminPost) {
    try {
      const updated = await admin.archivePost(post.id);
      setPosts((prev) => prev.map((x) => (x.id === post.id ? updated : x)));
      toast.success("Post archived");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Archive failed");
    }
  }

  async function remove(post: AdminPost) {
    try {
      const updated = await admin.removePost(post.id);
      setPosts((prev) => prev.map((x) => (x.id === post.id ? updated : x)));
      toast.success("Post removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Remove failed");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {POST_TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={t === tab ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setTab(t)}
          >
            {title(t)}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ListError message={error} onRetry={retry} />
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 rounded-card border border-border/60 bg-card">
          {posts.map((post) => (
            <div key={post.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-foreground">
                  {post.content?.trim() || (
                    <span className="italic text-muted-foreground">No text</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {post.authorName ?? post.authorUsername ?? `User #${post.authorId}`}
                </p>
              </div>
              <StatusBadge status={post.status} />
              <div className="flex gap-1.5">
                {post.status === "ACTIVE" && (
                  <Button size="sm" variant="outline" onClick={() => void archive(post)}>
                    Archive
                  </Button>
                )}
                {post.status !== "PENDING_DELETE" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setConfirm(post)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove post?</DialogTitle>
            <DialogDescription>
              This flags the post for deletion and hides it from the community feed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm) void remove(confirm);
                setConfirm(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Promotion moderation ─────────────────────────────────────────────────────────

function PromotionModeration() {
  const load = useCallback((signal: AbortSignal) => admin.listPromotions(signal), []);
  const {
    items: promos,
    error,
    loading,
    setItems: setPromos,
    retry,
  } = useAdminList(load);

  async function setSlot(promo: PromotionResponse, slotType: PromotionSlotType) {
    try {
      const updated = await admin.setPromotionSlot(promo.id, slotType);
      setPromos((prev) => prev.map((x) => (x.id === promo.id ? updated : x)));
      toast.success(`Promotion set to ${title(slotType)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ListError message={error} onRetry={retry} />
      ) : promos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No promotions.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 rounded-card border border-border/60 bg-card">
          {promos.map((promo) => (
            <div key={promo.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {promo.productName ?? `Product #${promo.productId}`}
                </p>
                <p className="text-xs text-muted-foreground">Weight {promo.weight}</p>
              </div>
              <StatusBadge status={promo.slotType} />
              <div className="flex gap-1.5">
                {promo.slotType !== "FEATURED" && (
                  <Button size="sm" variant="outline" onClick={() => void setSlot(promo, "FEATURED")}>
                    Feature
                  </Button>
                )}
                {promo.slotType === "FEATURED" && (
                  <Button size="sm" variant="outline" onClick={() => void setSlot(promo, "SPONSORED")}>
                    Unfeature
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Report queue ─────────────────────────────────────────────────────────────────

function ReportsModeration() {
  const [tab, setTab] = useState<(typeof REPORT_TABS)[number]>("OPEN");
  const [confirm, setConfirm] = useState<PostReport | null>(null);

  const load = useCallback(
    // adminReports.list returns Paged<PostReport> — read .content (unlike the bare-array admin.* calls).
    async (signal: AbortSignal) =>
      (await adminReports.list(tab as CommunityReportStatus, 0, 20, signal)).content,
    [tab]
  );
  const {
    items: reports,
    error,
    loading,
    setItems: setReports,
    retry,
  } = useAdminList(load);

  async function resolve(
    report: PostReport,
    status: CommunityReportStatus,
    removePost: boolean
  ) {
    try {
      const updated = await adminReports.resolve(report.id, status, removePost);
      setReports((prev) => prev.map((x) => (x.id === report.id ? updated : x)));
      toast.success(removePost ? "Report resolved · post removed" : `Report ${title(status)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={t === tab ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setTab(t)}
          >
            {title(t)}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ListError message={error} onRetry={retry} />
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 rounded-card border border-border/60 bg-card">
          {reports.map((report) => (
            <div key={report.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-foreground">{report.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Reported by {report.reporterUsername} · post #{report.postId}
                </p>
              </div>
              <StatusBadge status={report.status} />
              {report.status === "OPEN" && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => void resolve(report, "RESOLVED", false)}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void resolve(report, "DISMISSED", false)}>
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setConfirm(report)}
                  >
                    Resolve &amp; remove post
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove reported post?</DialogTitle>
            <DialogDescription>
              This resolves the report and flags the post for deletion, hiding it from every feed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm) void resolve(confirm, "RESOLVED", true);
                setConfirm(null);
              }}
            >
              Resolve &amp; remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPage() {
  const { user, loading } = useRequireAuth("ADMIN");

  if (loading || !user || user.role !== "ADMIN") {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="h-40 animate-pulse rounded-card bg-muted" />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold text-foreground md:text-5xl">
            Moderation
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Govern catalog, community, and promotions across the marketplace.
          </p>
        </div>

        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="promotions">Promotions</TabsTrigger>
          </TabsList>
          <TabsContent value="catalog">
            <CatalogModeration />
          </TabsContent>
          <TabsContent value="community">
            <CommunityModeration />
          </TabsContent>
          <TabsContent value="reports">
            <ReportsModeration />
          </TabsContent>
          <TabsContent value="promotions">
            <PromotionModeration />
          </TabsContent>
        </Tabs>
      </PageShell>
    </>
  );
}
