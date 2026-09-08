import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// WCAG 2.1 AA contrast regression guard for the light-mode design tokens that
// have already been hand-tuned for accessibility. This pins the intent so a
// future edit to globals.css cannot silently lighten a token back below AA:
//   • --color-destructive on the bg-destructive/10 error-banner tint (27 files)
//   • --color-muted-foreground on bg-muted
// Source-driven: reads the real token values out of globals.css (light block
// only) so the assertion tracks the file, not a copy. Formula is the standard
// WCAG 2.x relative-luminance definition; no browser needed (CI-always).
// ─────────────────────────────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
const GLOBALS_CSS = resolve(here, '../../app/globals.css');

const WCAG_AA_NORMAL = 4.5;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function channelToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Composite a translucent top color over an opaque bottom (alpha 0..1) — how
// Tailwind's `/10` opacity resolves against the page background.
function composite(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return {
    r: top.r * alpha + bottom.r * (1 - alpha),
    g: top.g * alpha + bottom.g * (1 - alpha),
    b: top.b * alpha + bottom.b * (1 - alpha),
  };
}

// Extract a light-mode token: the FIRST declaration, which lives in the
// `@theme inline` block that precedes the `.dark { … }` override.
function lightToken(css: string, name: string): string {
  const lightBlock = css.split(/\.dark\s*\{/)[0];
  const match = lightBlock.match(
    new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`)
  );
  if (!match) throw new Error(`light --color-${name} not found in globals.css`);
  return match[1];
}

describe('globals.css light-mode token contrast (WCAG 2.1 AA)', () => {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const background = hexToRgb(lightToken(css, 'background'));
  const destructive = hexToRgb(lightToken(css, 'destructive'));
  const muted = hexToRgb(lightToken(css, 'muted'));
  const mutedForeground = hexToRgb(lightToken(css, 'muted-foreground'));

  it('destructive error banner (text-destructive on bg-destructive/10) clears AA 4.5:1', () => {
    const bannerBg = composite(destructive, 0.1, background);
    const ratio = contrastRatio(destructive, bannerBg);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('muted text (text-muted-foreground on bg-muted) clears AA 4.5:1', () => {
    const ratio = contrastRatio(mutedForeground, muted);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('regression guard: the pre-fix destructive red (#dc2626) would have failed AA', () => {
    // Documents WHY the token was darkened — locks the intent, not just the value.
    const oldBannerBg = composite(hexToRgb('#dc2626'), 0.1, background);
    const oldRatio = contrastRatio(hexToRgb('#dc2626'), oldBannerBg);
    expect(oldRatio).toBeLessThan(WCAG_AA_NORMAL);
  });
});
