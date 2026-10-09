import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Mints one JWT per seed role for the whole run. Without it each worker logs
  // in for itself and trips the API's 5-logins-per-minute-per-IP rate limit.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  // Two projects so the two halves of the suite can run at different
  // concurrency in the same stack.
  //
  // `regression` must stay effectively serial: several specs mutate state the
  // seed accounts share (the shopper's single server-side cart, follow edges).
  // Giving checkout its own account is not an option — every extra role costs
  // a login, and `POST /api/auth/login` allows only five per minute per IP.
  //
  // `button-smoke` is 92% of the wall clock on its own (13 of 14 minutes at
  // one worker) and is safe to parallelise: it re-navigates before every click
  // and shares no fixture.
  //
  // `testIgnore` rather than a list of files on purpose: a newly added spec
  // joins `regression` automatically instead of silently going unrun.
  projects: [
    {
      name: 'regression',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/button-smoke.spec.ts',
    },
    {
      name: 'audit',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/button-smoke.spec.ts',
    },
  ],
  // webServer is intentionally omitted — tests assume the dev server
  // and API server are already running (npm run dev on :3000, API on :3001).
});
