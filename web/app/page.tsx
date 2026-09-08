"use client";

import { useRedirectIfAuthenticated } from "@/lib/hooks/useRedirectIfAuthenticated";
import { ImmersiveHomepage } from "@/components/home/immersive-homepage";

export default function HomePage() {
  // Signed-in users skip the marketing landing and land on their dashboard.
  // Guests (and the pre-hydration tick) still get the full homepage.
  const { isAuthenticated } = useRedirectIfAuthenticated("/dashboard");
  if (isAuthenticated) return null;
  return <ImmersiveHomepage />;
}
