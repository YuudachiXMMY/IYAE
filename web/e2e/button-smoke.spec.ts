import { test, expect, type Page } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

/**
 * Button smoke audit.
 *
 * For every reachable route (per role) this spec enumerates each visible
 * button / `role="button"` / submit input, then clicks them one at a time —
 * re-navigating to the route before each click so state from the previous
 * click can't mask the next one.
 *
 * A button is reported BROKEN when the click throws, raises an uncaught page
 * error, produces a 5xx, or drops the app into the `app/error.tsx` boundary.
 * Softer signals (console errors, no observable effect) are reported as
 * warnings so a noisy dev build can't fail the suite on its own.
 */

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'clossette_token';

const ACCOUNTS = {
  shopper: SEED_USERS.shopper.email,
  designer: SEED_USERS.designer.email,
} as const;

type Role = 'guest' | 'shopper' | 'designer';

/** A product owned by the seeded designer (`luna@`), used for PDP + edit routes. */
const SEED_PRODUCT_ID = Number(process.env.PLAYWRIGHT_PRODUCT_ID ?? 1);

const ROUTES: ReadonlyArray<{ path: string; roles: readonly Role[] }> = [
  // Public surfaces
  { path: '/', roles: ['guest', 'shopper', 'designer'] },
  { path: '/products', roles: ['guest', 'shopper'] },
  { path: `/products/${SEED_PRODUCT_ID}`, roles: ['guest', 'shopper'] },
  { path: '/community', roles: ['guest', 'shopper', 'designer'] },
  { path: '/login', roles: ['guest'] },
  { path: '/register', roles: ['guest'] },
  { path: '/forgot-password', roles: ['guest'] },
  { path: '/resale', roles: ['guest', 'shopper'] },
  { path: '/status', roles: ['guest'] },

  // Shopper surfaces
  { path: '/dashboard', roles: ['shopper', 'designer'] },
  { path: '/cart', roles: ['shopper'] },
  { path: '/checkout', roles: ['shopper'] },
  { path: '/chat', roles: ['shopper'] },
  { path: '/looks', roles: ['shopper'] },
  { path: '/orders', roles: ['shopper'] },
  { path: '/outfits', roles: ['shopper'] },
  { path: '/outfits/new', roles: ['shopper'] },
  { path: '/try-on', roles: ['shopper'] },
  { path: '/style-lab', roles: ['shopper'] },
  { path: '/design', roles: ['shopper'] },
  { path: '/ar-visualization', roles: ['shopper'] },
  { path: '/profile/avatar', roles: ['shopper'] },
  { path: '/profile/body', roles: ['shopper'] },
  { path: '/profile/preferences', roles: ['shopper'] },
  { path: '/resale/sell', roles: ['shopper'] },
  { path: '/resale/my-listings', roles: ['shopper'] },

  // Designer surfaces
  { path: '/designer/studio', roles: ['designer'] },
  { path: '/designer/products', roles: ['designer'] },
  { path: '/designer/products/new', roles: ['designer'] },
  { path: `/designer/products/${SEED_PRODUCT_ID}/edit`, roles: ['designer'] },
  { path: '/designer/promotions', roles: ['designer'] },
];

/**
 * Buttons we enumerate but deliberately do not click: they mutate or destroy
 * seed data, end the session, or hand off to a third party (Stripe).
 */
const SKIP_LABEL = /delete|archive|unpublish|deactivate|sign out|log ?out|proceed to (payment|checkout)|place order|pay now|confirm order|reset (all )?data/i;

/**
 * The Next.js dev overlay injects its own controls into the page. They are not
 * part of the product, so they are dropped from the audit entirely — otherwise
 * running against `next dev` adds one phantom "dead button" per route.
 */
const DEV_OVERLAY_LABEL = /next\.js dev tools|issues badge|^[\d\s]*issues?$/i;

/** Dev-build noise that says nothing about whether a button works. */
const IGNORED_CONSOLE: readonly RegExp[] = [
  /\[Fast Refresh\]/,
  /Download the React DevTools/,
  /favicon/i,
  /Failed to load resource/i,
  /ERR_(BLOCKED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/,
];

/**
 * Generous on purpose: entrance animations keep elements moving, and a dev
 * build under parallel load is slow — a tight timeout reports contention as a
 * broken button.
 */
const CLICK_TIMEOUT = Number(process.env.PLAYWRIGHT_CLICK_TIMEOUT ?? 15_000);
const SETTLE_MS = 800;
const MAX_BUTTONS_PER_ROUTE = 40;

const BUTTON_SELECTOR =
  'button:visible, [role="button"]:visible, input[type="submit"]:visible';

type Severity = 'broken' | 'warn' | 'ok' | 'skipped';

interface ButtonResult {
  label: string;
  index: number;
  severity: Severity;
  notes: string[];
}

interface Problem {
  kind: 'pageerror' | 'console' | 'http' | 'dialog';
  detail: string;
}

/**
 * One login per role per worker process. The API rate-limits auth per IP, so
 * logging in once per test trips a 429 well before the matrix finishes.
 */
const tokenCache = new Map<string, Promise<string>>();

async function login(role: Exclude<Role, 'guest'>): Promise<string> {
  const email = ACCOUNTS[role];
  let lastStatus = 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SEED_PASSWORD }),
    });
    if (res.ok) {
      const body = (await res.json()) as { token?: string };
      if (!body.token) throw new Error(`Login for ${email} returned no token`);
      return body.token;
    }
    lastStatus = res.status;
    if (res.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
  }

  throw new Error(
    `Seed login failed for ${email} (${lastStatus}). Is the API seeded? ` +
      `Override the domain with PLAYWRIGHT_SEED_DOMAIN.`,
  );
}

function tokenFor(role: Exclude<Role, 'guest'>): Promise<string> {
  const cached = tokenCache.get(role);
  if (cached) return cached;
  const pending = login(role);
  tokenCache.set(role, pending);
  return pending;
}

/** Collects every signal that would mark a click as broken or suspicious. */
function watchPage(page: Page): Problem[] {
  const problems: Problem[] = [];

  page.on('pageerror', (err) =>
    problems.push({ kind: 'pageerror', detail: err.message.split('\n')[0] }),
  );
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    problems.push({ kind: 'console', detail: text.slice(0, 200) });
  });
  page.on('response', (res) => {
    if (res.status() >= 500) {
      problems.push({ kind: 'http', detail: `${res.status()} ${new URL(res.url()).pathname}` });
    }
  });
  // Native dialogs block the page until handled — record and dismiss.
  page.on('dialog', (dialog) => {
    problems.push({ kind: 'dialog', detail: `${dialog.type()}: ${dialog.message().slice(0, 120)}` });
    void dialog.dismiss().catch(() => {});
  });
  // Same for file pickers.
  page.on('filechooser', (chooser) => {
    void chooser.setFiles([]).catch(() => {});
  });

  return problems;
}

async function settle(page: Page, route: string): Promise<void> {
  // Park the pointer in a dead corner first. The virtual mouse keeps its
  // coordinates across navigations, so a hover-triggered menu under the old
  // cursor position re-opens on the next load and (in Radix's modal mode)
  // makes the whole page inert — that would taint every route's audit.
  await page.mouse.move(0, 0).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {
    /* long-polling pages (generation status) never go idle — fine */
  });
  await page.waitForTimeout(SETTLE_MS);
}

async function labelsFor(page: Page): Promise<string[]> {
  return page.locator(BUTTON_SELECTOR).evaluateAll((nodes) =>
    nodes.slice(0, 40).map((node) => {
      const el = node as HTMLElement;
      // Order matters, and every candidate can be an empty string — `||`, not
      // `??` (a <button>'s own `.value` is '' and would swallow innerText).
      const candidates = [
        el.innerText,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.tagName === 'INPUT' ? (el as HTMLInputElement).value : '',
        el.getAttribute('data-testid'),
      ];
      const label = candidates
        .map((c) => (c ?? '').replace(/\s+/g, ' ').trim())
        .find((c) => c.length > 0);
      return label ?? `<${el.tagName.toLowerCase()} unlabelled>`;
    }),
  );
}

async function inErrorBoundary(page: Page): Promise<boolean> {
  return page
    .getByRole('heading', { name: 'Something went wrong' })
    .isVisible({ timeout: 500 })
    .catch(() => false);
}

/** Cheap fingerprint used to tell "this button did nothing" from "it did something". */
async function fingerprint(page: Page): Promise<string> {
  const hash = await page
    .evaluate(() => {
      // djb2 over the rendered markup — sensitive to attribute-only toggles
      // (an icon's fill, aria-pressed) that a length comparison would miss.
      const html = document.body.innerHTML;
      let h = 5381;
      for (let i = 0; i < html.length; i += 1) h = ((h << 5) + h + html.charCodeAt(i)) | 0;
      return h;
    })
    .catch(() => 0);
  return `${new URL(page.url()).pathname}#${hash}`;
}

async function probe(
  page: Page,
  route: string,
  index: number,
  label: string,
  problems: Problem[],
): Promise<ButtonResult> {
  const notes: string[] = [];
  problems.length = 0;

  await settle(page, route);

  const target = page.locator(BUTTON_SELECTOR).nth(index);
  if ((await target.count()) === 0) {
    return { label, index, severity: 'warn', notes: ['vanished on reload (conditional render)'] };
  }
  if (await target.isDisabled().catch(() => false)) {
    return { label, index, severity: 'ok', notes: ['disabled by design'] };
  }

  const alreadyActive = await target
    .evaluate(
      (el) =>
        el.getAttribute('aria-pressed') === 'true' ||
        el.getAttribute('aria-selected') === 'true' ||
        // `aria-current` is how some nav-flavoured chips mark themselves.
        !['false', null].includes(el.getAttribute('aria-current')) ||
        el.getAttribute('data-state') === 'active' ||
        el.getAttribute('data-active') === 'true',
    )
    .catch(() => false);

  // A submit inside a form with empty required fields is *correctly* inert:
  // the browser blocks it and shows a native validation bubble, which leaves
  // no trace in the DOM. `checkValidity` is the side-effect-free probe.
  const blockedByValidation = await target
    .evaluate((el) => {
      const form = (el as HTMLElement).closest('form');
      return form ? !form.checkValidity() : false;
    })
    .catch(() => false);

  const before = await fingerprint(page);

  // Count only requests a handler would have made. Images, fonts and
  // `_next/static` chunks fire merely because the click scrolled a card into
  // view — counting those would mask a genuinely dead button as "it did
  // something".
  let requests = 0;
  const countRequest = (req: { resourceType(): string }) => {
    if (['xhr', 'fetch', 'document'].includes(req.resourceType())) requests += 1;
  };
  page.on('request', countRequest);

  // Opening a file picker is a real effect even though nothing in the DOM moves.
  let fileChoosers = 0;
  const countChooser = () => {
    fileChoosers += 1;
  };
  page.on('filechooser', countChooser);

  let clickError: string | null = null;
  try {
    await target.click({ timeout: CLICK_TIMEOUT });
  } catch (err) {
    // Keep Playwright's actionability diagnostics ("element is not stable",
    // "intercepts pointer events") — the first line alone says only "timeout".
    clickError = (err as Error).message
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('Call log:'))
      .slice(0, 5)
      .join(' | ');
  }
  await page.waitForTimeout(SETTLE_MS);
  page.off('request', countRequest);
  page.off('filechooser', countChooser);

  const landedOffApp = !page.url().startsWith('http');
  const after = landedOffApp ? 'off-app' : await fingerprint(page);
  const boundary = landedOffApp ? false : await inErrorBoundary(page);

  const hard: string[] = [];
  if (clickError) hard.push(`click failed: ${clickError}`);
  if (boundary) hard.push('crashed into the error boundary');
  if (landedOffApp) {
    notes.push(`left the app entirely (landed on ${page.url()}) — router.back() with no in-app history`);
  }
  for (const p of problems) {
    if (p.kind === 'pageerror') hard.push(`uncaught: ${p.detail}`);
    if (p.kind === 'http') hard.push(`server error: ${p.detail}`);
  }

  if (hard.length > 0) {
    return { label, index, severity: 'broken', notes: hard };
  }

  for (const p of problems) {
    if (p.kind === 'console') notes.push(`console error: ${p.detail}`);
    if (p.kind === 'dialog') notes.push(`opened a ${p.detail}`);
  }
  const inert =
    before === after && requests === 0 && fileChoosers === 0 && notes.length === 0;
  if (inert && (alreadyActive || blockedByValidation)) {
    // Correctly inert: re-selecting the current option, or a submit the
    // browser refused because required fields are empty.
    return {
      label,
      index,
      severity: 'ok',
      notes: [alreadyActive ? 'already the active/selected option' : 'blocked by native form validation'],
    };
  }
  if (inert) {
    notes.push('DEAD: no observable effect (no navigation, no DOM change, no request)');
  }

  return { label, index, severity: notes.length > 0 ? 'warn' : 'ok', notes };
}

function render(route: string, role: Role, results: ButtonResult[]): string {
  const lines = [`\n[${role}] ${route} — ${results.length} interactive element(s)`];
  for (const r of results) {
    const mark =
      r.severity === 'broken' ? 'BROKEN ' : r.severity === 'warn' ? 'WARN   ' : r.severity === 'skipped' ? 'SKIP   ' : 'ok     ';
    lines.push(`  ${mark} #${r.index} "${r.label}"${r.notes.length ? ` — ${r.notes.join('; ')}` : ''}`);
  }
  return lines.join('\n');
}

for (const role of ['guest', 'shopper', 'designer'] as const) {
  test.describe(`button smoke — ${role}`, () => {
    const routes = ROUTES.filter((r) => r.roles.includes(role));

    for (const { path: route } of routes) {
      test(`${role}: ${route}`, async ({ page }, testInfo) => {
        testInfo.setTimeout(6 * 60 * 1000);

        if (role !== 'guest') {
          const token = await tokenFor(role);
          await page.addInitScript(
            ([key, value]) => {
              // Runs in every document, including the opaque-origin about:blank
              // a router.back() can land on — where storage access throws.
              try {
                window.localStorage.setItem(key, value);
              } catch {
                /* no storage on this origin */
              }
            },
            [TOKEN_KEY, token] as const,
          );
        }

        const problems = watchPage(page);

        // Give history one in-app entry. Re-navigating to the *same* URL is a
        // reload (it replaces rather than pushes), so without this a
        // `router.back()` would land on the tab's initial about:blank.
        if (route !== '/') await page.goto('/', { waitUntil: 'domcontentloaded' });

        await settle(page, route);

        // The route itself must render before we judge its buttons.
        expect(
          await inErrorBoundary(page),
          `${route} rendered the error boundary on load`,
        ).toBe(false);

        const labels = (await labelsFor(page)).slice(0, MAX_BUTTONS_PER_ROUTE);
        const results: ButtonResult[] = [];

        for (let i = 0; i < labels.length; i += 1) {
          const label = labels[i];
          // Index stays aligned with the unfiltered locator — we skip the
          // entry rather than compacting the list.
          if (DEV_OVERLAY_LABEL.test(label)) continue;
          if (SKIP_LABEL.test(label)) {
            results.push({ label, index: i, severity: 'skipped', notes: ['destructive / external — not clicked'] });
            continue;
          }
          results.push(await probe(page, route, i, label, problems));
        }

        const report = render(route, role, results);
        await testInfo.attach(`buttons-${role}${route.replace(/\//g, '_')}.txt`, {
          body: report,
          contentType: 'text/plain',
        });
        console.log(report);

        const broken = results.filter((r) => r.severity === 'broken');
        expect(broken, `broken buttons on ${route}:\n${report}`).toEqual([]);
      });
    }
  });
}
