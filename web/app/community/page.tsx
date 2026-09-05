"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  loadCommunityState,
  saveCommunityState,
  getFeedByTab,
  toggleLike,
  toggleSave,
  toggleRepost,
  toggleFollow,
  updatePostInState,
  buildOutfitGeneratorHref,
  type SocialPost,
  type CommunityTab,
} from "@/lib/community-feed";
import {
  SOCIAL_PROFILES,
  findSocialProfile,
} from "@/lib/social-graph";
import { PostDetailDialog } from "@/components/PostDetailDialog";
import { NavBar } from "@/components/NavBar";
import { toast } from "sonner";
import Link from "next/link";
import {
  BadgeCheck,
  Bookmark,
  Compass,
  Heart,
  MessageCircleMore,
  Repeat2,
  Search,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn, humanizeNumber } from "@/lib/utils";
import { PostMedia } from "@/components/community/PostMedia";

const TABS: { key: CommunityTab; label: string }[] = [
  { key: "for-you", label: "For you" },
  { key: "following", label: "Following" },
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
  following: {
    icon: Compass,
    title: "Your following feed is empty",
    description: "Follow creators to see their latest looks here.",
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

interface PostCardProps {
  post: SocialPost;
  state: { followedUsernames: string[]; posts: SocialPost[] };
  index: number;
  onPostUpdate: (updatedPost: SocialPost) => void;
  onToggleFollow: (username: string) => void;
  onOpenDetail: (post: SocialPost) => void;
}

function PostCard({
  post,
  state,
  index,
  onPostUpdate,
  onToggleFollow,
  onOpenDetail,
}: PostCardProps) {
  const isFollowing = state.followedUsernames.includes(post.creatorUsername);
  const profile = findSocialProfile(post.creatorUsername);

  return (
    <article
      className="animate-stagger-in rounded-[2.4rem] bg-card/75 backdrop-blur-xl shadow-heavy overflow-hidden transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header: avatar + name + follow */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div
          className="h-10 w-10 rounded-full shrink-0"
          style={{
            background: profile
              ? `linear-gradient(135deg, ${profile.avatarTone[0]}, ${profile.avatarTone[1]})`
              : "var(--color-muted)",
          }}
        >
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
            {post.creatorName.charAt(0)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={post.ownedByCurrentUser ? "/dashboard" : `/profile/${post.creatorUsername}`}
              className="font-semibold text-sm text-foreground hover:text-foreground"
            >
              @{post.creatorUsername}
            </Link>
            {profile?.isVerified && (
              <BadgeCheck size={14} className="text-primary shrink-0" aria-label="Verified" role="img" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {post.creatorName}
          </p>
        </div>

        {!post.ownedByCurrentUser && (
          <button
            onClick={() => onToggleFollow(post.creatorUsername)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200",
              isFollowing
                ? "border border-border text-muted-foreground hover:border-foreground/30"
                : "bg-foreground text-background hover:opacity-80 active:scale-[0.97]"
            )}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>

      {/* Image area */}
      <PostMedia src={post.image} alt={`Post by @${post.creatorUsername}`} />

      {/* Action buttons */}
      <div className="px-5 py-3 flex items-center gap-1">
        <button
          onClick={() => onPostUpdate(toggleLike(post))}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            post.likedByCurrentUser
              ? "scale-110 bg-brand/10 text-brand"
              : "text-muted-foreground hover:text-brand active:scale-95"
          )}
        >
          <Heart
            size={18}
            fill={post.likedByCurrentUser ? "currentColor" : "none"}
          />
        </button>
        <button
          onClick={() => onOpenDetail(post)}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-200"
        >
          <MessageCircleMore size={18} />
        </button>
        <button
          onClick={() => onPostUpdate(toggleSave(post))}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            post.savedByCurrentUser
              ? "scale-110 bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
        >
          <Bookmark
            size={18}
            fill={post.savedByCurrentUser ? "currentColor" : "none"}
          />
        </button>
        <button
          onClick={() => onPostUpdate(toggleRepost(post))}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            post.repostedByCurrentUser
              ? "scale-110 bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
        >
          <Repeat2 size={18} />
        </button>
        <button
          onClick={() => toast.message("Post copied for sharing")}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-200 ml-auto"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Like count + caption */}
      <div className="px-5 pb-4">
        <p className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
          {humanizeNumber(post.likeCount)} likes
        </p>
        <p className="text-sm text-foreground mt-1 leading-relaxed">
          <Link
            href={post.ownedByCurrentUser ? "/dashboard" : `/profile/${post.creatorUsername}`}
            className="font-semibold hover:text-foreground"
          >
            @{post.creatorUsername}
          </Link>{" "}
          {post.caption}
        </p>

        <p className="text-xs text-muted-foreground mt-2">
          {post.postedAt} ago
        </p>

        {post.comments.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-1">
              <span className="font-semibold text-foreground">@{post.comments[0].authorHandle}</span>{" "}
              {post.comments[0].copy}
            </p>
            {post.comments.length > 1 && (
              <button
                onClick={() => onOpenDetail(post)}
                className="text-xs text-muted-foreground mt-1 hover:text-foreground transition-colors"
              >
                View all {post.comments.length} comments
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onOpenDetail(post)}
            className="text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors"
          >
            Add a comment...
          </button>
        )}

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {post.productLinks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.productLinks.map((pl) => (
              <Link
                key={pl.id}
                href={pl.href}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs uppercase text-primary hover:bg-primary/15 transition-colors"
              >
                {pl.label}
              </Link>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Link
            href={buildOutfitGeneratorHref(post, "shop")}
            className="flex-1 rounded-full border border-border py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:border-foreground/20 hover:text-foreground active:scale-[0.98] transition-all duration-200"
          >
            Shop This Look
          </Link>
          <Link
            href={buildOutfitGeneratorHref(post, "similar")}
            className="flex-1 rounded-full bg-foreground py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-background hover:opacity-80 active:scale-[0.98] transition-all duration-200"
          >
            Generate Similar
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [state, setState] = useState<{
    followedUsernames: string[];
    posts: SocialPost[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<CommunityTab>("for-you");
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [creatorSearch, setCreatorSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const initial = loadCommunityState(
      String(user.id),
      user.name ?? "",
      user.username ?? "",
      (user as { styleAesthetics?: string[] }).styleAesthetics?.[0] ?? "Everyday"
    );
    setState(initial);
  }, [user]);

  useEffect(() => {
    if (user && state) saveCommunityState(String(user.id), state);
  }, [state, user]);

  function handlePostUpdate(updatedPost: SocialPost) {
    setState((prev) => (prev ? updatePostInState(prev, updatedPost) : prev));
  }

  function handleToggleFollow(username: string) {
    setState((prev) => (prev ? toggleFollow(prev, username) : prev));
  }

  function handleOpenDetail(post: SocialPost) {
    setSelectedPost(post);
  }

  const filteredPosts = state
    ? getFeedByTab(activeTab, state.posts, state.followedUsernames)
    : [];

  const filteredCreators = SOCIAL_PROFILES.filter(
    (p) =>
      !creatorSearch ||
      p.displayName.toLowerCase().includes(creatorSearch.toLowerCase()) ||
      p.username.includes(creatorSearch.toLowerCase())
  );

  const emptyConfig = EMPTY_STATE[activeTab];
  const EmptyIcon = emptyConfig.icon;

  return (
    <>
      <NavBar />
      <div
        className="min-h-screen"
        style={{
          background: `
            linear-gradient(180deg, var(--gradient-page-start) 0%, var(--gradient-page-mid) 50%, var(--gradient-page-end) 100%),
            radial-gradient(circle at top left, rgba(167,118,255,0.12), transparent 26%),
            radial-gradient(circle at bottom right, rgba(255,176,122,0.16), transparent 30%)
          `,
        }}
      >
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
          {/* Header — editorial, no redundancy */}
          <h1 className="font-display text-4xl sm:text-5xl tracking-[-0.04em] text-foreground">
            Communette
          </h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Discover looks, follow creators, and find your next outfit.
          </p>

          {/* Tab bar */}
          <div className="rounded-[2.4rem] bg-card/80 backdrop-blur-xl p-1.5 flex gap-1 shadow-heavy mb-8">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 rounded-full px-4 py-2.5 text-xs font-medium tracking-wide transition-all duration-200",
                  activeTab === tab.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
          {/* Mobile creator strip — visible below xl, Stories-style */}
          <div className="xl:hidden mb-8 -mx-4 sm:-mx-6">
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground px-4 sm:px-6 mb-3">
              Suggested creators
            </h3>
            <div className="flex gap-4 overflow-x-auto px-4 sm:px-6 pb-2">
              {SOCIAL_PROFILES.map((profile) => (
                <button
                  key={profile.username}
                  onClick={() => handleToggleFollow(profile.username)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group"
                >
                  <div
                    className={cn(
                      "h-16 w-16 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all duration-200",
                      state?.followedUsernames.includes(profile.username)
                        ? "ring-primary"
                        : "ring-transparent group-hover:ring-muted-foreground/30"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${profile.avatarTone[0]}, ${profile.avatarTone[1]})`,
                    }}
                  >
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                      {profile.displayName.charAt(0)}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[64px]">
                    {profile.displayName.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
            {/* Left: Post Feed */}
            <div className="space-y-6">
              {filteredPosts.length === 0 ? (
                <div className="rounded-[2.4rem] bg-card/75 backdrop-blur-xl shadow-heavy py-20 text-center">
                  <EmptyIcon size={32} className="mx-auto text-muted-foreground/50 mb-4" strokeWidth={1.5} />
                  <p className="text-foreground font-medium">{emptyConfig.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
                    {emptyConfig.description}
                  </p>
                </div>
              ) : (
                filteredPosts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    state={state!}
                    index={index}
                    onPostUpdate={handlePostUpdate}
                    onToggleFollow={handleToggleFollow}
                    onOpenDetail={handleOpenDetail}
                  />
                ))
              )}
            </div>

            {/* Right: Discover Creators sidebar */}
            <aside className="hidden xl:block">
              <div className="sticky top-24 rounded-[2.4rem] bg-card/75 backdrop-blur-xl p-5 shadow-heavy">
                <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
                  Discover creators
                </h3>

                <div className="relative mb-4">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    value={creatorSearch}
                    onChange={(e) => setCreatorSearch(e.target.value)}
                    placeholder="Search creators..."
                    className="w-full rounded-full border border-border bg-card/85 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 transition-shadow duration-200"
                  />
                </div>

                <div className="space-y-3">
                  {filteredCreators.slice(0, 5).map((profile) => (
                    <div
                      key={profile.username}
                      className="flex items-center gap-3"
                    >
                      <div
                        className="h-10 w-10 rounded-full shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${profile.avatarTone[0]}, ${profile.avatarTone[1]})`,
                        }}
                      >
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                          {profile.displayName.charAt(0)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {profile.displayName}
                          </span>
                          {profile.isVerified && (
                            <BadgeCheck
                              size={12}
                              className="text-primary shrink-0"
                              aria-label="Verified"
                              role="img"
                            />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          @{profile.username}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleFollow(profile.username)}
                        className={cn(
                          "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-200 shrink-0",
                          state?.followedUsernames.includes(profile.username)
                            ? "border border-border text-muted-foreground hover:border-foreground/30"
                            : "bg-foreground text-background hover:opacity-80 active:scale-[0.97]"
                        )}
                      >
                        {state?.followedUsernames.includes(profile.username)
                          ? "Following"
                          : "Follow"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {selectedPost && (
        <PostDetailDialog
          post={selectedPost}
          open={!!selectedPost}
          onOpenChange={(open) => {
            if (!open) setSelectedPost(null);
          }}
          onUpdate={(updated) => {
            setSelectedPost(updated);
            setState((prev) =>
              prev ? updatePostInState(prev, updated) : prev
            );
          }}
          currentUserName={user?.name ?? undefined}
          currentUserHandle={user?.username ?? undefined}
        />
      )}
    </>
  );
}
