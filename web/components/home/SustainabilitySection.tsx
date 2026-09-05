"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "motion/react";

type ScrollProgress = ReturnType<typeof useScroll>["scrollYProgress"];

function ScrollWord({
  word,
  range,
  progress,
}: {
  word: string;
  range: [number, number];
  progress: ScrollProgress;
}) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span
      style={{ opacity }}
      className="inline-block mr-[0.25em] last:mr-0"
    >
      {word}
    </motion.span>
  );
}

export default function SustainabilitySection() {
  const reduce = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { scrollYProgress } = useScroll({
    target: headingRef,
    offset: ["start 0.85", "start 0.35"],
  });

  return (
    <section id="sustainability" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-landing-contrast" />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
        {/* Scroll-reveal heading */}
        <h2
          ref={headingRef}
          className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-paper mb-8 leading-tight"
        >
          {reduce ? (
            <>
              Less Waste.
              <br />
              More Wardrobe.
            </>
          ) : (
            <>
              <ScrollWord
                word="Less"
                range={[0, 0.25]}
                progress={scrollYProgress}
              />
              <ScrollWord
                word="Waste."
                range={[0.25, 0.5]}
                progress={scrollYProgress}
              />
              <br />
              <ScrollWord
                word="More"
                range={[0.5, 0.75]}
                progress={scrollYProgress}
              />
              <ScrollWord
                word="Wardrobe."
                range={[0.75, 1]}
                progress={scrollYProgress}
              />
            </>
          )}
        </h2>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-paper/60 text-lg max-w-2xl mx-auto mb-16"
        >
          By trying before buying with your accurate AR model, we eliminate the
          guesswork that leads to returns and landfill waste.
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 gap-8 max-w-md mx-auto mb-16"
        >
          <div>
            <p className="font-display text-5xl font-bold text-landing-accent">
              -60%
            </p>
            <p className="text-paper/40 text-sm mt-2">Return Rates</p>
          </div>
          <div>
            <p className="font-display text-5xl font-bold text-landing-accent">
              0
            </p>
            <p className="text-paper/40 text-sm mt-2">Fitting Room Stress</p>
          </div>
        </motion.div>

        {/* Cinematic image */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden aspect-[21/9] max-w-4xl mx-auto"
        >
          <img
            src="https://picsum.photos/seed/clossette-sustainability/1200/500"
            alt="Sustainable fashion"
            className="object-cover w-full h-full"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-landing-contrast/70 via-landing-contrast/20 to-transparent" />
          <p className="absolute bottom-6 inset-x-6 font-display text-xl italic text-white/80 leading-[1.1] pb-1">
            Fashion that fits the planet
          </p>
        </motion.div>
      </div>
    </section>
  );
}
