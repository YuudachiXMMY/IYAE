"use client";

import { LandingNav } from "@/components/home/LandingNav";
import HeroSection from "@/components/home/HeroSection";
import TrustBar from "@/components/home/TrustBar";
import PhotoStrip from "@/components/home/PhotoStrip";
import AIStylistSection from "@/components/home/AIStylistSection";
import TryOnSection from "@/components/home/TryOnSection";
import DesignersSection from "@/components/home/DesignersSection";
import HowItWorks from "@/components/home/HowItWorks";
import LifestyleGrid from "@/components/home/LifestyleGrid";
import SocialProofSection from "@/components/home/SocialProofSection";
import CTASection from "@/components/home/CTASection";
import { LandingFooter } from "@/components/home/LandingFooter";

const STRIP_A = [
  { src: "https://images.pexels.com/photos/5325695/pexels-photo-5325695.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Gen Z street style" },
  { src: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&fit=crop&auto=format&q=80", alt: "Street style walk" },
  { src: "https://images.pexels.com/photos/5325623/pexels-photo-5325623.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Fashion editorial" },
  { src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&fit=crop&auto=format&q=80", alt: "Fashion model pose" },
  { src: "https://images.pexels.com/photos/6988653/pexels-photo-6988653.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Independent designer piece" },
  { src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300&fit=crop&auto=format&q=80", alt: "Shopping with friends" },
  { src: "https://images.pexels.com/photos/5325640/pexels-photo-5325640.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Fashion accessories" },
  { src: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&fit=crop&auto=format&q=80", alt: "Designer handbag look" },
];

const STRIP_B = [
  { src: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=300&fit=crop&auto=format&q=80", alt: "Sunlit fashion portrait" },
  { src: "https://images.pexels.com/photos/9771806/pexels-photo-9771806.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Fashion portrait" },
  { src: "https://images.unsplash.com/photo-1613053342692-d0012e0444eb?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8Z2VuJTIwenxlbnwwfHwwfHx8MA%3D%3D", alt: "Urban Gen Z style" },
  { src: "https://images.pexels.com/photos/5325711/pexels-photo-5325711.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Designer fashion" },
  { src: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=300&fit=crop&auto=format&q=80", alt: "Editorial lookbook" },
  { src: "https://images.pexels.com/photos/9653877/pexels-photo-9653877.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Youth fashion" },
  { src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=300&fit=crop&auto=format&q=80", alt: "On-location fashion pose" },
  { src: "https://images.pexels.com/photos/5325774/pexels-photo-5325774.jpeg?auto=compress&cs=tinysrgb&w=300", alt: "Indie fashion look" },
];

export function ImmersiveHomepage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <LandingNav />
      <HeroSection />
      <PhotoStrip photos={STRIP_A} direction="left" height="h-32" speed={35} />
      {/* <TrustBar /> */}
      <AIStylistSection />
      {/* <PhotoStrip photos={STRIP_B} direction="right" height="h-28" speed={40} /> */}
      <TryOnSection />
      <DesignersSection />
      <LifestyleGrid />
      <HowItWorks />
      <SocialProofSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
