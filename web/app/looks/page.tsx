"use client";

import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { SavedPiecesPanel } from "@/components/dashboard/SavedPiecesPanel";

// Standalone /looks route. The saved-looks content lives in SavedPiecesPanel so
// it can also be surfaced inline by the /dashboard "Saved Pieces" tab.
export default function LooksPage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <SavedPiecesPanel />
      </PageShell>
      <Footer />
    </>
  );
}
