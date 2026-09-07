"use client";

import { SiteHeader } from "@/components/design-system/SiteHeader";
import HeroSection from "@/components/home/HeroSection";
import { AboutSection } from "@/components/home/AboutSection";
import { LandingFooter } from "@/components/home/LandingFooter";

export function ImmersiveHomepage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader variant="landing" />
      <HeroSection />
      <AboutSection />
      <LandingFooter />
    </div>
  );
}
