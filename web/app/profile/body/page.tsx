"use client";

import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { MeasurementsPanel } from "@/components/dashboard/MeasurementsPanel";

// Standalone /profile/body route. The measurement form lives in MeasurementsPanel
// so it can also be surfaced inline by the /dashboard "Measurements" tab.
export default function BodyProfilePage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="mx-auto max-w-lg space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <MeasurementsPanel initialGenderIdentity={user.genderIdentity} />
      </PageShell>
      <Footer />
    </>
  );
}
