"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

// The resolved theme is only known in the browser, so the icon can only be
// picked after hydration. Reading "am I hydrated" as an external store (server
// snapshot false, client snapshot true) gets the placeholder into the server
// markup and the real button into the first post-hydration render.
const subscribeToNothing = () => () => {};
const getHydrated = () => true;
const getHydratedOnServer = () => false;

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getHydrated,
    getHydratedOnServer,
  );
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  // `resolvedTheme`, not `theme`: with `enableSystem` the stored preference is
  // "system" until the user picks a side, and `theme` reports that literal
  // string — so reading `theme === "dark"` shows a Moon to someone already
  // looking at a dark page, and the first click is a no-op.
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
