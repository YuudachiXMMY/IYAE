"use client";

import { XLogo, InstagramLogo } from "@phosphor-icons/react";

export function LandingFooter() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-foreground">
              CLOSSETTE
            </span>
            <span className="text-muted-foreground text-sm">&copy; 2026</span>
          </div>

          <div className="flex gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>

          <div className="flex gap-3">
            <a
              href="#"
              aria-label="X (Twitter)"
              className="w-10 h-10 rounded-full bg-landing-surface flex items-center justify-center hover:bg-landing-tone transition-colors text-foreground"
            >
              <XLogo size={20} weight="bold" />
            </a>
            <a
              href="https://instagram.com/clossette.official/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="w-10 h-10 rounded-full bg-landing-surface flex items-center justify-center hover:bg-landing-tone transition-colors text-foreground"
            >
              <InstagramLogo size={20} weight="bold" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
