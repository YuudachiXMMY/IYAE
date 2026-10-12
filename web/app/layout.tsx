import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { ThemeProvider } from "@/components/theme-provider";
import { FloatingAIStylist } from "@/components/floating-ai-stylist";
import { SkipLink } from "@/components/a11y/SkipLink";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// No `weight`. Both families are variable fonts (Next's own font-data lists "variable" in
// their weights, with a `wght` axis), and per `next/font` a weight ARRAY is only valid for a
// non-variable Google font. next 16.2.6 tolerated the array; 16.4.0 rejects it — the build
// fails with "next/font/google queries have exactly one entry", because an array of static
// weights asks for several font files where a variable font is one.
//
// Omitting it loads the variable font, which is the default and covers the whole 300–700 range
// the design system uses, in one file instead of four. The weights named in globals.css and in
// the components are unaffected.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
});

// FORME Figma body font: DM Sans (replaces Geist Sans) — 2026-09-05 brand sign-off.
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: "Personalized styling with AI and 3D virtual try-on",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <SkipLink />
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              {children}
              <FloatingAIStylist />
              <Toaster />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
