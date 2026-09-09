"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Style preferences now live in the in-app Settings panel (the right-side sheet
// opened from the dashboard and the profile menu). This standalone route is kept
// as a redirect so any bookmarked/legacy links still land somewhere sensible.
export default function PreferencesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
    </div>
  );
}
