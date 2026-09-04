"use client";

import { motion, useReducedMotion } from "motion/react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const PRESS_LOGOS = ["VOGUE", "ELLE", "HYPEBEAST", "HIGHSNOBIETY", "WWD"];

export default function TrustBar() {
  const reduce = useReducedMotion();

  return (
    <section className="py-8 bg-background">
      <motion.div
        initial={reduce ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08 } },
        }}
        className="max-w-5xl mx-auto px-6 lg:px-8 text-center"
      >
        <motion.p
          variants={fadeUp}
          className="text-[11px] font-medium tracking-[3px] text-muted-foreground mb-8 uppercase"
        >
          Featured In
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="flex flex-wrap justify-center items-center gap-x-16 gap-y-4 mb-8"
        >
          {PRESS_LOGOS.map((name) => (
            <span
              key={name}
              className="text-base font-medium tracking-[3px] text-muted-foreground/50"
            >
              {name}
            </span>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="flex justify-center mb-6">
          <div className="w-48 h-px bg-border" />
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="text-sm font-light text-muted-foreground"
        >
          Trusted by 500+ independent designers worldwide
        </motion.p>
      </motion.div>
    </section>
  );
}
