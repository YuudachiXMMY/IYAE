"use client";

import { humanizeNumber } from "@/lib/utils";

interface ProfileStatsBarProps {
  stats: {
    posts: number;
    followers: number;
    following: number;
    archives: number;
  };
  onClickFollowers: () => void;
  onClickFollowing: () => void;
  onClickArchives: () => void;
}

interface StatItemProps {
  label: string;
  value: number;
  onClick?: () => void;
}

function StatItem({ label, value, onClick }: StatItemProps) {
  const content = (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-semibold tabular-nums text-foreground">
        {humanizeNumber(value)}
      </span>
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl px-4 py-2 transition-colors hover:bg-muted/80"
      >
        {content}
      </button>
    );
  }

  return <div className="px-4 py-2">{content}</div>;
}

export function ProfileStatsBar({
  stats,
  onClickFollowers,
  onClickFollowing,
  onClickArchives,
}: ProfileStatsBarProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-2xl bg-card/80 px-1 py-1 shadow-soft backdrop-blur-sm">
      <StatItem label="Posts" value={stats.posts} />

      <div className="h-7 w-px bg-border/60" />

      <StatItem
        label="Followers"
        value={stats.followers}
        onClick={onClickFollowers}
      />

      <div className="h-7 w-px bg-border/60" />

      <StatItem
        label="Following"
        value={stats.following}
        onClick={onClickFollowing}
      />

      <div className="h-7 w-px bg-border/60" />

      <StatItem
        label="Archives"
        value={stats.archives}
        onClick={onClickArchives}
      />
    </div>
  );
}
