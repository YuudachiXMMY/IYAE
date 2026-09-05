"use client";

import Link from "next/link";
import { Eye, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocalImagePicker } from "@/components/profile/LocalImagePicker";

interface ProfileHeaderProps {
  user: {
    id: number;
    name: string | null;
    email: string;
    username?: string | null;
    emailVerified: boolean;
    styleAesthetics?: string[] | null;
  };
  surface: {
    avatarDataUrl: string | null;
    bannerDataUrl: string | null;
    bio: string;
  };
  onUpdateSurface: (
    updates: Partial<{
      avatarDataUrl: string;
      bannerDataUrl: string;
      bio: string;
    }>
  ) => void;
}

export function ProfileHeader({ user, surface, onUpdateSurface }: ProfileHeaderProps) {
  const initials = user.name?.charAt(0).toUpperCase() ?? user.email.charAt(0).toUpperCase();
  const username = user.username;

  return (
    <div className="w-full">
      {/* Banner */}
      <div
        className="relative w-full overflow-hidden rounded-card"
        style={{ height: "180px" }}
      >
        {surface.bannerDataUrl ? (
          <img
            src={surface.bannerDataUrl}
            alt="Profile banner"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(135deg, var(--gradient-profile-banner-start), var(--gradient-profile-banner-end))",
            }}
          />
        )}

        {/* Banner upload button */}
        <div className="absolute right-3 top-3">
          <LocalImagePicker
            onSelect={(url) => onUpdateSurface({ bannerDataUrl: url })}
            maxDimension={1200}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-background/80"
            >
              <Camera className="h-3 w-3" />
              Add banner photo
            </button>
          </LocalImagePicker>
        </div>
      </div>

      {/* Avatar + identity */}
      <div className="px-4">
        {/* Avatar row */}
        <div className="flex items-end justify-between">
          <div className="relative -mt-12">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-background shadow-soft">
              {surface.avatarDataUrl ? (
                <img
                  src={surface.avatarDataUrl}
                  alt={`${user.username ?? user.name ?? "user"} avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand/10">
                  <span className="font-display text-3xl font-semibold text-brand">
                    {initials}
                  </span>
                </div>
              )}
            </div>

            {/* Avatar upload overlay */}
            <LocalImagePicker
              onSelect={(url) => onUpdateSurface({ avatarDataUrl: url })}
              maxDimension={400}
            >
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 opacity-0 transition-opacity hover:bg-foreground/30 hover:opacity-100"
                aria-label="Upload avatar photo"
              >
                <Camera className="h-5 w-5 text-background" />
              </button>
            </LocalImagePicker>
          </div>
        </div>

        {/* Identity */}
        <div className="mt-3 space-y-1">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {user.name ?? "No name set"}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {username && (
              <span className="text-sm text-muted-foreground">@{username}</span>
            )}
            <span className="text-sm text-muted-foreground">{user.email}</span>

            {username && (
              <Link
                href={`/profile/${username}`}
                className="flex items-center gap-1 text-sm text-brand hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />
                Public profile
              </Link>
            )}
          </div>
        </div>

        {/* Style tags */}
        {user.styleAesthetics && user.styleAesthetics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {user.styleAesthetics.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Bio */}
        <div className="mt-3">
          {surface.bio ? (
            <p className="text-sm leading-relaxed text-foreground">{surface.bio}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add a bio to tell people about your style...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
