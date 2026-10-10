import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './session';

// ─────────────────────────────────────────────────────────────────────────────
// Automated accessibility (axe-core) gate for the key routes. Gates on
// serious/critical WCAG violations only; moderate/minor findings are logged as
// tracked TODOs so pre-existing, non-AA-blocking issues don't fail the phase.
//
// PREREQUISITE: this spec needs a LIVE dev server (:3000) + API (:3001) — the
// Playwright config intentionally omits `webServer`. Run `./dev.sh start`
// (or `npm run dev` + the API) before `npm run test:e2e -- a11y.spec.ts`.
// 3D routes (PDP, try-on) wait for the viewer <canvas> to mount before scanning.
// ─────────────────────────────────────────────────────────────────────────────

// Scan the resting presentation, not a random animation frame.
//
// axe samples computed colours at the instant it runs, and entrance animations
// are mid-flight for the first couple of seconds. HeroSection's "Scroll to
// Discover" cue fades opacity 0 -> 1 over 0.9s delay + 0.8s duration; on a slow
// machine the scan landed at ~12% opacity and reported #e4e4e4 on #ffffff —
// 1.27:1 — even though the settled colour passed. It failed in CI and passed
// locally purely on timing. (That cue's settled colour had only 0.19 of
// headroom over AA, so it is a token now; __tests__/a11y/token-contrast.test.ts
// guards the remaining ad-hoc opacities. The timing problem is separate and is
// what this setting is for.)
//
// All 13 framer-motion components under components/home/ gate on
// `prefers-reduced-motion`, so asking for it removes the entrance animations
// outright rather than papering over the timing.
//
// It has to go through `contextOptions`. On Playwright 1.60 `reducedMotion` is
// a BrowserContextOptions property, NOT a top-level test option — and
// `test.use({ reducedMotion: 'reduce' })` is accepted and then silently
// ignored, which is how it shipped as a no-op that `tsc` flagged and a fast CI
// runner hid. Probed directly: top-level form leaves
// matchMedia('(prefers-reduced-motion: reduce)') false, this form makes it true.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const BLOCKING_IMPACTS = ['serious', 'critical'];

// Asserted, not assumed. The whole point of the setting above is that scans are
// deterministic; an option that stops arriving would quietly restore the flaky
// mid-animation sampling instead of failing, which is exactly what happened
// once already.
async function expectReducedMotion(page: Page) {
  const applied = await page.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  expect(
    applied,
    'prefers-reduced-motion did not reach the browser — the test.use() option ' +
      'is being ignored, so axe may sample entrance animations mid-flight'
  ).toBe(true);
}

async function expectNoSeriousA11yViolations(
  page: Page,
  label: string,
  opts?: { include?: string }
) {
  await expectReducedMotion(page);
  const builder = new AxeBuilder({ page });
  if (opts?.include) builder.include(opts.include);
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) =>
    BLOCKING_IMPACTS.includes(v.impact ?? '')
  );
  const advisory = results.violations.filter(
    (v) => !BLOCKING_IMPACTS.includes(v.impact ?? '')
  );
  if (advisory.length > 0) {
    // Tracked TODO — moderate/minor findings are not AA-blocking for this phase.
    console.info(
      `[a11y:${label}] ${advisory.length} advisory finding(s): ` +
        advisory.map((v) => `${v.id} (${v.impact})`).join(', ')
    );
  }
  const detail = blocking
    .map((v) => `${v.id} [${v.impact}] — ${v.help} (${v.nodes.length} node(s))`)
    .join('\n');
  expect(
    blocking,
    `Serious/critical a11y violations on ${label}:\n${detail}`
  ).toEqual([]);
}

// Being signed in is a precondition for the authed-route audits below, not
// their subject — so seed the token instead of spending one of the five
// logins/minute the API allows per IP. The invalid-credentials banner test at
// the bottom of this file still drives the real form, as it must.
async function login(page: Page) {
  await signIn(page, 'shopper');
  await page.goto('/dashboard');
}

test.describe('Accessibility (axe) — public routes', () => {
  test('home /', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectNoSeriousA11yViolations(page, 'home');
  });

  test('catalog /products', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await expectNoSeriousA11yViolations(page, 'products');
  });

  test('product detail /products/[id]', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto('/products');
    await page.locator('a[href^="/products/"]').first().click();
    await expect(page).toHaveURL(/\/products\/\d+/);
    await page.waitForLoadState('networkidle');
    // 3D viewer may stream in — give the canvas up to 15s if it appears; don't fail if absent.
    await page
      .locator('canvas')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {});
    await expectNoSeriousA11yViolations(page, 'product-detail');
  });

  // Destructive error banner must be AA-legible. The banner uses the global
  // `text-destructive` on `bg-destructive/10` pattern (27 files); an invalid
  // login is the deterministic, unauth way to render it. Scoped to the banner
  // so unrelated /login markup can't mask or trip this contrast check.
  test('login error banner /login (invalid credentials)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@iyae.ca');
    await page.getByLabel('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.locator('#login-error').waitFor({ state: 'visible', timeout: 15000 });
    await expectNoSeriousA11yViolations(page, 'login-error-banner', {
      include: '#login-error',
    });
  });
});

test.describe('Accessibility (axe) — authenticated routes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cart /cart', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await expectNoSeriousA11yViolations(page, 'cart');
  });

  test('checkout /checkout', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    await expectNoSeriousA11yViolations(page, 'checkout');
  });

  test('try-on /try-on', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto('/try-on');
    await page.waitForLoadState('networkidle');
    await page
      .locator('canvas')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {});
    await expectNoSeriousA11yViolations(page, 'try-on');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The same scans against the dark palette.
//
// Every block above ran in light mode only, which until 2026-10-10 was the only
// mode that existed at runtime: `@theme` baked the light values into the
// generated utilities, no toggle was mounted, and `enableSystem` was false. The
// dark tokens were therefore never rendered by anything — and had accumulated
// five AA failures nobody could see.
//
// `__tests__/a11y/token-contrast.test.ts` now pins the dark token *values*, and
// `dark-mode-plumbing.test.ts` pins the compiled *shape*. Neither can see a
// component that hardcodes a colour instead of using a token — which is what
// axe on a real dark page catches, on the authenticated routes especially,
// since those are the ones no static scan of globals.css reaches.
// ─────────────────────────────────────────────────────────────────────────────

// next-themes persists under the `theme` key by default; seeding it before any
// script runs avoids a light-mode first paint that axe might sample.
async function useDarkTheme(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch {
      /* storage blocked — the assertion below will catch it */
    }
  });
}

// Asserted rather than assumed, for the same reason as `expectReducedMotion`:
// if the class stops arriving, these tests would quietly re-scan light mode and
// keep passing while covering nothing.
async function expectDarkApplied(page: Page) {
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
}

test.describe('Accessibility (axe) — dark mode', () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
  });

  test('home / (dark)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectDarkApplied(page);
    await expectNoSeriousA11yViolations(page, 'home-dark');
  });

  test('catalog /products (dark)', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await expectDarkApplied(page);
    await expectNoSeriousA11yViolations(page, 'products-dark');
  });

  // The `text-destructive on bg-destructive/10` pattern in 27 files. In dark the
  // tint resolves against the dark page, so it is a different computation from
  // the light-mode case above — and at the old #ef4444 it was 4.33:1.
  test('login error banner /login (dark)', async ({ page }) => {
    await page.goto('/login');
    await expectDarkApplied(page);
    await page.getByLabel('Email').fill('nobody@iyae.ca');
    await page.getByLabel('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.locator('#login-error').waitFor({ state: 'visible', timeout: 15000 });
    await expectNoSeriousA11yViolations(page, 'login-error-banner-dark', {
      include: '#login-error',
    });
  });

  test('cart /cart (dark)', async ({ page }) => {
    await login(page);
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await expectDarkApplied(page);
    await expectNoSeriousA11yViolations(page, 'cart-dark');
  });

  test('checkout /checkout (dark)', async ({ page }) => {
    await login(page);
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    await expectDarkApplied(page);
    await expectNoSeriousA11yViolations(page, 'checkout-dark');
  });

  test('dashboard /dashboard (dark)', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');
    await expectDarkApplied(page);
    await expectNoSeriousA11yViolations(page, 'dashboard-dark');
  });
});

test.describe('Theme toggle', () => {
  // The palette existed for months with no way to reach it. This is the control
  // that makes it reachable, so its presence is worth a test of its own.
  test('switches the document class and survives a navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggle = page.getByRole('button', { name: /switch to (dark|light) mode/i });
    await expect(toggle).toBeVisible();

    const wasDark = await page
      .locator('html')
      .evaluate((el) => el.classList.contains('dark'));
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);

    // next-themes persists the choice; a reload that lost it would mean the
    // toggle only ever worked for the page it was clicked on.
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);
  });
});
