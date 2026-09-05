"use client";

import Link from "next/link";
import { cn, humanizeNumber } from "@/lib/utils";
import type { DashboardTab } from "@/lib/profile-dashboard";
import type { SocialPost } from "@/lib/community-feed";
import { PostMedia } from "@/components/community/PostMedia";
import {
  Heart,
  MessageCircleMore,
  Archive,
  Trash2,
  Camera,
  Bookmark,
  Repeat2,
  Tag,
  ArchiveRestore,
} from "lucide-react";

interface ProfilePostGridProps {
  posts: SocialPost[];
  activeTab: DashboardTab;
  onOpenDetail: (post: SocialPost) => void;
  onArchive?: (post: SocialPost) => void;
  onDelete?: (post: SocialPost) => void;
  onCreatePost?: () => void;
}

const EMPTY_STATES: Record<
  DashboardTab,
  { icon: typeof Camera; headline: string; description: string; cta?: { label: string; href?: string; action?: "create" } }
> = {
  "outfit-posts": {
    icon: Camera,
    headline: "Share your first outfit",
    description: "Post your fits and build your style profile for the community to see.",
    cta: { label: "Create a post", action: "create" },
  },
  saved: {
    icon: Bookmark,
    headline: "Nothing saved yet",
    description: "When you save outfits from the community, they show up here.",
    cta: { label: "Browse community", href: "/community" },
  },
  reposted: {
    icon: Repeat2,
    headline: "No reposts yet",
    description: "Repost looks you love to share them with your followers.",
    cta: { label: "Discover looks", href: "/community" },
  },
  tagged: {
    icon: Tag,
    headline: "No tagged looks",
    description: "When someone tags you in a post, it appears here.",
  },
  archives: {
    icon: ArchiveRestore,
    headline: "No archived posts",
    description: "Posts you archive are kept here privately.",
  },
};

export function ProfilePostGrid({
  posts,
  activeTab,
  onOpenDetail,
  onArchive,
  onDelete,
  onCreatePost,
}: ProfilePostGridProps) {
  const showOwnerActions = activeTab === "outfit-posts";

  if (posts.length === 0) {
    const empty = EMPTY_STATES[activeTab];
    const Icon = empty.icon;

    return (
      <div className="rounded-[2.4rem] bg-card/75 backdrop-blur-xl shadow-heavy flex flex-col items-center gap-4 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Icon size={24} className="text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{empty.headline}</p>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            {empty.description}
          </p>
        </div>
        {empty.cta && (
          empty.cta.action === "create" && onCreatePost ? (
            <button
              type="button"
              onClick={onCreatePost}
              className="mt-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all duration-150 hover:opacity-80 active:scale-[0.97]"
            >
              {empty.cta.label}
            </button>
          ) : empty.cta.href ? (
            <Link
              href={empty.cta.href}
              className="mt-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-all duration-150 hover:bg-muted active:scale-[0.97]"
            >
              {empty.cta.label}
            </Link>
          ) : null
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {posts.map((post, index) => {
        const isOwner = showOwnerActions && post.ownedByCurrentUser === true;

        return (
          <div
            key={post.id}
            className="relative group"
            style={{
              animation: "staggerIn 0.4s ease-out both",
              animationDelay: `${Math.min(index, 12) * 60}ms`,
            }}
          >
            <button
              onClick={() => onOpenDetail(post)}
              className="w-full rounded-2xl overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
              aria-label={`View post by @${post.creatorUsername}`}
            >
              <PostMedia
                src={post.image}
                alt={`Post by @${post.creatorUsername}`}
                aspectRatio="1/1"
              />

              {/* Hover overlay with stats */}
              <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4">
                <span className="flex items-center gap-1 text-background text-xs font-semibold">
                  <Heart size={14} fill="currentColor" />
                  {humanizeNumber(post.likeCount)}
                </span>
                <span className="flex items-center gap-1 text-background text-xs font-semibold">
                  <MessageCircleMore size={14} />
                  {post.comments.length}
                </span>
              </div>
            </button>

            {/* Owner actions — shown only for outfit-posts tab and owned posts */}
            {isOwner && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive?.(post);
                  }}
                  className="flex items-center justify-center h-7 w-7 rounded-full bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-foreground shadow-heavy transition-colors"
                  aria-label="Archive post"
                >
                  <Archive size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(post);
                  }}
                  className="flex items-center justify-center h-7 w-7 rounded-full bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-destructive shadow-heavy transition-colors"
                  aria-label="Delete post"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
