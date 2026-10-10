"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { follows, type PublicUserSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { BadgeCheck, ExternalLink, MapPin } from "lucide-react";

interface StyleCircleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current user's numeric id — used to load the REAL follower/following graph. */
  currentUserId: number;
  /** Local demo follow graph (kept in sync on toggle; not the source of truth for counts). */
  followedUsernames: string[];
  onToggleFollow: (username: string) => void;
  initialTab?: "followers" | "following";
}

/** View-model for a real server user rendered in the circle. */
interface CircleUser {
  id: number;
  username: string;
  displayName: string;
  bio: string;
  isVerified: boolean;
  avatarTone: [string, string];
  location: string;
  headline: string;
  styleAesthetics: string[];
}

function fromUserResponse(u: PublicUserSummary): CircleUser {
  return {
    id: u.id,
    username: u.username ?? String(u.id),
    displayName: u.name ?? u.username ?? String(u.id),
    bio: "",
    isVerified: u.role === "DESIGNER",
    avatarTone: ["var(--color-muted)", "var(--color-card)"],
    location: "",
    headline: "",
    styleAesthetics: u.styleAesthetics ?? [],
  };
}

function GradientAvatar({
  profile,
  size = "sm",
}: {
  profile: CircleUser;
  size?: "sm" | "lg";
}) {
  const initial = profile.displayName.charAt(0).toUpperCase();
  const sizeClass = size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm";

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-foreground/70 shrink-0",
        sizeClass
      )}
      style={{
        background: `linear-gradient(135deg, ${profile.avatarTone[0]}, ${profile.avatarTone[1]})`,
      }}
    >
      {initial}
    </div>
  );
}

function UserListItem({
  profile,
  isFollowing,
  isSelected,
  onSelect,
  onToggleFollow,
}: {
  profile: CircleUser;
  isFollowing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFollow: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors",
        isSelected ? "bg-muted" : "hover:bg-muted/50"
      )}
    >
      <GradientAvatar profile={profile} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-foreground truncate">
            {profile.displayName}
          </span>
          {profile.isVerified && (
            <BadgeCheck className="h-3.5 w-3.5 text-brand shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
        {profile.bio && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{profile.bio}</p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFollow();
        }}
        className={cn(
          "shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors",
          isFollowing
            ? "border border-border text-muted-foreground hover:text-foreground"
            : "bg-foreground text-background hover:opacity-80"
        )}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </button>
  );
}

function DetailCard({
  profile,
  isFollowing,
  onToggleFollow,
}: {
  profile: CircleUser;
  isFollowing: boolean;
  onToggleFollow: () => void;
}) {
  return (
    <div className="flex flex-col h-full p-5 gap-4">
      <div className="flex items-start gap-4">
        <GradientAvatar profile={profile} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">
              {profile.displayName}
            </h3>
            {profile.isVerified && (
              <BadgeCheck className="h-4 w-4 text-brand shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.location && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{profile.location}</span>
            </div>
          )}
        </div>
      </div>

      {profile.headline && (
        <p className="text-sm font-medium text-foreground italic">
          &ldquo;{profile.headline}&rdquo;
        </p>
      )}

      {profile.bio && (
        <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
      )}

      {profile.styleAesthetics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.styleAesthetics.map((aesthetic) => (
            <Badge key={aesthetic} variant="secondary" className="text-xs font-normal">
              {aesthetic}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button
          onClick={onToggleFollow}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-semibold rounded-full transition-colors",
            isFollowing
              ? "border border-border text-muted-foreground hover:text-foreground"
              : "bg-foreground text-background hover:opacity-80"
          )}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
        <Link
          href={`/profile/${profile.username}`}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full border border-border text-foreground hover:bg-muted transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Profile
        </Link>
      </div>
    </div>
  );
}

export function StyleCircleDialog({
  open,
  onOpenChange,
  currentUserId,
  onToggleFollow,
  initialTab = "followers",
}: StyleCircleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[2rem]">
        {/* The body opens on `initialTab`, so it is remounted per open instead of
            an effect re-syncing the tab after the fact. */}
        <CircleBody
          key={`${open}-${initialTab}`}
          currentUserId={currentUserId}
          initialTab={initialTab}
          onToggleFollow={onToggleFollow}
        />
      </DialogContent>
    </Dialog>
  );
}

function CircleBody({
  currentUserId,
  initialTab,
  onToggleFollow,
}: {
  currentUserId: number;
  initialTab: "followers" | "following";
  onToggleFollow: (username: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"followers" | "following">(initialTab);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [followers, setFollowers] = useState<CircleUser[]>([]);
  const [following, setFollowing] = useState<CircleUser[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());

  // Load the REAL follower/following graph (replaces the old SOCIAL_PROFILES.slice(0,5) fabrication).
  useEffect(() => {
    const ctrl = new AbortController();
    follows
      .followers(currentUserId, 0, 50, ctrl.signal)
      .then((p) => setFollowers(p.content.map(fromUserResponse)))
      .catch(() => setFollowers([]));
    follows
      .following(currentUserId, 0, 50, ctrl.signal)
      .then((p) => {
        const mapped = p.content.map(fromUserResponse);
        setFollowing(mapped);
        setFollowedIds(new Set(mapped.map((u) => u.id)));
      })
      .catch(() => setFollowing([]));
    return () => ctrl.abort();
  }, [currentUserId]);

  const activeList = activeTab === "followers" ? followers : following;

  const selectedUser =
    selectedUserId != null
      ? [...followers, ...following].find((u) => u.id === selectedUserId) ?? null
      : null;

  function handleToggle(u: CircleUser) {
    const willFollow = !followedIds.has(u.id);
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (willFollow) next.add(u.id);
      else next.delete(u.id);
      return next;
    });
    onToggleFollow(u.username); // keep the local demo graph in sync
    const req = willFollow ? follows.toggle(u.id) : follows.remove(u.id);
    req.catch(() =>
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (willFollow) next.delete(u.id);
        else next.add(u.id);
        return next;
      })
    );
  }

  return (
    <div className="grid md:grid-cols-[1fr_1fr] min-h-[480px]">
      {/* Left panel — user list */}
      <div className="flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Style Circle</DialogTitle>
          <div className="flex gap-1 mt-2">
            {(["followers", "following"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedUserId(null);
                }}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold rounded-full capitalize transition-colors",
                  activeTab === tab
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab}
                <span className="ml-1.5 opacity-60">
                  {tab === "followers" ? followers.length : following.length}
                </span>
              </button>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-3 pb-4">
          {activeList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {activeTab === "following"
                ? "Not following anyone yet."
                : "No followers yet."}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {activeList.map((profile) => (
                <UserListItem
                  key={profile.id}
                  profile={profile}
                  isFollowing={followedIds.has(profile.id)}
                  isSelected={selectedUserId === profile.id}
                  onSelect={() => setSelectedUserId(profile.id)}
                  onToggleFollow={() => handleToggle(profile)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <Separator orientation="vertical" className="hidden md:block" />

      {/* Right panel — detail card */}
      <div className="hidden md:flex flex-col">
        {selectedUser ? (
          <DetailCard
            profile={selectedUser}
            isFollowing={followedIds.has(selectedUser.id)}
            onToggleFollow={() => handleToggle(selectedUser)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-muted-foreground text-center">
              Select a user to view their profile
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StyleCircleDialog;
