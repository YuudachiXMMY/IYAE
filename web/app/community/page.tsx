"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getFeedByTab,
  toggleLike,
  toggleSave,
  toggleRepost,
  toggleFollow,
  updatePostInState,
  buildOutfitGeneratorHref,
  toSocialPost,
  type SocialPost,
  type CommunityTab,
  type PersistedCommunityState,
} from "@/lib/community-feed";
import {
  loadCommunityStateFor,
  useCommunityStatePersistence,
} from "@/lib/hooks/useCommunityState";
import { findSocialProfile } from "@/lib/social-graph";
import {
  posts as postsApi,
  follows as followsApi,
  type CommunityFeedType,
} from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { PostDetailDialog } from "@/components/PostDetailDialog";
import { CreateFashionPostDialog } from "@/components/profile/CreateFashionPostDialog";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { SectionKicker } from "@/components/design-system/SectionKicker";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { FilterPill } from "@/components/design-system/FilterPill";
import { AbstractForm } from "@/components/design-system/AbstractForm";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  Compass,
  Heart,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { cn, humanizeNumber } from "@/lib/utils";
import { PostMedia } from "@/components/community/PostMedia";

// The four server-backed named feeds hit GET /api/posts?feed=; saved/reposted stay LOCAL.
const SERVER_FEEDS: CommunityFeedType[] = ["following", "discover", "toronto", "body-confidence"];

function isServerFeed(tab: CommunityTab): tab is CommunityFeedType {
  return (SERVER_FEEDS as string[]).includes(tab);
}

/** Relative label for a server ISO timestamp; demo posts already carry a short label. */
function formatPostedAt(postedAt: string): string {
  const t = Date.parse(postedAt);
  if (Number.isNaN(t)) return `${postedAt} ago`;
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Phase 6: four named server feeds first, then the local personal collections.
const TABS: { key: CommunityTab; label: string }[] = [
  { key: "following", label: "Following" },
  { key: "discover", label: "Discover" },
  { key: "toronto", label: "Toronto" },
  { key: "body-confidence", label: "Body confidence" },
  { key: "saved", label: "Saved" },
  { key: "reposted", label: "Reposted" },
];

const EMPTY_STATE: Record<
  CommunityTab,
  { icon: typeof Sparkles; title: string; description: string }
> = {
  "for-you": {
    icon: Sparkles,
    title: "Nothing here yet",
    description: "Check back soon for fresh style inspiration.",
  },
  discover: {
    icon: Sparkles,
    title: "Nothing to discover yet",
    description: "Be the first to share a look with the community.",
  },
  following: {
    icon: Compass,
    title: "Your Following feed is empty",
    description: "Follow people to fill your Following feed.",
  },
  toronto: {
    icon: MapPin,
    title: "No Toronto looks yet",
    description: "Local style from your city will show up here.",
  },
  "body-confidence": {
    icon: HeartHandshake,
    title: "No body-confidence posts yet",
    description: "A space for honest, real-body style. Share yours.",
  },
  saved: {
    icon: Bookmark,
    title: "No saved posts yet",
    description: "Tap the bookmark on any post to save it for later.",
  },
  reposted: {
    icon: Repeat2,
    title: "No reposts yet",
    description: "Share looks you love by reposting them.",
  },
};

// Very-low burgundy tint over the card surface — the FORME editorial card fill.
const CARD_TINT = "color-mix(in srgb, var(--color-brand) 5%, var(--color-card))";

interface PostCardProps {
  post: SocialPost;
  state: { followedUsernames: string[]; posts: SocialPost[] };
  index: number;
  onPostUpdate: (updatedPost: SocialPost) => void;
  onToggleLike: (post: SocialPost) => void;
  onToggleFollow: (post: SocialPost) => void;
  onOpenDetail: (post: SocialPost) => void;
}

function PostCard({
  post,
  state,
  index,
  onPostUpdate,
  onToggleLike,
  onToggleFollow,
  onOpenDetail,
}: PostCardProps) {
  const isFollowing = state.followedUsernames.includes(post.creatorUsername);
  const profile = findSocialProfile(post.creatorUsername);
  const commentTotal = post.commentCount ?? post.comments.length;
  // "location · occasion" — real profile location + the post's first tag.
  const subline = [profile?.location, post.tags[0]].filter(Boolean).join(" · ");

  return (
    <article
      className="animate-stagger-in flex flex-col rounded-[28px] border border-border/60 p-4 shadow-soft transition-transform duration-300 hover:-translate-y-0.5"
      style={{ backgroundColor: CARD_TINT, animationDelay: `${index * 60}ms` }}
    >
      {/* Header: avatar chip + name + location · occasion */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-background"
        >
          {post.creatorName.charAt(0)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={post.ownedByCurrentUser ? "/dashboard" : `/profile/${post.creatorUsername}`}
              className="truncate font-body text-sm font-semibold text-foreground hover:text-brand"
            >
              {post.creatorName}
            </Link>
            {profile?.isVerified && (
              <BadgeCheck size={14} className="shrink-0 text-brand" aria-label="Verified" role="img" />
            )}
          </div>
          {subline && (
            <p className="truncate text-xs text-muted-foreground">{subline}</p>
          )}
        </div>

        {!post.ownedByCurrentUser && (
          <button
            onClick={() => onToggleFollow(post)}
            className={cn(
              "rounded-chip px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12px] transition-colors",
              isFollowing
                ? "border border-border text-muted-foreground hover:border-foreground/40"
                : "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>

      {/* Image area — white rounded inner frame (AbstractForm placeholder when no media) */}
      <div className="mt-4 rounded-[24px] bg-background p-2">
        {post.image ? (
          <PostMedia
            src={post.image}
            alt={`Post by ${post.creatorName}`}
            className="rounded-[18px]"
          />
        ) : (
          <AbstractForm tint={20} rounded="rounded-[18px]" className="aspect-[4/5] w-full" />
        )}
      </div>

      {/* Engagement row */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => onToggleLike(post)}
          aria-label="Like"
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors",
            post.likedByCurrentUser
              ? "text-brand"
              : "text-muted-foreground hover:text-brand"
          )}
        >
          <Heart size={18} fill={post.likedByCurrentUser ? "currentColor" : "none"} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {humanizeNumber(post.likeCount)}
          </span>
        </button>
        <button
          onClick={() => onOpenDetail(post)}
          aria-label="Comments"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageCircle size={18} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {humanizeNumber(commentTotal)}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onPostUpdate(toggleSave(post))}
            aria-label="Save"
            className={cn(
              "rounded-full p-1.5 transition-colors",
              post.savedByCurrentUser
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bookmark size={17} fill={post.savedByCurrentUser ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onPostUpdate(toggleRepost(post))}
            aria-label="Repost"
            className={cn(
              "rounded-full p-1.5 transition-colors",
              post.repostedByCurrentUser
                ? "text-brand"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Repeat2 size={17} />
          </button>
          <button
            onClick={() => toast.message("Post copied for sharing")}
            aria-label="Share"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowUpRight size={17} />
          </button>
        </div>
      </div>

      {/* Caption */}
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        <Link
          href={post.ownedByCurrentUser ? "/dashboard" : `/profile/${post.creatorUsername}`}
          className="font-semibold hover:text-brand"
        >
          @{post.creatorUsername}
        </Link>{" "}
        {post.caption}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">{formatPostedAt(post.postedAt)}</p>

      {commentTotal > 0 ? (
        <button
          onClick={() => onOpenDetail(post)}
          className="mt-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          View all {commentTotal} comments
        </button>
      ) : (
        <button
          onClick={() => onOpenDetail(post)}
          className="mt-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Add a comment...
        </button>
      )}

      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-chip bg-muted px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <Link
          href={buildOutfitGeneratorHref(post, "shop")}
          className="flex-1 rounded-button border border-border py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          Shop This Look
        </Link>
        <Link
          href={buildOutfitGeneratorHref(post, "similar")}
          className="flex-1 rounded-button bg-foreground py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12px] text-background transition-colors hover:bg-foreground/90"
        >
          Generate Similar
        </Link>
      </div>
    </article>
  );
}

export default function CommunityPage() {
  const { user } = useAuth();
  // Keyed on the viewer so the per-user local feed can be seeded from
  // localStorage in a lazy initialiser: signing in remounts the feed instead of
  // loading it from an effect.
  return <CommunityFeed key={user ? user.id : "guest"} user={user} />;
}

function CommunityFeed({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  // Seeded through the shared loader so this surface and `useCommunityState`
  // (the dashboard's) cannot drift apart on how a viewer maps to their stored
  // feed — they share one storage entry.
  const [state, setState] = useState<PersistedCommunityState | null>(() =>
    loadCommunityStateFor(user)
  );
  const [activeTab, setActiveTab] = useState<CommunityTab>("discover");
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  // Server feed (the 4 named feeds), stored with the key it was fetched for.
  // `posts: null` = loaded but fell back to the local demo layer; a key mismatch
  // is what "still loading" means, which keeps the fetch effect setState-free.
  const [feed, setFeed] = useState<{ key: string; posts: SocialPost[] | null } | null>(
    null
  );
  const feedKey =
    user && isServerFeed(activeTab) ? `${user.id}:${activeTab}:${feedRefreshKey}` : null;
  const feedPosts = feed && feed.key === feedKey ? feed.posts : null;
  const feedLoading = feedKey !== null && feed?.key !== feedKey;

  useCommunityStatePersistence(user, state);

  // Fetch the selected server feed; degrade gracefully to the localStorage demo on error/offline.
  useEffect(() => {
    if (!user || !feedKey || !isServerFeed(activeTab)) return;
    const ctrl = new AbortController();
    postsApi
      .feed(activeTab, 0, 20, ctrl.signal)
      .then((res) =>
        setFeed({
          key: feedKey,
          posts: res.content.map((sp) => {
            const p = toSocialPost(sp);
            // Stamp ownership so a user's own posts never render a self-Follow button / self-follow call.
            return { ...p, ownedByCurrentUser: p.creatorUserId === user.id };
          }),
        })
      )
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setFeed({ key: feedKey, posts: null }); // fall back to the local demo layer (unauth / offline / 404)
      });
    return () => ctrl.abort();
  }, [user, activeTab, feedKey]);

  // Patch the loaded server feed; a no-op while it is loading or has fallen back
  // to the local layer, exactly as the old `prev ? … : prev` guard was.
  function patchFeedPosts(map: (posts: SocialPost[]) => SocialPost[]) {
    setFeed((prev) => (prev?.posts ? { ...prev, posts: map(prev.posts) } : prev));
  }

  function handlePostUpdate(updatedPost: SocialPost) {
    setState((prev) => (prev ? updatePostInState(prev, updatedPost) : prev));
    patchFeedPosts((posts) =>
      posts.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  }

  // Like write-through: real server posts hit POST/DELETE /like; demo posts stay local.
  function handleToggleLike(post: SocialPost) {
    handlePostUpdate(toggleLike(post)); // optimistic (toggleLike spreads — preserves save/repost/comments)
    if (post.serverId == null) return;
    const req = post.likedByCurrentUser
      ? postsApi.unlike(post.serverId)
      : postsApi.like(post.serverId);
    req
      .then((server) => {
        // Merge ONLY the like fields; a wholesale toSocialPost replace would clobber the user's
        // local save/repost highlights and the commentCount.
        const patch = (p: SocialPost): SocialPost =>
          p.id === post.id
            ? { ...p, likeCount: server.likeCount, likedByCurrentUser: server.likedByCurrentUser }
            : p;
        patchFeedPosts((posts) => posts.map(patch));
        setState((prev) => (prev ? { ...prev, posts: prev.posts.map(patch) } : prev));
      })
      .catch(() => handlePostUpdate(post)); // revert to the pre-toggle state
  }

  // Real follow for server-backed post authors; optimistic local mirror + revert on failure.
  function handleToggleFollowReal(post: SocialPost) {
    const username = post.creatorUsername;
    const currentlyFollowing = state?.followedUsernames.includes(username) ?? false;
    setState((prev) => (prev ? toggleFollow(prev, username) : prev));
    if (post.creatorUserId == null) return;
    const req = currentlyFollowing
      ? followsApi.remove(post.creatorUserId)
      : followsApi.toggle(post.creatorUserId);
    req.catch(() =>
      setState((prev) => (prev ? toggleFollow(prev, username) : prev))
    );
  }

  function handleOpenDetail(post: SocialPost) {
    setSelectedPost(post);
  }

  // Demo seeds are tagged "for-you"; map the Discover server feed to it so the offline fallback isn't empty.
  const fallbackTab: CommunityTab = activeTab === "discover" ? "for-you" : activeTab;
  const localPosts = state
    ? getFeedByTab(fallbackTab, state.posts, state.followedUsernames)
    : [];
  // Server feeds render REAL posts; on error/unauth they fall back to the local
  // demo layer. Only a *settled* fetch does, though: `feedPosts` is null while
  // one is in flight as well, and `feedPosts ?? localPosts` could not tell the
  // two apart — so Discover opened on fabricated demo posts, which the user
  // could like and whose authors they could follow, and which were then swapped
  // out from under them. It also made the "Loading feed…" branch below dead code
  // for any viewer with a seeded local feed, which is every signed-in viewer.
  const filteredPosts = !isServerFeed(activeTab)
    ? localPosts
    : feedLoading
      ? []
      : feedPosts ?? localPosts;

  const emptyConfig = EMPTY_STATE[activeTab];
  const EmptyIcon = emptyConfig.icon;

  return (
    <>
      <SiteHeader variant="app" />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-12 lg:px-12">
          {/* Editorial header */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <SectionKicker>COMMUNITY</SectionKicker>
              <EditorialHeading as="h1" className="mt-3">
                Style, in real life.
              </EditorialHeading>
              <p className="mt-3 text-sm text-muted-foreground">
                Looks from people dressing for themselves.
              </p>
            </div>

            {user && (
              <Button
                variant="brand-pill"
                size="pill"
                onClick={() => setCreatePostOpen(true)}
                className="shrink-0"
              >
                Share a Look
              </Button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="mt-8 flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <FilterPill
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </FilterPill>
            ))}
          </div>

          {/* Feed */}
          <div className="mt-10">
            {filteredPosts.length === 0 ? (
              feedLoading ? (
                <div className="rounded-[28px] border border-border/60 py-20 text-center">
                  <p className="text-sm text-muted-foreground">Loading feed…</p>
                </div>
              ) : (
                <div className="rounded-[28px] border border-border/60 py-20 text-center">
                  <EmptyIcon size={32} className="mx-auto mb-4 text-muted-foreground/50" strokeWidth={1.5} />
                  <p className="font-medium text-foreground">{emptyConfig.title}</p>
                  <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
                    {emptyConfig.description}
                  </p>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    state={state ?? { followedUsernames: [], posts: [] }}
                    index={index}
                    onPostUpdate={handlePostUpdate}
                    onToggleLike={handleToggleLike}
                    onToggleFollow={handleToggleFollowReal}
                    onOpenDetail={handleOpenDetail}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <p className="mt-16 text-center text-xs text-muted-foreground">
            {BRAND.name} is a judgment-free space. Celebrate style; never bodies.
          </p>
        </div>
      </main>

      {selectedPost && (
        <PostDetailDialog
          post={selectedPost}
          open={!!selectedPost}
          onOpenChange={(open) => {
            if (!open) setSelectedPost(null);
          }}
          onUpdate={(updated) => {
            setSelectedPost(updated);
            handlePostUpdate(updated); // updates BOTH feedPosts and local state (not just state)
          }}
          onToggleLike={(p) => {
            setSelectedPost(toggleLike(p)); // reflect immediately in the open dialog
            handleToggleLike(p); // server write-through + feed/state update
          }}
          currentUserName={user?.name ?? undefined}
          currentUserHandle={user?.username ?? undefined}
        />
      )}

      {user && (
        <CreateFashionPostDialog
          open={createPostOpen}
          onOpenChange={setCreatePostOpen}
          onSubmit={() => setFeedRefreshKey((k) => k + 1)}
          currentUsername={user.username ?? ""}
          currentDisplayName={user.name ?? ""}
        />
      )}
    </>
  );
}
