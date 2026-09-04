"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

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

const TRUST_ITEMS = [
  { icon: "\u{1F512}", text: "Secure" },
  { icon: "\u21A9", text: "Free Returns" },
  { icon: "\u2726", text: "AI Powered" },
];

export default function CTASection() {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative py-16 lg:py-20 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #a5543e 0%, #6e3828 35%, #2a2220 70%, #1A1A1A 100%)",
      }}
    >
      {/* Background fashion photo mosaic */}
      <div className="absolute inset-0 flex gap-1 opacity-[0.08]">
        <div className="flex-1 overflow-hidden">
          <img src="https://images.pexels.com/photos/5325771/pexels-photo-5325771.jpeg?auto=compress&cs=tinysrgb&w=600" alt="" className="w-full h-full object-cover" loading="lazy" aria-hidden="true" />
        </div>
        <div className="flex-1 overflow-hidden hidden md:block">
          <img src="https://images.pexels.com/photos/5899019/pexels-photo-5899019.jpeg?auto=compress&cs=tinysrgb&w=600" alt="" className="w-full h-full object-cover" loading="lazy" aria-hidden="true" />
        </div>
        <div className="flex-1 overflow-hidden hidden lg:block">
          <img src="https://images.pexels.com/photos/8590256/pexels-photo-8590256.jpeg?auto=compress&cs=tinysrgb&w=600" alt="" className="w-full h-full object-cover" loading="lazy" aria-hidden="true" />
        </div>
      </div>
      <motion.div
        initial={reduce ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        className="relative z-10 max-w-3xl mx-auto px-6 lg:px-8 text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="font-display text-4xl md:text-5xl lg:text-[56px] font-light tracking-tight leading-[1.15] mb-6"
          style={{ color: "#F5F0EB" }}
        >
          Ready to Find
          <br />
          Your Look?
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="text-base mb-10"
          style={{ color: "rgba(245, 240, 235, 0.5)" }}
        >
          Free to start. No credit card needed.
        </motion.p>

        <motion.div variants={fadeUp}>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-12 py-5 bg-background text-foreground text-lg font-medium rounded-full hover:shadow-xl transition-all duration-300 active:scale-[0.98]"
          >
            Start Styling
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="flex justify-center gap-10 mt-12"
        >
          {TRUST_ITEMS.map((item) => (
            <span
              key={item.text}
              className="flex items-center gap-2 text-xs"
              style={{ color: "rgba(245, 240, 235, 0.35)" }}
            >
              <span>{item.icon}</span>
              {item.text}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
