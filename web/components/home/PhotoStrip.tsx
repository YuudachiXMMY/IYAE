"use client";

import { useReducedMotion } from "motion/react";

interface PhotoStripProps {
  photos: { src: string; alt: string }[];
  direction?: "left" | "right";
  height?: string;
  speed?: number;
}

export default function PhotoStrip({
  photos,
  direction = "left",
  height = "h-36",
  speed = 30,
}: PhotoStripProps) {
  const reduce = useReducedMotion();
  const animName = direction === "left" ? "stripScrollLeft" : "stripScrollRight";

  return (
    <div className={`relative ${height} overflow-hidden bg-landing-contrast`}>
      <div
        className="flex gap-1.5 absolute top-0 left-0"
        style={{
          animation: reduce ? "none" : `${animName} ${speed}s linear infinite`,
          width: "max-content",
        }}
      >
        {[...photos, ...photos].map((photo, i) => (
          <div
            key={`${photo.alt}-${i}`}
            className={`${height} aspect-[3/4] flex-shrink-0 overflow-hidden`}
          >
            <img
              src={photo.src}
              alt={photo.alt}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
