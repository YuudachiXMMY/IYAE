"use client";

import Link from "next/link";
import {
  ArrowRight,
  Eye,
  Cube,
  PencilLine,
  Storefront,
  ChartLineUp,
  UsersThree,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { LandingNav } from "@/components/home/LandingNav";
import { LandingFooter } from "@/components/home/LandingFooter";

// ── Motion presets ───────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

// ── Capability Card ──────────────────────────────────────────────────────────

function CapabilityCard({
  icon: Icon,
  title,
  description,
  href,
  cta,
  featured = false,
  index,
}: {
  icon: Icon;
  title: string;
  description: string;
  href: string;
  cta: string;
  featured?: boolean;
  index: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`bg-card/80 backdrop-blur-sm rounded-3xl border border-border/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-heavy ${
        featured ? "p-10 lg:p-12" : "p-8"
      }`}
    >
      <div
        className={`bg-landing-surface rounded-2xl flex items-center justify-center mb-6 ${
          featured ? "w-16 h-16" : "w-14 h-14"
        }`}
      >
        <Icon
          size={featured ? 32 : 28}
          weight="duotone"
          className="text-landing-accent"
        />
      </div>

      <h3
        className={`font-display font-semibold text-foreground mb-4 ${
          featured ? "text-3xl" : "text-2xl"
        }`}
      >
        {title}
      </h3>

      <p
        className={`text-muted-foreground leading-relaxed mb-6 ${
          featured ? "text-base max-w-md" : "text-sm"
        }`}
      >
        {description}
      </p>

      <Link
        href={href}
        className="group inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-landing-accent transition-colors"
      >
        {cta}
        <ArrowRight
          size={16}
          weight="bold"
          className="transition-transform duration-300 group-hover:translate-x-1"
        />
      </Link>
    </motion.div>
  );
}

// ── Stat Block ───────────────────────────────────────────────────────────────

function StatBlock({
  value,
  label,
  index,
}: {
  value: string;
  label: string;
  index: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.6,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="text-center"
    >
      <p className="font-display text-4xl md:text-5xl font-bold text-landing-accent">
        {value}
      </p>
      <p className="text-muted-foreground text-sm mt-2">{label}</p>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DesignPage() {
  const reduce = useReducedMotion();

  return (
    <>
      <LandingNav />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100dvh] flex items-center pt-20 pb-16 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: Content */}
            <motion.div
              initial={reduce ? false : "hidden"}
              animate="visible"
              variants={stagger}
            >
              <motion.p
                variants={fadeUp}
                className="text-sm font-medium tracking-wide text-landing-accent mb-4"
              >
                For independent designers
              </motion.p>

              <motion.h1
                variants={fadeUp}
                className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8"
              >
                Your Work,
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-foreground) 0%, var(--color-landing-accent) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Seen in 3D.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg"
              >
                Showcase garments on realistic avatars. Let shoppers rotate,
                zoom, and try on your pieces before they buy. Fewer returns,
                more confident customers.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link
                  href="/register"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-foreground text-background text-sm font-semibold rounded-full hover:bg-landing-accent transition-all duration-300 hover:shadow-xl active:scale-[0.98]"
                >
                  Join as a Designer
                  <ArrowRight
                    size={18}
                    weight="bold"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>

                <Link
                  href="/products"
                  className="inline-flex items-center justify-center px-8 py-4 border border-border text-foreground text-sm font-semibold rounded-full hover:bg-foreground hover:text-background transition-all duration-300 active:scale-[0.98]"
                >
                  Browse the collection
                </Link>
              </motion.div>
            </motion.div>

            {/* Right: Visual */}
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="relative group rounded-3xl overflow-hidden aspect-[4/5] shadow-2xl">
                <img
                  src="https://picsum.photos/seed/clossette-atelier/800/1000"
                  alt="Designer working in their studio"
                  className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-landing-contrast/50 via-transparent to-transparent" />

                <div className="absolute bottom-6 left-6 right-6 bg-card/80 backdrop-blur-xl rounded-2xl p-5 border border-border/30">
                  <p className="text-sm font-medium text-foreground">
                    Your garments, rendered in real time
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a GLB and customers see it on their body
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Platform capabilities ────────────────────────────────────── */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-20 max-w-2xl"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Tools built for makers
            </h2>
            <p className="text-muted-foreground">
              Everything you need to go from studio to storefront — without
              giving up creative control.
            </p>
          </motion.div>

          {/* Asymmetric layout: featured left + stacked right */}
          <div className="grid lg:grid-cols-2 gap-8">
            <CapabilityCard
              icon={Eye}
              title="AR try-on"
              description="Customers see your pieces on themselves in real time using augmented reality. It turns browsing into trying — and trying into buying."
              href="/try-on"
              cta="See the AR experience"
              featured
              index={0}
            />
            <div className="flex flex-col gap-8">
              <CapabilityCard
                icon={Cube}
                title="3D viewer"
                description="Upload GLB files and let shoppers rotate, zoom, and inspect garments from every angle."
                href="/outfits"
                cta="Explore the viewer"
                index={1}
              />
              <CapabilityCard
                icon={PencilLine}
                title="Designer studio"
                description="List products, manage inventory, and track orders through a studio built for independent creators."
                href="/register"
                cta="Open your studio"
                index={2}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats strip ──────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-landing-contrast" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <StatBlock value="250+" label="Independent designers" index={0} />
            <StatBlock value="-60%" label="Return rates" index={1} />
            <StatBlock value="12k" label="Garments in 3D" index={2} />
            <StatBlock value="98%" label="Designer satisfaction" index={3} />
          </div>
        </div>
      </section>

      {/* ─── Why designers choose IYAE ──────────────────────────── */}
      <section className="py-32 relative overflow-hidden">
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
              Why designers stay
            </h2>
            <p className="text-muted-foreground">
              We built this for people who care about craft. No algorithms
              burying your work. No race to the bottom on price.
            </p>
          </motion.div>

          {/* Asymmetric 3 + 2 split */}
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Large card */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-3 h-full bg-card/80 backdrop-blur-sm rounded-3xl border border-border/30 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-heavy relative overflow-hidden"
            >
              <img
                src="https://picsum.photos/seed/clossette-studio-work/600/400"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-[0.06]"
                loading="lazy"
                aria-hidden="true"
              />
              <div className="relative p-10">
                <div className="w-14 h-14 bg-gradient-to-br from-landing-tone to-landing-accent rounded-2xl flex items-center justify-center mb-6">
                  <Storefront
                    size={28}
                    weight="duotone"
                    className="text-white"
                  />
                </div>

                <h3 className="font-display text-3xl font-semibold mb-4 text-foreground">
                  Your brand, front and center
                </h3>

                <p className="text-muted-foreground leading-relaxed mb-8 max-w-sm">
                  Every product page is yours. Your story, your photography,
                  your pricing. We handle the tech so you can focus on what you
                  make.
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-9 h-9 rounded-full bg-landing-surface border-2 border-card" />
                    <div className="w-9 h-9 rounded-full bg-landing-tone border-2 border-card" />
                    <div className="w-9 h-9 rounded-full bg-landing-accent border-2 border-card" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Join 250+ designers
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Stacked cards */}
            <div className="lg:col-span-2 flex flex-col gap-8">
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
                  <ChartLineUp
                    size={24}
                    weight="duotone"
                    className="text-white"
                  />
                </div>
                <h3 className="font-display text-2xl font-semibold mb-3 text-foreground">
                  Real-time analytics
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  See which pieces get the most views, try-ons, and saves.
                  Adjust your collection based on actual shopper behavior.
                </p>
              </motion.div>

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
                  <UsersThree
                    size={24}
                    weight="duotone"
                    className="text-white"
                  />
                </div>
                <h3 className="font-display text-2xl font-semibold mb-3 text-foreground">
                  Built-in audience
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Our community of 18–30 year olds is actively looking for
                  independent designers. You don&apos;t start from zero.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-32 relative">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 32, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-landing-contrast/85 backdrop-blur-xl rounded-[2.5rem] p-12 md:p-20 relative overflow-hidden border border-white/10">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-landing-accent/20 to-transparent" />

              <div className="relative z-10">
                <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
                  Ready to open your studio?
                </h2>
                <p className="text-white/60 text-base max-w-lg mx-auto mb-10">
                  List your first product in minutes. Upload a photo, we
                  generate the 3D model. Your customers do the rest.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/register"
                    className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-paper text-landing-contrast text-sm font-bold rounded-full hover:bg-landing-surface transition-all duration-300 hover:shadow-xl active:scale-[0.98]"
                  >
                    Apply as a Designer
                    <ArrowRight
                      size={18}
                      weight="bold"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                  <Link
                    href="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-10 py-4 border border-white/30 text-white text-sm font-bold rounded-full hover:bg-paper/10 transition-all duration-300 active:scale-[0.98]"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
