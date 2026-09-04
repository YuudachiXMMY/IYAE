"use client";

import { useRef, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { CTA_SPRING } from "./motion-presets";

const MotionLink = motion(Link);

interface MagneticCTALinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function MagneticCTALink({
  href,
  children,
  className,
}: MagneticCTALinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 15 });
  const springY = useSpring(y, { stiffness: 200, damping: 15 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduce || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      x.set((e.clientX - (rect.left + rect.width / 2)) * 0.3);
      y.set((e.clientY - (rect.top + rect.height / 2)) * 0.3);
    },
    [reduce, x, y],
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <MotionLink
      ref={ref}
      href={href}
      onMouseMove={reduce ? undefined : handleMouseMove}
      onMouseLeave={reduce ? undefined : handleMouseLeave}
      style={reduce ? undefined : { x: springX, y: springY }}
      whileHover={reduce ? undefined : { scale: 1.04 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={CTA_SPRING}
      className={
        className ??
        "inline-flex items-center gap-2.5 text-landing-accent font-medium underline underline-offset-4 hover:brightness-110 transition-all text-lg"
      }
    >
      {children}
      <ArrowRight size={18} weight="bold" />
    </MotionLink>
  );
}
