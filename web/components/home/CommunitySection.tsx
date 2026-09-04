"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  UserPlus,
  Heart,
  ShareNetwork,
  BookmarkSimple,
} from "@phosphor-icons/react";

function FollowCreatorsCard() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="h-full bg-card/80 backdrop-blur-sm rounded-3xl border border-border/30 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-heavy relative overflow-hidden"
    >
      {/* Subtle background image for visual texture */}
      <img
        src="https://picsum.photos/seed/clossette-community-bg/600/400"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-[0.06]"
        loading="lazy"
        aria-hidden="true"
      />

      <div className="relative p-10">
        <div className="w-14 h-14 bg-gradient-to-br from-landing-tone to-landing-accent rounded-2xl flex items-center justify-center mb-6">
          <UserPlus size={28} weight="duotone" className="text-white" />
        </div>

        <h3 className="font-display text-3xl font-semibold mb-4 text-foreground">
          Follow Creators
        </h3>

        <p className="text-muted-foreground leading-relaxed mb-8 max-w-sm">
          Follow designers, stylists, and fashion-forward users. Build your
          personal feed of looks that match your vibe.
        </p>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-9 h-9 rounded-full bg-landing-surface border-2 border-card" />
            <div className="w-9 h-9 rounded-full bg-landing-tone border-2 border-card" />
            <div className="w-9 h-9 rounded-full bg-landing-accent border-2 border-card" />
          </div>
          <span className="text-sm text-muted-foreground">
            +2,400 following
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function LikeSaveCard() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.6,
        delay: 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="bg-card/80 backdrop-blur-sm rounded-3xl p-8 border border-border/30 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-heavy"
    >
      <div className="w-12 h-12 bg-gradient-to-br from-landing-highlight to-landing-accent rounded-2xl flex items-center justify-center mb-5">
        <Heart size={24} weight="duotone" className="text-white" />
      </div>

      <h3 className="font-display text-2xl font-semibold mb-3 text-foreground">
        Like & Save
      </h3>

      <p className="text-muted-foreground leading-relaxed mb-5 text-sm">
        Heart looks you love and save outfits to your personal collections.
      </p>

      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <Heart size={18} weight="fill" className="text-landing-highlight" />
          <span className="text-sm font-medium text-foreground">1.2k</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BookmarkSimple
            size={18}
            weight="fill"
            className="text-landing-accent"
          />
          <span className="text-sm font-medium text-foreground">86 saved</span>
        </div>
      </div>
    </motion.div>
  );
}

function ShareStyleCard() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.6,
        delay: 0.2,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="bg-card/80 backdrop-blur-sm rounded-3xl p-8 border border-border/30 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-heavy"
    >
      <div className="w-12 h-12 bg-gradient-to-br from-foreground to-landing-tone rounded-2xl flex items-center justify-center mb-5">
        <ShareNetwork size={24} weight="duotone" className="text-white" />
      </div>

      <h3 className="font-display text-2xl font-semibold mb-3 text-foreground">
        Share Your Style
      </h3>

      <p className="text-muted-foreground leading-relaxed text-sm">
        Post your generated outfits, gain followers, and become a style
        inspiration. Your closet becomes your content.
      </p>
    </motion.div>
  );
}

export default function CommunitySection() {
  const reduce = useReducedMotion();

  return (
    <section id="community" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-landing-surface/30 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16 max-w-2xl"
        >
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Your Fashion Community
          </h2>
          <p className="text-muted-foreground">
            More than shopping. Discover looks, follow creators, and curate your
            style.
          </p>
        </motion.div>

        {/* Asymmetric grid: 3 + 2 split */}
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <FollowCreatorsCard />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-8">
            <LikeSaveCard />
            <ShareStyleCard />
          </div>
        </div>
      </div>
    </section>
  );
}
