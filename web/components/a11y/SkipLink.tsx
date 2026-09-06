"use client";

/**
 * Skip-to-content link (WCAG 2.4.1). Visually hidden until focused, then reveals a
 * pill at the top-left. Targets the page's `#main-content` landmark (rendered by PageShell).
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-button focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  );
}
