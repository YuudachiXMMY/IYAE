"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    // `enableSystem` + `defaultTheme="system"`: the dark palette was unreachable
    // before 2026-10-10 (no toggle was mounted and system was off), so there is
    // no established default to preserve — following the OS is the expectation
    // for a theme that works. `attribute="class"` is what puts `.dark` on <html>,
    // which is what the token overrides in globals.css key off.
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
