"use client";

import { Plus, Settings } from "lucide-react";

interface ProfileActionBarProps {
  onMakePost: () => void;
  onOpenSettings: () => void;
}

export function ProfileActionBar({ onMakePost, onOpenSettings }: ProfileActionBarProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMakePost}
        className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-soft transition-all duration-150 hover:opacity-85 active:scale-[0.97]"
      >
        <Plus className="h-4 w-4" />
        New post
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]"
        aria-label="Profile settings"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}
