import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll } from 'vitest';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// ─────────────────────────────────────────────────────────────────────────────
// Dark mode was non-functional from the day the tokens were written until
// 2026-10-10, and no test could see it because the defect lived in the compiled
// output rather than the source. Tailwind resolves a theme value into the
// utility it generates, so
//
//   @theme inline { --color-background: #ffffff }   ->   .bg-background { background-color: #ffffff }
//
// leaves a literal that `.dark { --color-background: … }` cannot reach. The
// source looked completely correct: a light block, a `.dark` block overriding
// every token, and components dutifully using `bg-background` everywhere.
//
// Dropping the `inline` keyword does NOT change this (measured on 4.3.0 —
// both forms inline a literal value). The fix is the indirection shadcn/ui
// ships for v4: raw values in `:root`/`.dark`, and `@theme` mapping the token
// onto `var(--<name>)` so the utility carries a reference.
//
// This guard compiles the real globals.css and asserts the shape of the output,
// which is the only place the bug was ever visible.
// ─────────────────────────────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(here, '../..');
const GLOBALS_CSS = join(WEB_ROOT, 'app/globals.css');

// Every colour token with a `.dark` override. A utility built from one of these
// must carry a var() or the override is dead on arrival.
const THEMED_UTILITIES = [
  'bg-background',
  'text-foreground',
  'bg-card',
  'text-card-foreground',
  'bg-muted',
  'text-muted-foreground',
  'border-border',
  'border-input',
  'ring-ring',
  'bg-primary',
  'text-primary-foreground',
  'bg-secondary',
  'text-secondary-foreground',
  'bg-popover',
  'text-popover-foreground',
  'bg-accent',
  'text-accent-foreground',
  'bg-destructive',
  'text-destructive-foreground',
  'bg-success',
  'text-success-foreground',
  'bg-warning',
  'text-warning-foreground',
  'bg-info',
  'text-info-foreground',
  'bg-brand',
  'bg-brand-hover',
  'bg-landing-surface',
  'bg-landing-soft',
  'text-landing-contrast',
  'bg-landing-tone',
  'bg-landing-accent',
  'bg-landing-highlight',
] as const;

// Tokens consumed as a raw `var(--x)` in an inline style rather than through a
// utility. They need no indirection, but they DO need to reach `:root`.
const RAW_VAR_TOKENS = [
  '--gradient-page-start',
  '--gradient-page-mid',
  '--gradient-page-end',
  '--gradient-profile-banner-start',
  '--gradient-profile-banner-end',
] as const;

let compiled = '';

beforeAll(async () => {
  // Tailwind only emits utilities it finds in a source file, so point it at a
  // scratch file containing exactly the classes under test.
  const scratch = mkdtempSync(join(tmpdir(), 'iyae-dark-tokens-'));
  const candidates = join(scratch, 'candidates.html');
  writeFileSync(candidates, `<div class="${THEMED_UTILITIES.join(' ')} shadow-heavy"></div>`);

  const source = readFileSync(GLOBALS_CSS, 'utf8').replace(
    '@import "tailwindcss";',
    `@import "tailwindcss";\n@source "${candidates}";`
  );

  const result = await postcss([tailwind({ base: WEB_ROOT })]).process(source, {
    from: GLOBALS_CSS,
  });
  compiled = result.css;
}, 60_000);

function rule(utility: string): string {
  const escaped = utility.replace(/\//g, '\\\\/');
  const match = compiled.match(new RegExp(`\\.${escaped}\\s*\\{[^}]*\\}`));
  return match ? match[0] : '';
}

describe('dark-mode token plumbing (compiled CSS)', () => {
  it.each(THEMED_UTILITIES)(
    '.%s carries a var() the .dark block can override',
    (utility) => {
      const body = rule(utility);
      expect(body, `.${utility} was not emitted at all`).not.toBe('');
      expect(
        body,
        `.${utility} resolved to a literal, so .dark cannot reach it — ` +
          `move the raw value into :root and map --color-* onto var() in @theme`
      ).toMatch(/var\(--/);
    }
  );

  it('every themed utility is actually emitted (a typo would silently pass above)', () => {
    const missing = THEMED_UTILITIES.filter((u) => rule(u) === '');
    expect(missing).toEqual([]);
  });

  it('shadow-heavy exists — seven files use hover:shadow-heavy', () => {
    // It did not until 2026-10-10: globals.css defined `--shadow-heavy-color`
    // but no `--shadow-heavy`, so Tailwind emitted no such utility and the
    // hover elevation did nothing in either theme. The colour half is reached
    // through a var so the `.dark` override applies.
    const body = rule('shadow-heavy');
    expect(body).not.toBe('');
    expect(body).toMatch(/var\(--shadow-heavy-color\)/);
  });

  it('the .dark block overrides raw token names, not --color-* theme names', () => {
    // Overriding `--color-background` would be a no-op now: the utility reads
    // `--background`. This catches a half-done edit that looks right.
    const darkBlock = compiled.match(/\.dark\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(darkBlock).not.toBe('');
    const noOps = [...darkBlock.matchAll(/--color-[a-z-]+(?=:)/g)].map((m) => m[0]);
    expect(noOps).toEqual([]);
  });

  it('raw var() tokens still reach :root so inline styles resolve', () => {
    for (const token of RAW_VAR_TOKENS) {
      expect(compiled, `${token} never reaches :root`).toMatch(
        new RegExp(`:root[^{]*\\{[\\s\\S]*?${token}:`)
      );
    }
  });

  it('the 41 raw var(--color-*) call sites still resolve', () => {
    // Components reference a handful of theme names directly in inline styles
    // (`var(--color-card)`, `var(--color-brand)`, …). Those must keep resolving
    // — and now, because they point at the indirection, they are dark-correct
    // too, which they were not before.
    for (const token of ['--color-card', '--color-muted', '--color-brand', '--color-foreground', '--color-landing-accent']) {
      expect(compiled, `${token} never reaches :root`).toMatch(
        new RegExp(`:root[^{]*\\{[\\s\\S]*?${token}:\\s*var\\(--`)
      );
    }
  });
});
