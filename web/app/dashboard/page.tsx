"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
import { useProfileSurface } from "@/lib/profile-surface";
import { useCommunityState } from "@/lib/hooks/useCommunityState";
import { getProfileTabPosts, getProfileStats } from "@/lib/profile-dashboard";
import { follows } from "@/lib/api";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { DarkPanel } from "@/components/design-system/DarkPanel";
import { SectionKicker } from "@/components/design-system/SectionKicker";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { FilterPill } from "@/components/design-system/FilterPill";
import { ProductCard } from "@/components/design-system/ProductCard";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { SectionTabs } from "@/components/dashboard/SectionTabs";
import {
  isDashboardSection,
  type DashboardSection,
} from "@/components/dashboard/sections";
import {
  getStyleProfileCompletion,
  memberSince,
  truncate,
} from "@/components/dashboard/helpers";
import { OrdersPanel } from "@/components/dashboard/OrdersPanel";
import { SavedPiecesPanel } from "@/components/dashboard/SavedPiecesPanel";
import { MeasurementsPanel } from "@/components/dashboard/MeasurementsPanel";

type BuyerUser = NonNullable<ReturnType<typeof useRequireAuth>["user"]>;

// ── Sidebar ───────────────────────────────────────────────────────────────────

function ProfileSidebar({
  displayName,
  completion,
  active,
  onSelect,
  isDesigner,
  onOpenSettings,
  onSignOut,
}: {
  displayName: string;
  completion: number;
  active: DashboardSection;
  onSelect: (section: DashboardSection) => void;
  isDesigner: boolean;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <DarkPanel className="hidden w-[250px] shrink-0 flex-col p-8 md:flex">
      <div>
        <p className="font-display text-2xl leading-tight text-background">
          {displayName}
        </p>
        <p className="mt-1 text-[12px] text-inverted-muted-foreground">
          Style profile · <span className="tabular-nums">{completion}%</span>{" "}
          complete
        </p>
      </div>

      <div className="mt-10">
        <SectionTabs
          active={active}
          onSelect={onSelect}
          variant="sidebar"
          idPrefix="sidebar"
        />
      </div>

      <div className="mt-8 flex flex-col gap-1 border-t border-background/15 pt-6">
        {isDesigner && (
          <Link
            href="/designer/studio"
            className="rounded-full px-4 py-2.5 text-[13px] font-medium text-background/85 transition-colors hover:bg-background/10 hover:text-background"
          >
            Designer Studio
          </Link>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-full px-4 py-2.5 text-left text-[13px] font-medium text-background/85 transition-colors hover:bg-background/10 hover:text-background"
        >
          Settings
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full px-4 py-2.5 text-left text-[13px] font-medium text-background/85 transition-colors hover:bg-background/10 hover:text-background"
        >
          Sign out
        </button>
      </div>
    </DarkPanel>
  );
}

// ── Overview panel (Figma 2:156) ───────────────────────────────────────────────

function OverviewPanel({
  user,
  surface,
  state,
  onOpenSettings,
}: {
  user: BuyerUser;
  surface: ReturnType<typeof useProfileSurface>["surface"];
  state: ReturnType<typeof useCommunityState>["state"];
  onOpenSettings: () => void;
}) {
  const username = user.username ?? "";
  const displayName =
    surface.displayName?.trim() || user.name?.trim() || username || "You";
  const completion = getStyleProfileCompletion(user);
  const styleTags = (user.styleAesthetics ?? []).slice(0, 3);

  const savedItems = state
    ? getProfileTabPosts(state, username, "saved").map((p) => ({
        key: p.id,
        name: truncate(p.caption || "Saved look", 42),
        price: `by ${p.creatorName}`,
        imageUrl: p.image || undefined,
        href: p.productLinks[0]?.href || "/community",
      }))
    : [];

  return (
    <>
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionKicker>MY {BRAND.name}</SectionKicker>
          <EditorialHeading className="mt-2 [text-wrap:balance]">
            A profile that evolves with you.
          </EditorialHeading>
        </div>
        <Button variant="outline-pill" size="pill" onClick={onOpenSettings}>
          EDIT PROFILE
        </Button>
      </div>

      {/* Profile card + style note */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* Profile card */}
        <div className="rounded-[12px] border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-2xl font-display text-primary-foreground">
              {surface.avatarDataUrl ? (
                <Image
                  src={surface.avatarDataUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xl text-foreground">
                {displayName}
              </p>
              <p className="text-[13px] text-muted-foreground">
                Toronto · Member since {memberSince(user.createdAt)}
              </p>
            </div>
          </div>

          {styleTags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {styleTags.map((tag) => (
                <FilterPill key={tag} active>
                  {tag}
                </FilterPill>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12px] text-muted-foreground">
              <span>Style profile</span>
              <span className="tabular-nums">{completion}% complete</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>

        {/* Style note */}
        <DarkPanel className="flex flex-col rounded-[12px] p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12px] text-inverted-muted-foreground">
            This week&apos;s style note
          </p>
          <p className="mt-4 font-display text-2xl leading-snug text-background">
            Structure is having a moment — lean into a sharp shoulder and let
            everything else stay quiet.
          </p>
          <p className="mt-4 text-[13px] leading-relaxed text-background/70 [text-wrap:pretty]">
            Based on the pieces you&apos;ve saved, try pairing a tailored blazer
            with fluid trousers for an effortless, considered edit.
          </p>
          <Link
            href="/chat"
            className="mt-6 inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.12px] text-background transition-opacity hover:opacity-80"
          >
            View AI edit
            <ArrowUpRight width={14} height={14} aria-hidden="true" />
          </Link>
        </DarkPanel>
      </div>

      {/* Saved for you */}
      <div className="mt-14">
        <EditorialHeading as="h2">Saved for you</EditorialHeading>
        {savedItems.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {savedItems.map((item) => (
              <ProductCard
                key={item.key}
                name={item.name}
                price={item.price}
                imageUrl={item.imageUrl}
                href={item.href}
                saved
              />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-[14px] text-muted-foreground">
            You haven&apos;t saved any pieces yet.{" "}
            {/* Underlined always, not just on hover. This link sits inside a sentence, and
                `text-brand` against the surrounding `text-muted-foreground` is 1.33:1 — far
                under the 3:1 that would let colour alone carry it. WCAG 1.4.1 and axe's
                link-in-text-block both want a non-colour cue; a hover-only underline is not
                one, because it does not exist until you already know the link is there. */}
            <Link href="/products" className="text-brand underline hover:no-underline">
              Explore the shop
            </Link>{" "}
            to start your edit.
          </p>
        )}
      </div>
    </>
  );
}

// ── My Profile panel ───────────────────────────────────────────────────────────

function MyProfilePanel({
  user,
  surface,
  state,
  onOpenSettings,
}: {
  user: BuyerUser;
  surface: ReturnType<typeof useProfileSurface>["surface"];
  state: ReturnType<typeof useCommunityState>["state"];
  onOpenSettings: () => void;
}) {
  const username = user.username ?? "";
  const displayName =
    surface.displayName?.trim() || user.name?.trim() || username || "You";
  const styleTags = user.styleAesthetics ?? [];
  const stats = state
    ? getProfileStats(state, username)
    : { posts: 0, followers: 0, following: 0, archives: 0 };

  // getProfileStats is a synchronous, localStorage-only helper and hardcodes
  // followers=0. Fetch the real server-side follower/following counts here and
  // merge them over the placeholder stats.
  const [followCounts, setFollowCounts] = useState<{
    followers: number;
    following: number;
  } | null>(null);

  useEffect(() => {
    if (!user.id) return;
    const controller = new AbortController();
    follows
      .counts(user.id, controller.signal)
      .then((c) => setFollowCounts({ followers: c.followers, following: c.following }))
      .catch(() => {
        // Non-fatal: fall back to the local placeholder stats on failure/abort.
      });
    return () => controller.abort();
  }, [user.id]);

  const statCards: ReadonlyArray<{ label: string; value: number }> = [
    { label: "Posts", value: stats.posts },
    { label: "Followers", value: followCounts?.followers ?? stats.followers },
    { label: "Following", value: followCounts?.following ?? stats.following },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionKicker>MY PROFILE</SectionKicker>
          <EditorialHeading className="mt-2">{displayName}</EditorialHeading>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline-pill" size="pill" onClick={onOpenSettings}>
            EDIT PROFILE
          </Button>
          {username && (
            <Button asChild variant="outline-pill" size="pill">
              <Link href={`/profile/${username}`}>VIEW PUBLIC PROFILE</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Identity card */}
      <div className="mt-10 rounded-[12px] border border-border p-6">
        <div className="flex items-center gap-4">
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-3xl font-display text-primary-foreground">
            {surface.avatarDataUrl ? (
              <Image
                src={surface.avatarDataUrl}
                alt={displayName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-2xl text-foreground">
              {displayName}
            </p>
            {username && (
              <p className="text-[13px] text-muted-foreground">@{username}</p>
            )}
            <p className="text-[13px] text-muted-foreground">
              Member since {memberSince(user.createdAt)}
            </p>
          </div>
        </div>

        {surface.bio.trim() && (
          <p className="mt-5 text-[14px] leading-relaxed text-foreground [text-wrap:pretty]">
            {surface.bio}
          </p>
        )}

        {styleTags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {styleTags.map((tag) => (
              <FilterPill key={tag} active>
                {tag}
              </FilterPill>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-6">
          {statCards.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-2xl text-foreground tabular-nums">
                {stat.value}
              </p>
              <p className="text-[12px] uppercase tracking-[0.12px] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Buyer profile shell ────────────────────────────────────────────────────────

function BuyerProfile({ user }: { user: BuyerUser }) {
  const { logout, refreshUser } = useAuth();
  const { surface, updateSurface } = useProfileSurface(String(user.id));
  const { state } = useCommunityState(user);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active section is derived straight from the URL (`?section=`) so deep-links
  // and the browser back/forward buttons stay in sync — a single source of truth.
  const sectionParam = searchParams.get("section");
  const activeSection: DashboardSection = isDashboardSection(sectionParam)
    ? sectionParam
    : "overview";

  const setSection = (section: DashboardSection) => {
    const href =
      section === "overview" ? "/dashboard" : `/dashboard?section=${section}`;
    router.replace(href, { scroll: false });
  };

  // Sign out lands on the marketing home, matching the global SiteHeader.
  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  const username = user.username ?? "";
  const displayName =
    surface.displayName?.trim() || user.name?.trim() || username || "You";
  const completion = getStyleProfileCompletion(user);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="app" />

      <div className="flex flex-1">
        <ProfileSidebar
          displayName={displayName}
          completion={completion}
          active={activeSection}
          onSelect={setSection}
          isDesigner={user.role === "DESIGNER" || user.role === "ADMIN"}
          onOpenSettings={() => setSettingsOpen(true)}
          onSignOut={handleSignOut}
        />

        <main className="flex-1 bg-background px-6 py-10 sm:px-10 lg:px-16">
          {/* Mobile section nav — the desktop rail is hidden below md. */}
          <div className="mb-8 md:hidden">
            <SectionTabs
              active={activeSection}
              onSelect={setSection}
              variant="pills"
              idPrefix="mobile"
            />
          </div>

          <div
            id="dashboard-panel"
            role="tabpanel"
            aria-labelledby={`sidebar-tab-${activeSection}`}
            tabIndex={0}
            className="outline-none"
          >
            {activeSection === "overview" && (
              <OverviewPanel
                user={user}
                surface={surface}
                state={state}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            )}
            {activeSection === "profile" && (
              <MyProfilePanel
                user={user}
                surface={surface}
                state={state}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            )}
            {activeSection === "saved" && <SavedPiecesPanel />}
            {activeSection === "orders" && <OrdersPanel />}
            {activeSection === "measurements" && (
              <MeasurementsPanel initialGenderIdentity={user.genderIdentity} />
            )}
          </div>
        </main>
      </div>

      <ProfileSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user as Parameters<typeof ProfileSettingsDialog>[0]["user"]}
        surface={surface}
        onUpdateSurface={updateSurface}
        onUserRefresh={refreshUser}
      />
    </div>
  );
}

// ── Shell skeleton ─────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="app" />
      <div className="flex flex-1">
        <div className="hidden w-[250px] shrink-0 bg-foreground p-8 md:block">
          <Skeleton className="h-6 w-32 bg-background/10" />
          <Skeleton className="mt-3 h-3 w-40 bg-background/10" />
          <div className="mt-10 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-full rounded-full bg-background/10"
              />
            ))}
          </div>
        </div>
        <div className="flex-1 px-6 py-10 sm:px-10 lg:px-16">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-12 w-96 max-w-full" />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-[12px]" />
            <Skeleton className="h-56 rounded-[12px]" />
          </div>
          <Skeleton className="mt-14 h-10 w-48" />
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[276/300] rounded-[2px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, loading } = useRequireAuth();

  // Show the shell skeleton both while auth hydrates AND during the redirect
  // tick when there's no user (useRequireAuth is replacing the route).
  if (loading || !user) return <DashboardSkeleton />;

  return <BuyerProfile user={user} />;
}

export default function DashboardPage() {
  // BuyerProfile reads useSearchParams, which Next.js 16 requires be wrapped in
  // a Suspense boundary to avoid a full client-side-rendering bailout.
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
