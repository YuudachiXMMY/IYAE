/* ─── shared motion presets for landing page sections ─── */

/** Snappy spring for buttons, chips, and small interactive elements */
export const CTA_SPRING = { type: "spring" as const, stiffness: 300, damping: 24 };

/** Softer spring for cards, timeline steps, and large-area transitions */
export const SOFT_SPRING = { type: "spring" as const, stiffness: 120, damping: 18 };

/** Exponential ease-out curve for duration-based animations */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as readonly [number, number, number, number];

/** Stagger container — staggers children with a short initial delay */
export const textStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

/** Spring-physics child variant (opacity + y translate, no blur) */
export const textChild = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 18,
      mass: 0.8,
    },
  },
};

/** Custom-index fade-up variant with per-item delay (opacity + y, no blur) */
export const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 18,
      mass: 0.8,
      delay: i * 0.12,
    },
  }),
};
