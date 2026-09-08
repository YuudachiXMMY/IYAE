"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import {
  ArrowRight,
  Sparkle,
  Cube,
  ChatTeardropDots,
  UserCircle,
  BookmarkSimple,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";

// ── Motion presets ──────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

// ── Data ────────────────────────────────────────────────────────────────────

interface LabTool {
  icon: Icon;
  title: string;
  description: string;
  href: string;
  cta: string;
}

const FEATURED_TOOL: LabTool = {
  icon: ChatTeardropDots,
  title: "AI Stylist",
  description:
    "Describe an occasion or a mood. Your stylist pulls pieces from the collection, builds an outfit, and explains why it works.",
  href: "/chat",
  cta: "Start a conversation",
};

const TOOLS: LabTool[] = [
  {
    icon: Sparkle,
    title: "Outfit generator",
    description:
      "Pick an occasion, set your vibe, and get a full outfit assembled from real pieces in the collection.",
    href: "/outfits",
    cta: "Build an outfit",
  },
  {
    icon: Cube,
    title: "AR try-on",
    description:
      "See garments on your body in augmented reality before you commit.",
    href: "/ar-visualization",
    cta: "Open the viewer",
  },
  {
    icon: UserCircle,
    title: "My avatar",
    description:
      "Generate a 3D body model from your measurements. Every outfit preview fits you, not a mannequin.",
    href: "/profile/avatar",
    cta: "Build your avatar",
  },
  {
    icon: BookmarkSimple,
    title: "Saved looks",
    description:
      "Revisit outfits you bookmarked, compare variations, and refine your personal collection.",
    href: "/looks",
    cta: "View saved looks",
  },
];

// ── Featured card ───────────────────────────────────────────────────────────

function FeaturedCard({
  tool,
  reduce,
}: {
  tool: LabTool;
  reduce: boolean | null;
}) {
  const Icon = tool.icon;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={tool.href}
        className="group relative block overflow-hidden rounded-3xl bg-landing-contrast transition-all duration-500 hover:shadow-heavy active:scale-[0.99]"
      >
        {/* Ambient background image */}
        <img
          src="https://picsum.photos/seed/clossette-stylist/900/500"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12] transition-transform duration-700 group-hover:scale-105"
          loading="eager"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-landing-contrast/90 via-landing-contrast/70 to-landing-accent/20" />

        <div className="relative p-10 md:p-14 flex flex-col gap-8">
          <div className="flex items-start justify-between">
            <div className="w-16 h-16 rounded-2xl bg-paper/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Icon size={32} weight="duotone" className="text-white/90" />
            </div>
            <ArrowRight
              size={24}
              weight="bold"
              className="text-white/40 transition-all duration-300 group-hover:text-white group-hover:translate-x-1"
            />
          </div>

          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              {tool.title}
            </h2>
            <p className="text-white/60 leading-relaxed max-w-md text-base">
              {tool.description}
            </p>
          </div>

          <span className="inline-flex items-center gap-2 text-sm font-medium text-landing-accent group-hover:text-white transition-colors">
            {tool.cta}
            <ArrowRight
              size={14}
              weight="bold"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Standard card ───────────────────────────────────────────────────────────

function ToolCard({ tool, index }: { tool: LabTool; index: number }) {
  const reduce = useReducedMotion();
  const Icon = tool.icon;

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      initial={reduce ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <Link
        href={tool.href}
        className="group flex flex-col justify-between h-full rounded-3xl bg-card/80 backdrop-blur-sm border border-border/30 p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-heavy active:scale-[0.99]"
      >
        <div>
          <div className="flex items-start justify-between mb-6">
            <div className="w-14 h-14 rounded-2xl bg-landing-surface flex items-center justify-center transition-colors group-hover:bg-landing-tone/30">
              <Icon
                size={28}
                weight="duotone"
                className="text-landing-accent"
              />
            </div>
            <ArrowRight
              size={18}
              weight="bold"
              className="text-muted-foreground/50 transition-all duration-300 group-hover:text-landing-accent group-hover:translate-x-1"
            />
          </div>

          <h3 className="font-display text-2xl font-semibold text-foreground mb-2 tracking-tight">
            {tool.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tool.description}
          </p>
        </div>

        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground mt-6 group-hover:text-landing-accent transition-colors">
          {tool.cta}
        </span>
      </Link>
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StyleLabPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <>
      <SiteHeader variant="app" />
      <main className="min-h-screen pt-20 pb-24">
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-8 pb-12">
          <motion.div
            initial={reduce ? false : "hidden"}
            animate="visible"
            variants={stagger}
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-landing-accent mb-3"
            >
              Hey {firstName}
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="font-display text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-4"
            >
              Style Lab
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-muted-foreground text-lg max-w-lg leading-relaxed"
            >
              Your styling toolkit. Chat with your AI stylist, try pieces in AR,
              or build outfits from scratch.
            </motion.p>
          </motion.div>
        </section>

        {/* ─── Featured tool ───────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 lg:px-8 mb-8">
          <FeaturedCard tool={FEATURED_TOOL} reduce={reduce} />
        </section>

        {/* ─── Tool grid ───────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={reduce ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {TOOLS.map((tool, i) => (
              <ToolCard key={tool.href} tool={tool} index={i} />
            ))}
          </motion.div>
        </section>
      </main>
    </>
  );
}
