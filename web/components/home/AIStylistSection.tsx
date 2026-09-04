"use client";

import {
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
  useScroll,
  useSpring,
  AnimatePresence,
} from "motion/react";
import Link from "next/link";
import MagneticCTALink from "./MagneticCTALink";
import { CTA_SPRING, EASE_OUT_EXPO, textStagger, textChild } from "./motion-presets";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BatteryFull,
  CellSignalFull,
  PaperPlaneTilt,
  Sparkle,
  WifiHigh,
} from "@phosphor-icons/react";

/* ─── conversation script ──────────────────────── */
interface ChatMsg {
  id: number;
  role: "user" | "ai";
  text: string;
}

const SCRIPT: ChatMsg[] = [
  { id: 1, role: "user", text: "I need an outfit for a gallery opening. Artsy but not trying too hard." },
  {
    id: 2,
    role: "ai",
    text: "Love that vibe! Let me set up your virtual fitting room first. What body type should I use for your avatar?",
  },
  { id: 3, role: "user", text: "Feminine, I'm about 168cm and 58kg." },
  {
    id: 4,
    role: "ai",
    text: "Building your 3D avatar now... Done! Here are 3 looks I styled for you: an oversized linen blazer set, a draped midi dress, and a structured crop jacket combo.",
  },
  { id: 5, role: "user", text: "The linen blazer set looks amazing!" },
  {
    id: 6,
    role: "ai",
    text: "Great pick! I\u2019ve fitted it onto your avatar. You can view the full look, try it on in 3D, or save it to your wardrobe.",
  },
];

const SUGGESTION_CHIPS = ["View Look", "Try On 3D", "Save"] as const;


/* ─── typing dots ──────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-landing-accent/60"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── magnetic chip ────────────────────────────── */
function MagneticChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const reduce = useReducedMotion();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduce || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      x.set(dx * 0.25);
      y.set(dy * 0.25);
    },
    [reduce, x, y],
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const boxShadow = useTransform(
    [x, y],
    ([latestX, latestY]) =>
      `${-(latestX as number) * 0.4}px ${-(latestY as number) * 0.4}px 12px rgba(196,101,74,0.15)`,
  );

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ x, y, boxShadow }}
      whileTap={{ scale: 0.95 }}
      transition={CTA_SPRING}
      className="text-xs font-medium text-white/70 border border-white/15 rounded-full px-3.5 py-1.5 hover:border-landing-accent/40 hover:text-white/90 transition-colors cursor-pointer select-none"
    >
      {label}
    </motion.button>
  );
}

/* ─── message bubble ───────────────────────────── */
const bubbleVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
};

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isAI = msg.role === "ai";
  return (
    <motion.div
      layout
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
        isAI
          ? "self-start bg-white/[0.12] text-white/90 rounded-bl-[4px]"
          : "self-end bg-landing-accent text-white rounded-br-[4px]"
      }`}
    >
      {isAI && (
        <Sparkle
          size={12}
          weight="fill"
          className="inline-block mr-1.5 text-landing-accent/70 -mt-0.5"
        />
      )}
      {msg.text}
    </motion.div>
  );
}

/* ─── main section ─────────────────────────────── */
export default function AIStylistSection() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  /* ─── scroll-driven parallax (MOTION_INTENSITY=8) ── */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  /* phone: slow upward drift as section scrolls through viewport */
  const phoneY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.5, 1], [2, 0, -1]);
  const springPhoneY = useSpring(phoneY, { stiffness: 80, damping: 30 });
  const springPhoneRotate = useSpring(phoneRotate, { stiffness: 80, damping: 30 });

  /* offset images: independent parallax speeds for depth */
  const img1Y = useTransform(scrollYProgress, [0, 1], [120, -40]);
  const img2Y = useTransform(scrollYProgress, [0, 1], [60, -100]);
  const springImg1Y = useSpring(img1Y, { stiffness: 60, damping: 25 });
  const springImg2Y = useSpring(img2Y, { stiffness: 50, damping: 20 });

  /* section-level fade driven by scroll position */
  const sectionOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  /* auto-scroll chat container (not the page) to bottom */
  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  /* drip-feed the script when the section scrolls into view */
  useEffect(() => {
    if (!hasStarted || scriptIndex >= SCRIPT.length || reduce) return;

    const next = SCRIPT[scriptIndex];
    const isAI = next.role === "ai";
    const typingDelay = isAI ? 900 + Math.random() * 400 : 300;
    const appearDelay = isAI ? 1100 + Math.random() * 300 : 500;

    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    if (isAI) {
      t1 = setTimeout(() => setIsTyping(true), typingDelay - 800);
    }

    t2 = setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, next]);
      setScriptIndex((i) => i + 1);
    }, typingDelay + appearDelay);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hasStarted, scriptIndex, reduce]);

  /* reduced-motion: show all messages immediately */
  useEffect(() => {
    if (reduce && hasStarted && messages.length === 0) {
      setMessages(SCRIPT);
      setScriptIndex(SCRIPT.length);
    }
  }, [reduce, hasStarted, messages.length]);

  /* IntersectionObserver to trigger the animation */
  useEffect(() => {
    if (hasStarted) return;
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted]);

  const handleChipClick = useCallback(() => {
    router.push("/login");
  }, [router]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");

    const userMsg: ChatMsg = { id: Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => setIsTyping(true), 400);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          text: "Great taste! Let me pull together some options for you.",
        },
      ]);
    }, 1600);
  }, [inputValue]);

  return (
    <section
      ref={sectionRef}
      id="ai-stylist"
      className="relative py-32 lg:py-48 bg-background overflow-hidden"
    >
      {/* Scroll-driven section opacity (reduced-motion: always visible) */}
      <motion.div
        style={reduce ? undefined : { opacity: sectionOpacity }}
        className="max-w-7xl mx-auto px-6 lg:px-8"
      >
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Text with spring-physics stagger */}
          <motion.div
            initial={reduce ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={textStagger}
            className="lg:pr-8"
          >
            <motion.p
              variants={textChild}
              className="text-[11px] font-medium tracking-[3px] text-landing-accent mb-8 uppercase"
            >
              AI Styling
            </motion.p>
            <motion.h2
              variants={textChild}
              className="font-display text-5xl md:text-6xl lg:text-[64px] font-light tracking-tight leading-[1.05] text-foreground mb-8"
            >
              Meet Your
              <br />
              AI Stylist
            </motion.h2>
            <motion.p
              variants={textChild}
              className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-12 max-w-md"
            >
              Tell it your vibe. Get looks that actually fit your life.
            </motion.p>
            <motion.div variants={textChild}>
              <MagneticCTALink href="/chat">Try the AI Stylist</MagneticCTALink>
            </motion.div>
          </motion.div>

          {/* Right: Phone + parallax images */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 1,
              ease: EASE_OUT_EXPO,
              delay: 0.2,
            }}
            className="relative flex justify-center lg:justify-start"
          >
            {/* Phone with scroll-driven parallax + subtle rotation */}
            <motion.div
              style={
                reduce
                  ? undefined
                  : { y: springPhoneY, rotate: springPhoneRotate }
              }
              className="relative w-full max-w-[320px]"
            >
              <div
                className="w-full rounded-[44px] overflow-hidden"
                style={{
                  background: "linear-gradient(180deg, #1c1917 0%, #171311 100%)",
                  border: "3px solid rgba(60, 52, 46, 0.5)",
                  boxShadow:
                    "0 25px 60px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                {/* Screen highlight */}
                <div
                  className="absolute inset-0 rounded-[44px] pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle at 20% 0%, rgba(255,255,255,0.04), transparent 30%)",
                  }}
                />

                {/* Dynamic Island */}
                <div className="relative z-20 flex justify-center pt-3.5 pb-1">
                  <div className="w-[90px] h-[25px] rounded-full bg-black" />
                </div>

                {/* Status Bar */}
                <div className="relative z-20 flex items-center justify-between px-8 pb-2">
                  <span className="text-[11px] font-semibold text-white/60 tabular-nums">
                    9:41
                  </span>
                  <div className="flex items-center gap-1">
                    <CellSignalFull size={11} weight="fill" className="text-white/60" />
                    <WifiHigh size={12} weight="fill" className="text-white/60" />
                    <BatteryFull size={13} weight="fill" className="text-white/60" />
                  </div>
                </div>

                {/* Chat Header */}
                <div className="relative z-10 flex items-center justify-center gap-2 px-5 py-2 border-b border-white/[0.06]">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-landing-accent"
                    animate={
                      reduce
                        ? {}
                        : { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }
                    }
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <span className="text-xs font-semibold text-white/60 tracking-wide">
                    Clossette AI
                  </span>
                </div>

                {/* Chat body */}
                <div ref={chatBodyRef} className="relative z-10 h-[320px] overflow-y-auto px-3 py-3 flex flex-col gap-2.5 scrollbar-none">
                  {/* Empty state */}
                  <AnimatePresence>
                    {messages.length === 0 && !isTyping && !hasStarted && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex items-center justify-center"
                      >
                        <p className="text-xs text-white/30 text-center">
                          Ask me anything about style
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Messages */}
                  <AnimatePresence mode="popLayout">
                    {messages.map((msg) => (
                      <ChatBubble key={msg.id} msg={msg} />
                    ))}
                  </AnimatePresence>

                  {/* Typing indicator */}
                  <AnimatePresence>
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="self-start bg-white/10 rounded-2xl rounded-bl-sm"
                      >
                        <TypingDots />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Suggestion chips */}
                <AnimatePresence>
                  {scriptIndex >= SCRIPT.length && messages.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ delay: 0.3 }}
                      className="relative z-10 flex gap-2 px-3 pb-3 flex-wrap"
                    >
                      {SUGGESTION_CHIPS.map((chip) => (
                        <MagneticChip
                          key={chip}
                          label={chip}
                          onClick={handleChipClick}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input bar (iMessage-style) */}
                <div className="relative z-10 flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 flex items-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] px-3.5 py-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSend();
                      }}
                      placeholder="Describe your vibe..."
                      className="flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/20 outline-none"
                    />
                  </div>
                  <motion.button
                    onClick={handleSend}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={CTA_SPRING}
                    className="p-2 rounded-full bg-landing-accent text-white transition-colors cursor-pointer"
                    aria-label="Send message"
                  >
                    <PaperPlaneTilt size={14} weight="fill" />
                  </motion.button>
                </div>

                {/* Home Indicator */}
                <div className="flex justify-center pb-3 pt-1">
                  <div className="w-[100px] h-[4px] rounded-full bg-white/20" />
                </div>
              </div>
            </motion.div>

            {/* Offset outfit image - parallax layer 1 (medium speed) */}
            <motion.div
              style={reduce ? undefined : { y: springImg1Y }}
              className="absolute -right-8 top-8 w-48 h-64 rounded-lg overflow-hidden shadow-heavy hidden lg:block"
            >
              <img
                src="https://images.pexels.com/photos/5325586/pexels-photo-5325586.jpeg?auto=compress&cs=tinysrgb&w=400"
                alt="Styled outfit recommendation"
                className="object-cover w-full h-full"
                loading="lazy"
              />
            </motion.div>

            {/* Second offset - parallax layer 2 (faster, deeper depth) */}
            <motion.div
              style={reduce ? undefined : { y: springImg2Y }}
              className="absolute -right-4 bottom-12 w-32 h-44 rounded-lg overflow-hidden shadow-heavy hidden lg:block rotate-3"
            >
              <img
                src="https://images.pexels.com/photos/8945190/pexels-photo-8945190.jpeg?auto=compress&cs=tinysrgb&w=300"
                alt="Gen Z fashion accessories"
                className="object-cover w-full h-full"
                loading="lazy"
              />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
