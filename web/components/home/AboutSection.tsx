"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { SectionKicker } from "@/components/design-system/SectionKicker";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { AbstractForm } from "@/components/design-system/AbstractForm";

interface Pillar {
  number: string;
  title: string;
  copy: string;
}

const PILLARS: Pillar[] = [
  {
    number: "01",
    title: "Conversational Styling",
    copy: "Talk it through with an AI stylist that learns your taste and the occasion, then curates a look you would actually wear.",
  },
  {
    number: "02",
    title: "True-to-You Fit",
    copy: "See every piece on a 3D model built from your measurements. Virtual try-on means fewer surprises and near-zero returns.",
  },
  {
    number: "03",
    title: "Independent Designers",
    copy: "Shop a curated marketplace of indie labels — pieces with a point of view, not another algorithm's bestseller.",
  },
];

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

/**
 * Viewport 2 — About IYAE. Editorial intro (kicker + heading + copy + CTA),
 * a hairline, three numbered pillars, and a full-width commerce banner with
 * abstract-form decoration. Scroll-reveal motion gated by useReducedMotion().
 */
export function AboutSection() {
  const reduce = useReducedMotion();
  const inViewProps = reduce
    ? {}
    : ({
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, amount: 0.3 },
      } as const);

  return (
    <section className="bg-background px-6 py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-7xl">
        {/* Editorial intro */}
        <motion.div
          {...inViewProps}
          variants={stagger}
          className="max-w-2xl"
        >
          <motion.div variants={reveal}>
            <SectionKicker>About {BRAND.name}</SectionKicker>
          </motion.div>
          <motion.div variants={reveal}>
            <EditorialHeading className="mt-5">
              Fashion that knows you.
            </EditorialHeading>
          </motion.div>
          <motion.p
            variants={reveal}
            className="mt-6 text-[15px] leading-relaxed text-muted-foreground"
          >
            {BRAND.name} pairs a conversational AI stylist with 3D virtual
            try-on and a curated marketplace of independent designers — so you
            move from &ldquo;nothing to wear&rdquo; to &ldquo;this is the
            one&rdquo; without the guesswork, and without the returns.
          </motion.p>
          <motion.div variants={reveal} className="mt-9">
            <Button variant="brand-pill" size="pill" asChild>
              <Link href="/products">Shop {BRAND.name}</Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Hairline */}
        <div className="mt-16 border-t border-border lg:mt-20" />

        {/* Numbered pillars */}
        <motion.div
          {...inViewProps}
          variants={stagger}
          className="grid grid-cols-1 gap-px md:grid-cols-3"
        >
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.number}
              variants={reveal}
              className={
                i > 0
                  ? "pt-10 md:pl-10 md:pt-12 md:border-l md:border-border"
                  : "pt-10 md:pt-12"
              }
            >
              <span className="font-body text-[13px] font-semibold text-brand">
                {pillar.number}
              </span>
              <h3 className="mt-4 font-body text-[18px] font-medium text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
                {pillar.copy}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Commerce banner */}
        <motion.div
          {...inViewProps}
          variants={reveal}
          className="relative mt-16 overflow-hidden rounded-card border border-border bg-muted/40 px-8 py-14 lg:mt-24 lg:px-16 lg:py-20"
        >
          {/* Abstract decoration, right-aligned */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 items-center justify-end gap-6 pr-8 md:flex"
            aria-hidden="true"
          >
            <AbstractForm
              tint={25}
              rounded="rounded-[80px]"
              className="h-48 w-24"
            />
            <AbstractForm
              tint={12}
              rounded="rounded-[60px]"
              className="h-64 w-32"
            />
          </div>

          <div className="relative max-w-xl">
            <SectionKicker>The Marketplace</SectionKicker>
            <EditorialHeading as="h2" className="mt-5">
              Considered pieces, from designers worth knowing.
            </EditorialHeading>
            <Link
              href="/products"
              className="mt-8 inline-flex items-center gap-2 font-body text-[13px] font-semibold uppercase tracking-[0.12px] text-brand transition-colors hover:text-foreground"
            >
              Explore the shop
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
