"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

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

const PRODUCTS = [
  { name: "Hand-knit Sweater", src: "https://images.pexels.com/photos/5325711/pexels-photo-5325711.jpeg?auto=compress&cs=tinysrgb&w=520" },
  { name: "Architectural Earrings", src: "https://images.pexels.com/photos/7081096/pexels-photo-7081096.jpeg?auto=compress&cs=tinysrgb&w=520" },
  { name: "Tailored Blazer", src: "https://images.pexels.com/photos/9399696/pexels-photo-9399696.jpeg?auto=compress&cs=tinysrgb&w=520" },
  { name: "Printed Silk Scarf", src: "https://images.pexels.com/photos/6988653/pexels-photo-6988653.jpeg?auto=compress&cs=tinysrgb&w=520" },
  { name: "Leather Bag", src: "https://images.pexels.com/photos/5325640/pexels-photo-5325640.jpeg?auto=compress&cs=tinysrgb&w=520" },
  { name: "Statement Boots", src: "https://images.pexels.com/photos/9771806/pexels-photo-9771806.jpeg?auto=compress&cs=tinysrgb&w=520" },
];

export default function DesignersSection() {
  const reduce = useReducedMotion();

  return (
    <section id="designers" className="py-10 lg:py-14 bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-[2fr_1fr] gap-8 lg:gap-14 items-center">
          {/* Left: Bento product grid */}
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-3 gap-1.5"
          >
            {PRODUCTS.map((product) => (
              <div
                key={product.name}
                className="aspect-square rounded-lg overflow-hidden bg-landing-soft"
              >
                <img
                  src={product.src}
                  alt={product.name}
                  className="object-cover w-full h-full hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
            ))}
          </motion.div>

          {/* Right: Text */}
          <motion.div
            initial={reduce ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-medium tracking-[3px] text-landing-accent mb-6 uppercase"
            >
              Marketplace
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-display text-4xl md:text-5xl font-light tracking-tight leading-[1.1] text-foreground mb-6"
            >
              Discover
              <br />
              Independent
              <br />
              Designers
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base text-muted-foreground leading-relaxed mb-8"
            >
              500+ emerging labels.
              <br />
              Zero fast fashion.
              <br />
              Each piece tells a story.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                href="/products"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-landing-accent text-white text-sm font-medium rounded-full hover:brightness-110 transition-all duration-300 active:scale-[0.98]"
              >
                Explore Designers
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
