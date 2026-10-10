import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';
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

// Extract a light-mode token. Raw colour values live in the `:root` block that
// precedes the `.dark { … }` override, under the bare token name — `@theme`
// only maps `--color-<name>` onto `var(--<name>)`, so it holds no hex to read.
// (Before 2026-10-10 the hexes were in `@theme inline` itself; they moved so
// that the generated utilities carry a var() the `.dark` block can override.)
function lightToken(css: string, name: string): string {
  const lightBlock = css.split(/\.dark\s*\{/)[0];
  const match = lightBlock.match(
    new RegExp(`(?<![\\w-])--${name}:\\s*(#[0-9a-fA-F]{3,8})`)
  );
  if (!match) throw new Error(`light --${name} not found in globals.css :root`);
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

// ─────────────────────────────────────────────────────────────────────────────
// The same guard for the dark palette, which until 2026-10-10 nothing checked
// because nothing could render it: `@theme` baked the light values into the
// generated utilities, no toggle was mounted, and `enableSystem` was false. So
// the `.dark` block accumulated five real AA failures in the dark with no way
// for anyone to see them:
//
//   text-primary-foreground on bg-primary   4.36   (#ffffff on #cb4d6d)
//   text-destructive-foreground on bg-destructive  3.76   (#ffffff on #ef4444)
//   text-destructive on bg-destructive/10   4.33
//   text-brand on bg-background             4.13
//   text-brand on bg-card                   3.66
//
// All five are fixed; this covers every pairing the design system promises so
// the next dark-token edit cannot reintroduce one. Light mode is checked above
// against hand-picked cases; here the pairings are enumerated, because the dark
// palette has no Figma source and is therefore the one more likely to drift.
// ─────────────────────────────────────────────────────────────────────────────

// Raw value from the `.dark` block, falling back to `:root` for the tokens that
// are deliberately theme-invariant (paper) or have no override.
function darkToken(css: string, name: string): string {
  const darkBlock = css.split(/\.dark\s*\{/)[1] ?? '';
  const match = darkBlock
    .split(/\n\}/)[0]
    .match(new RegExp(`(?<![\\w-])--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  return match ? match[1] : lightToken(css, name);
}

// `[text token, surface token]` — the pairing the design system promises, which
// is what `text-<x>-foreground` / `bg-<x>` means as a contract.
const PROMISED_PAIRINGS: ReadonlyArray<readonly [string, string]> = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'muted'],
  ['card-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['popover-foreground', 'popover'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
  ['info-foreground', 'info'],
  // brand/landing-accent are text colours on the page and on cards, not just
  // surfaces — this is the constraint that forced the dark burgundy lighter.
  ['brand', 'background'],
  ['brand', 'card'],
  ['landing-accent', 'background'],
  ['landing-accent', 'card'],
];

describe('globals.css dark-mode token contrast (WCAG 2.1 AA)', () => {
  const css = readFileSync(GLOBALS_CSS, 'utf8');

  it.each(PROMISED_PAIRINGS.map(([t, s]) => [`text-${t} on bg-${s}`, t, s] as const))(
    '%s clears AA 4.5:1',
    (_label, text, surface) => {
      const ratio = contrastRatio(
        hexToRgb(darkToken(css, text)),
        hexToRgb(darkToken(css, surface))
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  );

  it('destructive error banner (text-destructive on bg-destructive/10) clears AA 4.5:1', () => {
    // The pattern in 27 files. In dark the /10 tint resolves against the dark
    // page, so it needs checking separately from the solid button above.
    const destructive = hexToRgb(darkToken(css, 'destructive'));
    const background = hexToRgb(darkToken(css, 'background'));
    const ratio = contrastRatio(destructive, composite(destructive, 0.1, background));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('regression guard: the five pre-fix dark values would have failed AA', () => {
    // Locks the intent rather than the replacement values. If someone reverts a
    // token to one of these, the enumerated cases above fail — this says why.
    const card = hexToRgb(darkToken(css, 'card'));
    const background = hexToRgb(darkToken(css, 'background'));
    const oldBrand = hexToRgb('#cb4d6d');
    const oldDestructive = hexToRgb('#ef4444');

    expect(contrastRatio(hexToRgb('#ffffff'), oldBrand)).toBeLessThan(WCAG_AA_NORMAL);
    expect(contrastRatio(hexToRgb('#ffffff'), oldDestructive)).toBeLessThan(WCAG_AA_NORMAL);
    expect(contrastRatio(oldBrand, background)).toBeLessThan(WCAG_AA_NORMAL);
    expect(contrastRatio(oldBrand, card)).toBeLessThan(WCAG_AA_NORMAL);
    expect(
      contrastRatio(oldDestructive, composite(oldDestructive, 0.1, background))
    ).toBeLessThan(WCAG_AA_NORMAL);
  });

  it('white text can never sit on the dark brand surface', () => {
    // Why the ten `bg-brand text-white` sites became `text-primary-foreground`:
    // in dark mode the constraints on --brand have no overlap. White-on-brand
    // needs luminance <= 0.176; brand-as-text on bg-card needs >= 0.240. Any
    // value satisfying one fails the other, so a hardcoded white is unfixable
    // by token choice alone. This asserts the squeeze still holds.
    const card = hexToRgb(darkToken(css, 'card'));
    const maxForWhite =
      (1.05 / WCAG_AA_NORMAL) - 0.05;
    const minForCardText =
      WCAG_AA_NORMAL * (relativeLuminance(card) + 0.05) - 0.05;
    expect(minForCardText).toBeGreaterThan(maxForWhite);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The tests above pin the tokens. This block pins the *ad-hoc* text opacities
// that bypass them — `text-<token>/<alpha>`, Tailwind's opacity modifier, which
// produces a colour that exists in no token and that nothing was checking.
//
// Motivating case: the home page's scroll cue used the ink token at 60%, which
// resolves to #737373 — 4.74:1 on white. That clears AA by 0.24, so it was not
// a violation, but it was one small darkening of --color-foreground away from
// being one, and no test would have noticed. It is a token now; this guard
// covers the rest.
//
// Each occurrence is judged against the surface its token is designed to pair
// with (`text-<x>-foreground` ↔ `bg-<x>`, plain `foreground` ↔ `background`),
// since that is the pairing the design system actually promises.
//
// Running this over the codebase turned up 28 occurrences well below AA — every
// single use of --color-muted-foreground at 30-70% opacity, which on bg-muted
// resolves to light greys from #c7c5c3 (1.53:1) to #8c8b8a (3.03:1). By
// contrast all four ink/primary uses pass comfortably: 6.63, 9.53 and 5.29:1.
//
// All 28 have since been read in place and classified. 19 are gone:
//
//   • 15 carried real text — the "Occasion"/"Mood" labels on /chat, chat
//     timestamps, ChatSidebar's date labels and group headings,
//     SavedPiecesPanel's "No items recorded" and "Add a note…", the avatar
//     page's overlay caption and drag hint. WCAG 1.4.3 applies to those with
//     no get-out, so they dropped the modifier and use the token itself,
//     which the block above already proves clears 4.5:1 on bg-muted.
//   • 3 were icon-only controls (two "Remove item" buttons in the cart, the
//     "Delete look" button) where the icon is the sole indicator, so 1.4.11
//     wants 3:1 and /40 gave 1.79:1. Same fix.
//   • 1 went with the dead home sections deleted in the same pass.
//
// The 9 below are the ones where the exemption is real rather than convenient,
// and each entry now says which. They are recorded with exact counts rather
// than quietly skipped, so the guard stays honest about what it is not
// enforcing — and so that a 10th fails this test.
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_ROOTS = ['../../app', '../../components'];
const SOURCE_EXTENSIONS = ['.tsx', '.ts'];

// Arbitrary values (`text-[#abc]/50`) are deliberately not matched: they are
// not token-derived, and this guard is about tokens drifting below AA.
const OPACITY_CLASS = /\btext-((?:[a-z]+-)*foreground)\/(\d{1,3})\b/g;

// Known debt, as `text-<token>/<alpha>` → number of occurrences. Every entry
// below 4.5:1 that is still here is non-text: a decorative glyph, or a
// disabled control, both of which WCAG exempts. Reducing a count is a bug fix;
// raising one needs a deliberate edit to this map AND a reason that survives
// reading the markup.
const KNOWN_BELOW_AA: Record<string, number> = {
  // 1.79:1. All five are no-image placeholder glyphs sitting behind real text:
  // cart/page ImagePlaceholder, designer/products' <Package/> thumbnail
  // fallback, OutfitCard's empty slot tile, ProductListItem and
  // ResaleListingCard. Non-text, and the name/price next to them carries the
  // information.
  'text-muted-foreground/40': 5,
  // 2.11:1. community/page's empty-state <EmptyIcon/> above its own title and
  // description; style-lab's decorative <ArrowRight/> chevron; and
  // SuggestionChips' *disabled* branch, which 1.4.3 exempts outright
  // ("inactive user interface components").
  'text-muted-foreground/50': 3,
  // 2.51:1. ar-visualization's <PlatformIcon/>, between the feature title and
  // a text pill that already names the platform.
  'text-muted-foreground/60': 1,
};

type AdHocOpacity = { file: string; token: string; alpha: number };

/** `muted-foreground` → `muted`, `primary-foreground` → `primary`, … */
function pairedSurfaceToken(textToken: string): string {
  return textToken === 'foreground'
    ? 'background'
    : textToken.replace(/-foreground$/, '');
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  };
  walk(resolve(here, root));
  return out;
}

// Comments are stripped first: this very repo's HeroSection explains in a
// comment why it stopped using one of these classes, and a scan that counted
// prose would report a violation that does not render.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function findAdHocOpacities(): AdHocOpacity[] {
  const found: AdHocOpacity[] = [];
  for (const root of SOURCE_ROOTS) {
    for (const file of sourceFiles(root)) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(OPACITY_CLASS)) {
        found.push({
          file: relative(resolve(here, '../..'), file),
          token: match[1],
          alpha: Number(match[2]) / 100,
        });
      }
    }
  }
  return found;
}

describe('ad-hoc text opacities (text-<token>/<alpha>) against their paired surface', () => {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const occurrences = findAdHocOpacities();

  function ratioFor(occurrence: AdHocOpacity): number {
    const surface = hexToRgb(lightToken(css, pairedSurfaceToken(occurrence.token)));
    const text = hexToRgb(lightToken(css, occurrence.token));
    return contrastRatio(composite(text, occurrence.alpha, surface), surface);
  }

  function className(occurrence: AdHocOpacity): string {
    return `text-${occurrence.token}/${Math.round(occurrence.alpha * 100)}`;
  }

  it('the scan still finds occurrences to guard', () => {
    // A scan that silently matches nothing would pass forever. If this fails
    // because every ad-hoc opacity is gone, delete this whole block.
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it('no ad-hoc opacity falls below AA except the recorded debt', () => {
    const failing: Record<string, number> = {};
    for (const occurrence of occurrences) {
      if (ratioFor(occurrence) < WCAG_AA_NORMAL) {
        const key = className(occurrence);
        failing[key] = (failing[key] ?? 0) + 1;
      }
    }
    // Exact equality in both directions: a new sub-AA class fails, a new
    // occurrence of a known one fails, and fixing one without updating the map
    // also fails — which is how the count stays true.
    expect(failing).toEqual(KNOWN_BELOW_AA);
  });

  it.each(
    occurrences
      .filter((o) => !(className(o) in KNOWN_BELOW_AA))
      .map((o) => [`${o.file} — ${className(o)}`, o] as const)
  )('%s clears AA 4.5:1', (_label, occurrence) => {
    expect(ratioFor(occurrence)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('documents the headroom that motivated replacing the ink/60 scroll cue', () => {
    // The point is the margin, not a pass/fail: 60% ink technically cleared AA,
    // which is exactly why no test caught it. The token that replaced it has
    // more than six times the headroom above the threshold.
    const background = hexToRgb(lightToken(css, 'background'));
    const foreground = hexToRgb(lightToken(css, 'foreground'));
    const mutedForeground = hexToRgb(lightToken(css, 'muted-foreground'));

    const inkAt60 = contrastRatio(composite(foreground, 0.6, background), background);
    const token = contrastRatio(mutedForeground, background);

    expect(inkAt60).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(inkAt60 - WCAG_AA_NORMAL).toBeLessThan(0.3);
    expect(token - WCAG_AA_NORMAL).toBeGreaterThan(1.8);
  });
});
