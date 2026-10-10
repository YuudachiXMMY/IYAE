"use client";

import { motion, useReducedMotion } from "motion/react";
import { BRAND } from "@/lib/brand";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

/**
 * Viewport 1 — the IYAE reveal. A full-bleed white stage with the wordmark
 * rendered enormous and centered, an uppercase capability subhead, and a
 * scroll cue anchored near the bottom. Motion is gated by useReducedMotion().
 */
export default function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <motion.div
        initial={reduce ? false : "hidden"}
        animate="visible"
        variants={stagger}
        className="flex flex-col items-center"
      >
        <motion.h1
          variants={fadeUp}
          className="font-display text-[96px] leading-none tracking-[0.06em] text-brand md:text-[128px]"
        >
          {BRAND.name}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-8 text-[11px] uppercase tracking-[0.2em] text-foreground/80"
        >
          Personal Style · Intelligent Fit · Curated Shopping
        </motion.p>
      </motion.div>

      {/* Scroll cue anchored near the bottom */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
      >
        {/* A token, not an ad-hoc opacity on the ink: the 60%-opacity variant
            resolved to #737373 — 4.74:1 on white, 0.24 above AA, and outside
            the tokens token-contrast.test.ts pins. This one is 6.39:1. */}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Scroll to Discover
        </span>
        <span className="h-[30px] w-px bg-brand" aria-hidden="true" />
      </motion.div>
    </section>
  );
}
