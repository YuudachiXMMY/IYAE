"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight, ChatCircle, Cube, Sparkle } from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { SOFT_SPRING, EASE_OUT_EXPO } from "./motion-presets";

interface Step {
  Icon: ComponentType<{ size: number; weight: "duotone" }>;
  title: string;
  desc: string;
  photo: string;
  photoAlt: string;
}

const STEPS: Step[] = [
  {
    Icon: ChatCircle,
    title: "Chat your vibe",
    desc: "Tell our AI your style, occasion, and mood. It learns what you love.",
    photo: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&h=500&fit=crop&auto=format&q=80",
    photoAlt: "Styled shopper browsing fashion",
  },
  {
    Icon: Cube,
    title: "Try it on in 3D",
    desc: "See every garment on your personalized avatar before you buy.",
    photo: "https://images.unsplash.com/photo-1721417264655-2ccbf19152c6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTZ8fGdlbiUyMHp8ZW58MHx8MHx8fDA%3D",
    photoAlt: "Gen Z fashion try-on experience",
  },
  {
    Icon: Sparkle,
    title: "Wear with confidence",
    desc: "Buy knowing it fits. Near-zero returns because you already saw it on you.",
    photo: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop&auto=format&q=80",
    photoAlt: "Confident shopper in curated outfit",
  },
];

export default function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section id="how-it-works" className="py-20 lg:py-24 bg-landing-contrast overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        {/* Section heading */}
        <motion.h2
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-tight leading-[1.1] text-center mb-16 lg:mb-20 text-paper"
        >
          Three steps to your
          <br />
          perfect look
        </motion.h2>

        {/* Timeline steps */}
        <div className="relative">
          {/* Vertical accent line (desktop) */}
          <div
            className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-px hidden lg:block"
            style={{ background: "linear-gradient(180deg, transparent 0%, var(--color-landing-accent) 15%, var(--color-landing-accent) 85%, transparent 100%)", opacity: 0.2 }}
          />

          <div className="flex flex-col gap-16 lg:gap-20">
            {STEPS.map((step, i) => {
              const isEven = i % 2 === 0;
              return (
                <motion.div
                  key={step.title}
                  initial={reduce ? false : { opacity: 0, x: isEven ? -40 : 40, y: 20 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ ...SOFT_SPRING, delay: 0.1 }}
                  className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center"
                  style={isEven ? {} : { direction: "rtl" }}
                >
                  {/* Text side */}
                  <div className={`${isEven ? "lg:text-right lg:pr-16" : "lg:text-left lg:pl-16"}`} style={{ direction: "ltr" }}>
                    <motion.div
                      whileHover={reduce ? {} : { scale: 1.1, rotate: 5 }}
                      transition={SOFT_SPRING}
                      className={`w-14 h-14 rounded-2xl bg-landing-accent/[0.12] border border-brand/15 flex items-center justify-center mb-5 text-landing-accent ${
                        isEven ? "lg:ml-auto" : ""
                      }`}
                      style={{
                        boxShadow: "0 4px 20px color-mix(in srgb, var(--color-brand) 8%, transparent)",
                      }}
                    >
                      <step.Icon size={24} weight="duotone" />
                    </motion.div>

                    <h3 className="text-2xl font-semibold mb-3 text-paper">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed max-w-sm text-paper/50">
                      {step.desc}
                    </p>
                  </div>

                  {/* Photo side */}
                  <div style={{ direction: "ltr" }}>
                    <motion.div
                      whileHover={reduce ? {} : { scale: 1.03 }}
                      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                      className="relative w-full max-w-[320px] aspect-[4/5] rounded-2xl overflow-hidden mx-auto lg:mx-0"
                      style={{
                        boxShadow: "0 20px 50px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.2)",
                      }}
                    >
                      <img
                        src={step.photo}
                        alt={step.photoAlt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: "linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 40%)",
                        }}
                      />
                    </motion.div>
                  </div>

                  {/* Timeline dot (desktop) */}
                  <motion.div
                    initial={reduce ? false : { scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ ...SOFT_SPRING, delay: 0.2 }}
                    className="absolute left-1/2 -translate-x-1/2 top-4 w-3 h-3 rounded-full bg-landing-accent hidden lg:block"
                    style={{
                      boxShadow: "0 0 12px color-mix(in srgb, var(--color-brand) 40%, transparent)",
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.2 }}
          className="text-center mt-16 lg:mt-20"
        >
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 px-10 py-4 bg-landing-accent text-primary-foreground text-sm font-medium rounded-full hover:brightness-110 transition-all duration-300 active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight
              size={16}
              weight="bold"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
