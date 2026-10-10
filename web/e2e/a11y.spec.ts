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
// 1.27:1 — even though the settled colour is #737373 at 4.74:1, which passes.
// It failed in CI and passed locally purely on timing.
//
// All 13 framer-motion components under components/home/ gate on
// `prefers-reduced-motion`, so asking for it removes the entrance animations
// outright rather than papering over the timing.
test.use({ reducedMotion: 'reduce' });

const BLOCKING_IMPACTS = ['serious', 'critical'];

async function expectNoSeriousA11yViolations(
  page: Page,
  label: string,
  opts?: { include?: string }
) {
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
