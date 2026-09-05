"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
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

export default function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] flex items-end pb-16 pt-16 overflow-hidden bg-landing-contrast">
      {/* Cinematic warm gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--gradient-hero-start) 0%, var(--gradient-hero-mid) 50%, var(--gradient-hero-end) 100%)",
        }}
      />

      {/* Subtle terracotta accent glow */}
      <div
        className="absolute top-12 right-1/4 w-[600px] h-[500px] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "var(--color-landing-accent)" }}
      />

      {/* Gen Z fashion photo collage */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-20 left-1/2 -translate-x-1/2 w-[520px] h-[560px]"
      >
        {/* Center photo */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[280px] h-[400px] rounded-lg overflow-hidden shadow-2xl">
          <img
            src="https://images.pexels.com/photos/5325695/pexels-photo-5325695.jpeg?auto=compress&cs=tinysrgb&w=600"
            alt="Gen Z street style fashion"
            className="object-cover w-full h-full opacity-50"
            loading="eager"
          />
        </div>
        {/* Left photo */}
        <div className="absolute -left-8 top-16 w-[180px] h-[260px] rounded-lg overflow-hidden shadow-xl -rotate-3">
          <img
            src="https://images.pexels.com/photos/7081100/pexels-photo-7081100.jpeg?auto=compress&cs=tinysrgb&w=400"
            alt="Young fashion model in trendy outfit"
            className="object-cover w-full h-full opacity-40"
            loading="eager"
          />
        </div>
        {/* Right photo */}
        <div className="absolute -right-8 top-24 w-[180px] h-[240px] rounded-lg overflow-hidden shadow-xl rotate-2">
          <img
            src="https://images.pexels.com/photos/5325623/pexels-photo-5325623.jpeg?auto=compress&cs=tinysrgb&w=400"
            alt="Gen Z fashion editorial look"
            className="object-cover w-full h-full opacity-40"
            loading="eager"
          />
        </div>
        {/* Far-left Unsplash accent */}
        <div className="absolute -left-24 top-48 w-[120px] h-[170px] rounded-lg overflow-hidden shadow-lg -rotate-6 hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&fit=crop&auto=format&q=80"
            alt="Fashion portrait close-up"
            className="object-cover w-full h-full opacity-30"
            loading="eager"
          />
        </div>
        {/* Far-right Unsplash accent */}
        <div className="absolute -right-24 top-40 w-[120px] h-[160px] rounded-lg overflow-hidden shadow-lg rotate-5 hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&fit=crop&auto=format&q=80"
            alt="Diverse Gen Z fashion"
            className="object-cover w-full h-full opacity-30"
            loading="eager"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-landing-contrast" />
      </motion.div>

      {/* Centered-low text block */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={stagger}
        >
          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.05] mb-6"
            style={{ color: "var(--color-paper)" }}
          >
            Your Closet, Reimagined
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-base tracking-widest mb-10 uppercase"
            style={{ color: "rgba(245, 240, 235, 0.5)" }}
          >
            AI styling · 3D try-on · Independent designers
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 px-10 py-4 bg-landing-accent text-primary-foreground text-sm font-medium rounded-full hover:brightness-110 transition-all duration-300 hover:shadow-xl active:scale-[0.98]"
            >
              Start Styling
              <ArrowRight
                size={16}
                weight="bold"
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>

            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                document
                  .querySelector("#how-it-works")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center justify-center px-10 py-4 border text-sm font-medium rounded-full transition-all duration-300 active:scale-[0.98]"
              style={{
                borderColor: "rgba(245, 240, 235, 0.25)",
                color: "var(--color-paper)",
              }}
            >
              See How It Works
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
