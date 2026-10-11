"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Globe2, Heart, MessageCircleMore } from "lucide-react";
import { findSocialProfile } from "@/lib/social-graph";
import { type SocialPost, toSocialPost } from "@/lib/community-feed";
import { useCommunityState } from "@/lib/hooks/useCommunityState";
import { PostDetailDialog } from "@/components/PostDetailDialog";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { cn } from "@/lib/utils";
import { api, follows, posts as postsApi } from "@/lib/api";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";

interface PublicProfileResponse {
  id: number;
  username: string;
  name: string | null;
  isDesigner: boolean;
  styleAesthetics: string[];
  avatarMode: string | null;
  avatarPreset: string | null;
  createdAt: string | null;
}

function parseGradient(image: string): { from: string; to: string } | null {
  if (!image.startsWith("gradient:")) return null;
  const [from, to] = image.slice(9).split(",");
  return { from, to };
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center sm:text-right">
      <p className="text-2xl font-semibold text-foreground">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </p>
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const username = typeof params.username === "string" ? params.username : "";
  const { user } = useAuth();

  const [serverProfile, setServerProfile] = useState<PublicProfileResponse | null | undefined>(undefined);
  const [counts, setCounts] = useState<{ userId: number; followers: number; following: number } | null>(null);

  useEffect(() => {
    if (!username) return;
    api.get<PublicProfileResponse>("/api/auth/users/profile/" + username)
      .then((data) => setServerProfile(data))
      .catch(() => setServerProfile(null));
  }, [username]);

  const socialProfile = findSocialProfile(username);
  const isOwnProfile = user?.username === username;

  // Real follower/following counts (derived server COUNTs). No id → show 0 (never fabricate).
  const targetUserId = serverProfile?.id ?? (isOwnProfile ? user?.id : undefined);
  // Counts are tagged with the id they were fetched for, so counts for another
  // profile (or no id at all) read as unknown without being cleared by hand.
  const followCounts = counts?.userId === targetUserId ? counts : null;

  useEffect(() => {
    if (targetUserId == null) return;
    const ctrl = new AbortController();
    follows.counts(targetUserId, ctrl.signal)
      .then((c) => setCounts({ userId: targetUserId, ...c }))
      .catch(() => setCounts(null));
    return () => ctrl.abort();
  }, [targetUserId]);

  // serverProfile === undefined: still loading; null: API returned 404/error
  const profileNotFound = serverProfile === null && !socialProfile && !isOwnProfile;

  const profileData = serverProfile != null ? {
        displayName: serverProfile.name ?? serverProfile.username,
        username: serverProfile.username,
        bio: "",
        avatarTone: ["var(--color-muted)", "var(--color-card)"] as [string, string],
        bannerTone: ["var(--gradient-profile-banner-start)", "var(--gradient-profile-banner-end)"] as [string, string],
        location: "",
        headline: "",
        styleAesthetics: serverProfile.styleAesthetics ?? [],
        isVerified: serverProfile.isDesigner,
      } : socialProfile
    ? {
        displayName: socialProfile.displayName,
        username: socialProfile.username,
        bio: socialProfile.bio,
        avatarTone: socialProfile.avatarTone,
        bannerTone: socialProfile.bannerTone,
        location: socialProfile.location,
        headline: socialProfile.headline,
        styleAesthetics: socialProfile.styleAesthetics,
        isVerified: socialProfile.isVerified,
      }
    : isOwnProfile && user
    ? {
        displayName: user.name ?? username,
        username: username,
        bio: `Fashion enthusiast on ${BRAND.name}`,
        avatarTone: ["var(--color-muted)", "var(--color-card)"] as [string, string],
        bannerTone: ["var(--gradient-profile-banner-start)", "var(--gradient-profile-banner-end)"] as [string, string],
        location: "",
        headline: "",
        styleAesthetics: user.styleAesthetics ?? [],
        isVerified: false,
      }
    : {
        displayName: username.replace(/\./g, " "),
        username,
        bio: "",
        avatarTone: ["var(--color-muted)", "var(--color-card)"] as [string, string],
        bannerTone: ["var(--gradient-profile-banner-start)", "var(--gradient-profile-banner-end)"] as [string, string],
        location: "",
        headline: "",
        styleAesthetics: [],
        isVerified: false,
      };

  // This is the third surface reading and writing the one
  // `clossette-community-state-<id>` entry, and it used to do it by hand: its own
  // copy of the four-argument seeding call, and a `saveCommunityState` on follow
  // but not on a post update, so a like left in the detail dialog here was the one
  // interaction in the app that vanished on reload.
  //
  // It goes through the shared hook rather than through the two shared helpers,
  // because it needs exactly what the hook already provides. Re-deriving it meant
  // keying the reseed on the `user` *object*, and `refreshUser()` hands out a new
  // object every time — and SiteHeader, which this page renders, triggers it from
  // ProfileSettingsDialog's save. Saving your own bio while looking at someone
  // else's profile would reseed this page's whole state from storage for no
  // reason. The hook keys on a value signature instead, and brings the cross-tab
  // `storage` listener with it.
  const { state, handlePostUpdate, handleToggleFollow: toggleFollowFor } =
    useCommunityState(user);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [outfitTab, setOutfitTab] = useState<"posts" | "tagged">("posts");

  // The grid used to be `state.posts.filter(creatorUsername === username)` — the *viewer's*
  // own local community cache. That cache only ever contains the viewer's seeded demo posts
  // and whatever they created themselves, so in production every other account's profile
  // rendered an empty grid regardless of how much they had posted. The profiled user's posts
  // come from the server, keyed on their numeric id.
  // Tagged with the id it was fetched for, like `counts` above, so switching profiles reads as
  // "not loaded yet" without an extra effect to clear it — and so the effect body writes no
  // state synchronously (`react-hooks/set-state-in-effect`, which this repo keeps at zero).
  const [postsResult, setPostsResult] = useState<{
    userId: number;
    posts: SocialPost[] | null;
  } | null>(null);
  // Bumped by "Try again". The fetch effect keys on it as well as on the id, because clearing
  // the result alone would not re-run an effect whose only other dependency is unchanged.
  const [postsRetry, setPostsRetry] = useState(0);
  const currentPosts = postsResult?.userId === targetUserId ? postsResult : null;

  useEffect(() => {
    if (targetUserId == null) return;
    const ctrl = new AbortController();
    postsApi
      .byUser(targetUserId, 0, 30, ctrl.signal)
      .then((page) => {
        if (ctrl.signal.aborted) return;
        setPostsResult({ userId: targetUserId, posts: page.content.map(toSocialPost) });
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        // `posts: null` is a failure, which is NOT "this person has never posted" — rendering
        // an empty grid for an outage is the failure mode the audit found all over /admin.
        setPostsResult({ userId: targetUserId, posts: null });
      });
    return () => ctrl.abort();
  }, [targetUserId, postsRetry]);

  const postsFailed = currentPosts != null && currentPosts.posts === null;
  const postsLoading = targetUserId != null && currentPosts == null;

  // Local-only fallback for an unauthenticated viewer or a demo profile with no numeric id.
  const localUserPosts = state?.posts.filter((p) => p.creatorUsername === username) ?? [];
  const userPosts =
    currentPosts?.posts ?? (targetUserId == null ? localUserPosts : []);
  const taggedPosts = userPosts.filter((p) => p.productLinks.length > 0);
  const displayPosts = outfitTab === "posts" ? userPosts : taggedPosts;

  const isFollowing = state?.followedUsernames.includes(username) ?? false;

  // Writes through to the server, mirroring what /community already does. This page only
  // toggled the local-storage mirror, so a follow made here was invisible to the followed
  // user and to every other device — and it fed the real follower counts shown right above it,
  // which therefore never moved.
  function handleToggleFollow() {
    const wasFollowing = isFollowing;
    toggleFollowFor(username); // optimistic
    if (targetUserId == null) return;
    const req = wasFollowing ? follows.remove(targetUserId) : follows.toggle(targetUserId);
    req
      .then(() => follows.counts(targetUserId))
      .then((c) => setCounts({ userId: targetUserId, ...c }))
      .catch(() => {
        toggleFollowFor(username); // revert
        toast.error("Couldn't update follow. Please try again.");
      });
  }

  if (profileNotFound) {
    return (
      <>
        <SiteHeader variant="app" />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-foreground mb-2">Profile not found</p>
            <Link href="/community" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back to community
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader variant="app" />
      <div
        className="min-h-screen"
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--gradient-page-start), var(--gradient-page-mid), var(--gradient-page-end))",
        }}
      >
        {/* Back link */}
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} /> Back to community
          </Link>
        </div>

        {/* Banner */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 mt-4">
          <div
            className="relative h-44 sm:h-52 w-full overflow-hidden rounded-t-[2.4rem]"
            style={{
              background: `linear-gradient(135deg, ${profileData.bannerTone[0]}, ${profileData.bannerTone[1]})`,
            }}
          >
            {/* Public profile badge */}
            <div className="absolute top-4 left-5 flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur-sm px-3 py-1.5">
              <Globe2 size={12} className="text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Public profile
              </span>
            </div>
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 to-background/80" />
          </div>
        </div>

        {/* Profile card */}
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-[2.3rem] bg-card/75 backdrop-blur-xl shadow-heavy px-6 sm:px-10 py-8 -mt-8 sm:-mt-12">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              {/* Avatar */}
              <div
                className="h-28 w-28 rounded-full shrink-0 -mt-16 sm:-mt-20 ring-4 ring-background"
                style={{
                  background: `linear-gradient(135deg, ${profileData.avatarTone[0]}, ${profileData.avatarTone[1]})`,
                }}
              >
                <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-foreground rounded-full">
                  {profileData.displayName.charAt(0)}
                </div>
              </div>

              <div className="flex-1">
                {/* Creator label + verified badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Creator profile
                  </span>
                  {profileData.isVerified && (
                    <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5">
                      <BadgeCheck size={12} className="text-brand" />
                      <span className="text-[10px] text-brand font-medium">
                        Verified designer
                      </span>
                    </span>
                  )}
                </div>

                {/* Name */}
                <h1 className="font-heading text-4xl sm:text-5xl tracking-[-0.05em] text-foreground">
                  {profileData.displayName}
                </h1>

                {/* @username + location */}
                <p className="text-sm text-muted-foreground mt-1">
                  @{profileData.username}
                  {profileData.location && <> · {profileData.location}</>}
                </p>

                {/* Bio */}
                {profileData.bio && (
                  <p className="text-sm leading-relaxed text-muted-foreground mt-3 max-w-lg">
                    {profileData.bio}
                  </p>
                )}

                {/* Aesthetic tags */}
                {profileData.styleAesthetics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {profileData.styleAesthetics.map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                {/* Follow button */}
                {!isOwnProfile && user && (
                  <button
                    onClick={handleToggleFollow}
                    aria-pressed={isFollowing}
                    aria-label={isFollowing ? `Unfollow ${username}` : `Follow ${username}`}
                    className={cn(
                      "mt-4 rounded-full px-6 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                      isFollowing
                        ? "border border-border text-muted-foreground"
                        : "bg-foreground text-background"
                    )}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>

              {/* Social stats (right side on desktop) */}
              <div className="flex sm:flex-col gap-6 sm:gap-4 sm:items-end sm:justify-start shrink-0">
                <StatBox label="Posts" value={userPosts.length} />
                <StatBox label="Followers" value={followCounts?.followers ?? 0} />
                <StatBox label="Following" value={followCounts?.following ?? 0} />
              </div>
            </div>
          </div>
        </div>

        {/* Outfit grid */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 mt-8 pb-16">
          <div className="rounded-[2.2rem] bg-card/90 backdrop-blur-xl shadow-heavy p-6">
            {/* Tab bar */}
            <div className="flex gap-4 mb-6 border-b border-border/60 pb-4">
              <button
                onClick={() => setOutfitTab("posts")}
                className={cn(
                  "text-sm font-medium transition-colors pb-2",
                  outfitTab === "posts"
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Outfit posts
              </button>
              <button
                onClick={() => setOutfitTab("tagged")}
                className={cn(
                  "text-sm font-medium transition-colors pb-2",
                  outfitTab === "tagged"
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tagged looks
              </button>
            </div>

            {/* Grid */}
            {/* Three distinct states. "No outfits yet" must mean exactly that — not
                "still loading" and not "the request failed", which is how an outage used to
                read on this grid. */}
            {postsFailed ? (
              <div role="alert" className="py-12 text-center text-sm text-foreground">
                <p>We couldn&apos;t load these outfits.</p>
                <button
                  type="button"
                  onClick={() => {
                    setPostsResult(null);
                    setPostsRetry((n) => n + 1);
                  }}
                  className="mt-2 font-medium text-brand underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            ) : postsLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Loading outfits…
              </p>
            ) : displayPosts.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">
                No outfits yet
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayPosts.map((post) => {
                  const gradient = parseGradient(post.image);
                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="group relative aspect-[4/5] rounded-[1.5rem] overflow-hidden transition-transform hover:scale-105"
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          background: gradient
                            ? `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`
                            : "var(--color-muted)",
                        }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-4 text-background">
                          <span className="flex items-center gap-1">
                            <Heart size={16} fill="currentColor" /> {post.likeCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircleMore size={16} /> {post.comments.length}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PostDetailDialog */}
        {selectedPost && (
          <PostDetailDialog
            post={selectedPost}
            open={!!selectedPost}
            onOpenChange={(open) => {
              if (!open) setSelectedPost(null);
            }}
            onUpdate={(updated) => {
              setSelectedPost(updated);
              handlePostUpdate(updated); // persists — the hook mirrors to storage
            }}
            currentUserName={user?.name ?? undefined}
            currentUserHandle={user?.username ?? undefined}
          />
        )}
      </div>
    </>
  );
}
