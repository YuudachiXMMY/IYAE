"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
import { useProfileSurface } from "@/lib/profile-surface";
import { useCommunityState } from "@/lib/hooks/useCommunityState";
import { getProfileTabPosts } from "@/lib/profile-dashboard";
import { DarkPanel } from "@/components/design-system/DarkPanel";
import { SectionKicker } from "@/components/design-system/SectionKicker";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { FilterPill } from "@/components/design-system/FilterPill";
import { ProductCard } from "@/components/design-system/ProductCard";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";

type BuyerUser = NonNullable<ReturnType<typeof useRequireAuth>["user"]>;

// ── Derived profile helpers (real data, no new API calls) ─────────────────────

/**
 * Style-profile completion from the buyer's real preference fields. Six equally
 * weighted signals — the same fields the registration wizard collects.
 */
function getStyleProfileCompletion(user: BuyerUser): number {
  const checks = [
    (user.styleAesthetics?.length ?? 0) > 0,
    (user.fitPreferences?.length ?? 0) > 0,
    (user.favoriteColors?.length ?? 0) > 0,
    (user.outfitGoals?.length ?? 0) > 0,
    Boolean(user.budgetRange),
    Boolean(user.avatarMode),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

function memberSince(createdAt?: string | null): string {
  if (!createdAt) return "today";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function ProfileSidebar({
  displayName,
  completion,
  username,
  isDesigner,
  onOpenSettings,
  onSignOut,
}: {
  displayName: string;
  completion: number;
  username: string;
  isDesigner: boolean;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  const navItems: ReadonlyArray<{ label: string; href: string }> = [
    { label: "Overview", href: "/dashboard" },
    { label: "My Profile", href: username ? `/profile/${username}` : "/profile/preferences" },
    { label: "Saved Pieces", href: "/looks" },
    { label: "Orders", href: "/orders" },
    { label: "Measurements", href: "/profile/body" },
  ];

  return (
    <DarkPanel className="hidden w-[250px] shrink-0 flex-col p-8 md:flex">
      <div>
        <p className="font-display text-2xl leading-tight text-background">{displayName}</p>
        <p className="mt-1 text-[12px] text-background/55">
          Style profile · {completion}% complete
        </p>
      </div>

      <nav className="mt-10 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-brand text-primary-foreground"
                  : "text-background/85 hover:bg-background/10 hover:text-background"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

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

// ── Buyer profile (Figma 2:156) ────────────────────────────────────────────────

function BuyerProfile({ user }: { user: BuyerUser }) {
  const { logout, refreshUser } = useAuth();
  const { surface, updateSurface } = useProfileSurface(String(user.id));
  const { state } = useCommunityState(user);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const username = user.username ?? "";
  const displayName =
    surface.displayName?.trim() || user.name?.trim() || username || "You";
  const initial = displayName.charAt(0).toUpperCase();
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
    <div className="flex min-h-screen">
      <ProfileSidebar
        displayName={displayName}
        completion={completion}
        username={username}
        isDesigner={user.role === "DESIGNER" || user.role === "ADMIN"}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={logout}
      />

      <main className="flex-1 bg-background px-6 py-10 sm:px-10 lg:px-16">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionKicker>MY {BRAND.name}</SectionKicker>
            <EditorialHeading className="mt-2">
              A profile that evolves with you.
            </EditorialHeading>
          </div>
          <Button
            variant="outline-pill"
            size="pill"
            onClick={() => setSettingsOpen(true)}
          >
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
                  initial
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
                <span>{completion}% complete</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>

          {/* Style note */}
          <DarkPanel className="flex flex-col rounded-[12px] p-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12px] text-background/55">
              This week&apos;s style note
            </p>
            <p className="mt-4 font-display text-2xl leading-snug text-background">
              Structure is having a moment — lean into a sharp shoulder and let
              everything else stay quiet.
            </p>
            <p className="mt-4 text-[13px] leading-relaxed text-background/70">
              Based on the pieces you&apos;ve saved, try pairing a tailored
              blazer with fluid trousers for an effortless, considered edit.
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
              <Link href="/products" className="text-brand hover:underline">
                Explore the shop
              </Link>{" "}
              to start your edit.
            </p>
          )}
        </div>
      </main>

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

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-[250px] shrink-0 bg-foreground p-8 md:block">
          <Skeleton className="h-6 w-32 bg-background/10" />
          <Skeleton className="mt-3 h-3 w-40 bg-background/10" />
          <div className="mt-10 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-full bg-background/10" />
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
    );
  }

  if (!user) return null;

  return <BuyerProfile user={user} />;
}
