import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        destructive: "var(--color-destructive)",
        brand: {
          DEFAULT: "#9333ea", // purple-600
          hover: "#7e22ce",   // purple-700
        },
        landing: {
          surface: "var(--color-landing-surface)",
          soft: "var(--color-landing-soft)",
          contrast: "var(--color-landing-contrast)",
          tone: "var(--color-landing-tone)",
          accent: "var(--color-landing-accent)",
          highlight: "var(--color-landing-highlight)",
        },
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "serif"],
        body: ["var(--font-geist-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "2rem",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0,0,0,0.04)",
        heavy: "0 24px 70px var(--shadow-heavy-color)",
      },
      keyframes: {
        editorialFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        editorialDrift: {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(4px)" },
        },
        landingFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        landingFadeUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "editorial-float": "editorialFloat 12s ease-in-out infinite",
        "editorial-drift": "editorialDrift 16s ease-in-out infinite",
        "landing-float": "landingFloat 6s ease-in-out infinite",
        "landing-fade-up": "landingFadeUp 0.8s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
