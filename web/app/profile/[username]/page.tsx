"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Globe2, Heart, MessageCircleMore } from "lucide-react";
import { findSocialProfile } from "@/lib/social-graph";
import {
  loadCommunityState,
  saveCommunityState,
  toggleFollow,
  updatePostInState,
  type SocialPost,
} from "@/lib/community-feed";
import { PostDetailDialog } from "@/components/PostDetailDialog";
import { useAuth } from "@/lib/auth-context";
import { NavBar } from "@/components/NavBar";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";

interface PublicProfileResponse {
  username: string;
  name: string | null;
  isDesigner: boolean;
  styleAesthetics: string[];
  avatarMode: string | null;
  avatarPreset: string | null;
  createdAt: string | null;
}

function profileFollowerEstimate(
  followedCount: number,
  postCount: number,
  aestheticCount: number
): number {
  return 240 + followedCount * 12 + postCount * 18 + aestheticCount * 14;
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

  useEffect(() => {
    if (!username) return;
    api.get<PublicProfileResponse>("/api/auth/users/profile/" + username)
      .then((data) => setServerProfile(data))
      .catch(() => setServerProfile(null));
  }, [username]);

  const socialProfile = findSocialProfile(username);
  const isOwnProfile = user?.username === username;

  // serverProfile === undefined: still loading; null: API returned 404/error
  const profileNotFound = serverProfile === null && !socialProfile && !isOwnProfile;

  const profileData = serverProfile != null ? {
        displayName: serverProfile.name ?? serverProfile.username,
        username: serverProfile.username,
        bio: "",
        avatarTone: ["#e2d9d7", "#d7efe7"] as [string, string],
        bannerTone: ["#f5efe8", "#e8e0d5"] as [string, string],
        location: "",
        headline: "",
        styleAesthetics: serverProfile.styleAesthetics ?? [],
        isVerified: serverProfile.isDesigner,
        followerCount: profileFollowerEstimate(0, 0, serverProfile.styleAesthetics?.length ?? 0),
        followingCount: 0,
        outfitCount: 0,
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
        followerCount: socialProfile.followerCount,
        followingCount: socialProfile.followingCount,
        outfitCount: socialProfile.outfitCount,
      }
    : isOwnProfile && user
    ? {
        displayName: user.name ?? username,
        username: username,
        bio: `Fashion enthusiast on ${BRAND.name}`,
        avatarTone: ["#e2d9d7", "#d7efe7"] as [string, string],
        bannerTone: ["#f5efe8", "#e8e0d5"] as [string, string],
        location: "",
        headline: "",
        styleAesthetics: user.styleAesthetics ?? [],
        isVerified: false,
        followerCount: profileFollowerEstimate(0, 0, user.styleAesthetics?.length ?? 0),
        followingCount: 0,
        outfitCount: 0,
      }
    : {
        displayName: username.replace(/\./g, " "),
        username,
        bio: "",
        avatarTone: ["#d9d1d7", "#cfc9c6"] as [string, string],
        bannerTone: ["#ece6df", "#d7e3e8"] as [string, string],
        location: "",
        headline: "",
        styleAesthetics: [],
        isVerified: false,
        followerCount: 0,
        followingCount: 0,
        outfitCount: 0,
      };

  const [state, setState] = useState<{
    followedUsernames: string[];
    posts: SocialPost[];
  } | null>(null);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [outfitTab, setOutfitTab] = useState<"posts" | "tagged">("posts");

  useEffect(() => {
    if (!user) return;
    const loaded = loadCommunityState(
      String(user.id),
      user.name ?? "",
      user.username ?? "",
      user.styleAesthetics?.[0] ?? "Everyday"
    );
    setState(loaded);
  }, [user]);

  const userPosts = state?.posts.filter((p) => p.creatorUsername === username) ?? [];
  const taggedPosts =
    state?.posts.filter(
      (p) => p.productLinks.length > 0 && p.creatorUsername === username
    ) ?? [];
  const displayPosts = outfitTab === "posts" ? userPosts : taggedPosts;

  const isFollowing = state?.followedUsernames.includes(username) ?? false;

  function handleToggleFollow() {
    const next = state ? toggleFollow(state, username) : state;
    setState(next);
    if (user && next) saveCommunityState(String(user.id), next);
  }

  if (profileNotFound) {
    return (
      <>
        <NavBar />
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
      <NavBar />
      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(180deg, #f8f2ea 0%, #f5efe8 50%, #fbf6f1 100%)",
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
            <div className="absolute top-4 left-5 flex items-center gap-1.5 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-sm px-3 py-1.5">
              <Globe2 size={12} className="text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Public profile
              </span>
            </div>
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-white/82" />
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
                <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white rounded-full">
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
                    <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5">
                      <BadgeCheck size={12} className="text-purple-500" />
                      <span className="text-[10px] text-purple-600 font-medium">
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
                <StatBox
                  label="Posts"
                  value={profileData.outfitCount || userPosts.length}
                />
                <StatBox label="Followers" value={profileData.followerCount} />
                <StatBox label="Following" value={profileData.followingCount} />
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
            {displayPosts.length === 0 ? (
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
                            : "#f5efe8",
                        }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-4 text-white">
                          <span className="flex items-center gap-1">
                            <Heart size={16} fill="white" /> {post.likeCount}
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
              setState((prev) =>
                prev ? updatePostInState(prev, updated) : prev
              );
            }}
            currentUserName={user?.name ?? undefined}
            currentUserHandle={user?.username ?? undefined}
          />
        )}
      </div>
    </>
  );
}
