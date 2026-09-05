"use client";

import { useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
import { useProfileSurface } from "@/lib/profile-surface";
import { useCommunityState } from "@/lib/hooks/useCommunityState";
import {
  getProfileTabPosts,
  getProfileStats,
  type DashboardTab,
} from "@/lib/profile-dashboard";
import { requestDelete, type SocialPost, type CreatePostInput } from "@/lib/community-feed";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStatsBar } from "@/components/profile/ProfileStatsBar";
import { ProfileActionBar } from "@/components/profile/ProfileActionBar";
import { ProfileContentTabs } from "@/components/profile/ProfileContentTabs";
import { ProfilePostGrid } from "@/components/profile/ProfilePostGrid";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { CreateFashionPostDialog } from "@/components/profile/CreateFashionPostDialog";
import { StyleCircleDialog } from "@/components/profile/StyleCircleDialog";
import { PostDetailDialog } from "@/components/PostDetailDialog";
import {
  ChatCircleDots,
  TShirt,
  Cube,
  BookmarkSimple,
  Sparkle,
  Storefront,
} from "@phosphor-icons/react";

// ── Shopper Quick Actions ────────────────────────────────────────────────────

const SHOPPER_ACTIONS: ReadonlyArray<{
  href: string;
  label: string;
  description: string;
  icon: typeof ChatCircleDots;
  featured?: boolean;
}> = [
  {
    href: "/chat",
    label: "AI stylist",
    description: "Get personalized outfit advice",
    icon: ChatCircleDots,
    featured: true,
  },
  {
    href: "/outfits/new",
    label: "Build outfit",
    description: "Mix and match pieces",
    icon: TShirt,
  },
  {
    href: "/looks",
    label: "Saved looks",
    description: "Your curated collection",
    icon: BookmarkSimple,
  },
  {
    href: "/try-on",
    label: "Virtual try-on",
    description: "See it on your avatar",
    icon: Cube,
  },
  {
    href: "/style-lab",
    label: "Style lab",
    description: "Explore and experiment",
    icon: Sparkle,
  },
];

function ShopperQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {SHOPPER_ACTIONS.map(({ href, label, description, icon: Icon, featured }, i) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "group relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] animate-stagger-in",
            featured
              ? "col-span-2 bg-foreground text-background shadow-heavy sm:col-span-1"
              : "bg-card shadow-soft hover:shadow-md"
          )}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
              featured
                ? "bg-background/15 text-background group-hover:bg-background/25"
                : "bg-brand/10 text-brand group-hover:bg-brand group-hover:text-primary-foreground"
            )}
          >
            <Icon size={20} weight="duotone" />
          </div>
          <div>
            <p className={cn(
              "text-sm font-semibold",
              featured ? "text-background" : "text-foreground"
            )}>
              {label}
            </p>
            <p className={cn(
              "mt-0.5 text-xs leading-relaxed",
              featured ? "text-background/60" : "text-muted-foreground"
            )}>
              {description}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Buyer Social Profile ──────────────────────────────────────────────────────

function BuyerSocialProfile({
  user,
}: {
  user: NonNullable<ReturnType<typeof useRequireAuth>["user"]>;
}) {
  const { refreshUser } = useAuth();
  const { surface, updateSurface } = useProfileSurface(String(user.id));
  const { state, handlePostUpdate, handleToggleFollow, handleCreatePost, handleArchivePost } =
    useCommunityState(user);

  const [activeTab, setActiveTab] = useState<DashboardTab>("outfit-posts");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [styleCircleOpen, setStyleCircleOpen] = useState(false);
  const [styleCircleInitialTab, setStyleCircleInitialTab] = useState<
    "followers" | "following"
  >("followers");
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  if (!state) return null;

  const username = user.username ?? "";
  const stats = getProfileStats(state, username);
  const tabPosts = getProfileTabPosts(state, username, activeTab);

  const postCounts: Record<DashboardTab, number> = {
    "outfit-posts": getProfileTabPosts(state, username, "outfit-posts").length,
    saved: getProfileTabPosts(state, username, "saved").length,
    reposted: getProfileTabPosts(state, username, "reposted").length,
    tagged: getProfileTabPosts(state, username, "tagged").length,
    archives: getProfileTabPosts(state, username, "archives").length,
  };

  function handleOpenFollowers() {
    setStyleCircleInitialTab("followers");
    setStyleCircleOpen(true);
  }

  function handleOpenFollowing() {
    setStyleCircleInitialTab("following");
    setStyleCircleOpen(true);
  }

  function handleDeletePost(post: SocialPost) {
    handlePostUpdate(requestDelete(post));
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Profile header with entrance animation */}
      <div className="animate-stagger-in">
        <ProfileHeader user={user} surface={surface} onUpdateSurface={updateSurface} />
      </div>

      {/* Stats + Actions row */}
      <div className="animate-stagger-in flex flex-col gap-4" style={{ animationDelay: "80ms" }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ProfileStatsBar
            stats={stats}
            onClickFollowers={handleOpenFollowers}
            onClickFollowing={handleOpenFollowing}
            onClickArchives={() => setActiveTab("archives")}
          />
          <div className="flex items-center gap-2">
            {user.role === "DESIGNER" && (
              <Link
                href="/designer/studio"
                className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/10"
              >
                <Storefront size={16} weight="duotone" />
                Designer Studio
              </Link>
            )}
            <Link
              href="/orders"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Orders
            </Link>
            <ProfileActionBar
              onMakePost={() => setCreatePostOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Quick actions — the key feature shortcuts */}
      <div className="animate-stagger-in" style={{ animationDelay: "160ms" }}>
        <ShopperQuickActions />
      </div>

      {/* Content tabs + post grid */}
      <div className="animate-stagger-in flex flex-col gap-4" style={{ animationDelay: "240ms" }}>
        <ProfileContentTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          postCounts={postCounts}
        />
        <ProfilePostGrid
          posts={tabPosts}
          activeTab={activeTab}
          onOpenDetail={setSelectedPost}
          onArchive={handleArchivePost}
          onDelete={handleDeletePost}
          onCreatePost={() => setCreatePostOpen(true)}
        />
      </div>

      <ProfileSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user as Parameters<typeof ProfileSettingsDialog>[0]["user"]}
        surface={surface}
        onUpdateSurface={updateSurface}
        onUserRefresh={refreshUser}
      />

      <CreateFashionPostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onSubmit={handleCreatePost}
        currentUsername={username}
        currentDisplayName={user.name ?? ""}
      />

      <StyleCircleDialog
        open={styleCircleOpen}
        onOpenChange={setStyleCircleOpen}
        followedUsernames={state.followedUsernames}
        onToggleFollow={handleToggleFollow}
        initialTab={styleCircleInitialTab}
      />

      {selectedPost && (
        <PostDetailDialog
          post={selectedPost}
          open={!!selectedPost}
          onOpenChange={(open) => {
            if (!open) setSelectedPost(null);
          }}
          onUpdate={(updated) => {
            setSelectedPost(updated);
            handlePostUpdate(updated);
          }}
          currentUserName={user.name ?? undefined}
          currentUserHandle={username}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <>
        <NavBar />
        <PageShell>
          <div className="flex flex-col gap-10">
            {/* Banner + avatar skeleton */}
            <div>
              <Skeleton className="h-[180px] w-full rounded-card" />
              <div className="flex gap-4 -mt-12 px-4">
                <Skeleton className="h-24 w-24 rounded-full border-4 border-background" />
                <div className="flex flex-col gap-2 pt-14">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
            {/* Stats skeleton */}
            <Skeleton className="h-14 w-80 rounded-2xl" />
            {/* Quick actions skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            {/* Tabs skeleton */}
            <Skeleton className="h-12 w-full rounded-[2.4rem]" />
            {/* Post grid skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-2xl" />
              ))}
            </div>
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <NavBar />
      <PageShell>
        <BuyerSocialProfile user={user} />
      </PageShell>
      <Footer />
    </>
  );
}
