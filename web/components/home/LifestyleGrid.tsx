"use client";

import { motion, useReducedMotion } from "motion/react";

const PHOTOS = [
  { src: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&fit=crop&auto=format&q=80", alt: "Gen Z street style walk", span: "col-span-2 row-span-2" },
  { src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&fit=crop&auto=format&q=80", alt: "Fashion model editorial pose", span: "col-span-1 row-span-1" },
  { src: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&fit=crop&auto=format&q=80", alt: "Young woman in sunlight", span: "col-span-1 row-span-2" },
  { src: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&fit=crop&auto=format&q=80", alt: "Fashion editorial lookbook", span: "col-span-1 row-span-1" },
  { src: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&fit=crop&auto=format&q=80", alt: "Woman with designer handbag", span: "col-span-1 row-span-1" },
  { src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&fit=crop&auto=format&q=80", alt: "Friends shopping together", span: "col-span-2 row-span-1" },
  { src: "https://images.unsplash.com/photo-1721417264655-2ccbf19152c6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTZ8fGdlbiUyMHp8ZW58MHx8MHx8fDA%3D", alt: "Urban Gen Z fashion", span: "col-span-1 row-span-1" }
];

export default function LifestyleGrid() {
  const reduce = useReducedMotion();

  return (
    <section className="py-6 lg:py-8 bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[140px] md:auto-rows-[180px] gap-1.5">
          {PHOTOS.map((photo, i) => (
            <motion.div
              key={photo.alt}
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={`${photo.span} overflow-hidden rounded-lg`}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
