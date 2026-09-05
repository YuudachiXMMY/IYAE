"use client";

import { motion, useReducedMotion } from "motion/react";
import { BRAND } from "@/lib/brand";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export default function SocialProofSection() {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative py-16 lg:py-20 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, var(--color-brand) 0%, color-mix(in srgb, var(--color-brand) 60%, var(--color-landing-contrast)) 40%, color-mix(in srgb, var(--color-brand) 25%, var(--color-landing-contrast)) 100%)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-landing-contrast) 10%, transparent) 40%, color-mix(in srgb, var(--color-landing-contrast) 65%, transparent) 100%)",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={reduce ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          {/* Giant quotation mark — second-read moment */}
          <motion.div
            variants={fadeUp}
            className="text-[240px] md:text-[320px] leading-none font-light select-none pointer-events-none absolute top-4 left-4 lg:left-8 text-paper/[0.06]"
            aria-hidden="true"
          >
            &ldquo;
          </motion.div>

          <div className="pt-20 md:pt-24">
            <motion.blockquote
              variants={fadeUp}
              className="font-display text-2xl md:text-3xl lg:text-[28px] font-light leading-relaxed mb-6"
              style={{ color: "var(--color-paper)" }}
            >
              I used to spend 45 minutes picking an outfit.
              <br className="hidden md:block" />
              Now I just ask {BRAND.name}.
            </motion.blockquote>

            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-landing-accent tracking-wide"
            >
              — Maya, 24 · Toronto
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex items-center gap-6 mt-12"
            >
              <div className="flex -space-x-3">
                {[
                  { src: "https://images.pexels.com/photos/9653877/pexels-photo-9653877.jpeg?auto=compress&cs=tinysrgb&w=80", alt: "Styled shopper" },
                  { src: "https://images.pexels.com/photos/5325774/pexels-photo-5325774.jpeg?auto=compress&cs=tinysrgb&w=80", alt: "Fashion enthusiast" },
                  { src: "https://images.pexels.com/photos/7312350/pexels-photo-7312350.jpeg?auto=compress&cs=tinysrgb&w=80", alt: "Gen Z shopper" },
                  { src: "https://images.pexels.com/photos/5325913/pexels-photo-5325913.jpeg?auto=compress&cs=tinysrgb&w=80", alt: "Community member" },
                ].map((person, i) => (
                  <img
                    key={i}
                    src={person.src}
                    alt={person.alt}
                    className="w-9 h-9 rounded-full border-2 border-white/10 object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
              <p className="text-sm underline underline-offset-4" style={{ color: "rgba(245, 240, 235, 0.55)" }}>
                Join 10,000+ styled shoppers
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
