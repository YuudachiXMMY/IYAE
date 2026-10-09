import { test, expect, type Page, type Locator } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

/**
 * The step CTA is no longer a single "Next" label: `CTA_LABEL` in
 * app/register/page.tsx reads "CONTINUE" on steps 0/2/3/4 and
 * "BUILD MY PROFILE" on step 1. One locator covers every step so the step
 * copy can change again without touching 14 call sites.
 */
function cta(page: Page): Locator {
  return page.getByRole('button', { name: /^(CONTINUE|BUILD MY PROFILE)$/ });
}

/** The wizard step labels collide with SiteHeader chrome, so scope to <main>. */
function wizardLabel(page: Page, label: string): Locator {
  return page.getByRole('main').getByText(label, { exact: true });
}

function uniqueEmail(): string {
  return `testuser+${Date.now()}@example.com`;
}

/**
 * Navigate through registration wizard steps by filling basics and advancing.
 * `targetStep` is 0-indexed (0 = Basics, 1 = Style, 2 = Colors, 3 = Measurements, 4 = Avatar, 5 = Complete).
 */
async function navigateToStep(page: Page, targetStep: number): Promise<void> {
  await page.goto('/register');

  if (targetStep === 0) return;

  // Fill required fields on Step 0 (Basics)
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password').fill('testpassword123');

  for (let i = 0; i < targetStep; i++) {
    await expect(cta(page)).toBeEnabled();
    await cta(page).click();
  }
}

test.describe('Registration Wizard', () => {
  test('renders step 1 (Basics) with required fields', async ({ page }) => {
    await page.goto('/register');

    // The step owns the heading; there is no page-level "Join IYAE" any more.
    await expect(
      page.getByRole('heading', { name: 'Create your account.' }),
    ).toBeVisible();

    // WizardProgress groups the six steps into three display labels.
    await expect(wizardLabel(page, 'ACCOUNT')).toBeVisible();
    await expect(wizardLabel(page, 'STYLE PROFILE')).toBeVisible();

    // Step 0 input fields
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('step CTA disabled without required fields', async ({ page }) => {
    await page.goto('/register');

    await expect(cta(page)).toBeVisible();
    await expect(cta(page)).toBeDisabled();
  });

  test('step CTA enabled after filling email and password', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill('testuser@example.com');
    await page.getByLabel('Password').fill(SEED_PASSWORD);

    await expect(cta(page)).toBeEnabled();
  });

  test('advances to step 2 (Style) on CTA click', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password').fill('testpassword123');

    await cta(page).click();

    await expect(
      page.getByRole('heading', { name: 'What feels most like you?' }),
    ).toBeVisible();
  });

  test('Back button returns to previous step', async ({ page }) => {
    await navigateToStep(page, 1);

    // Should be on Step 1 (Style)
    await expect(
      page.getByRole('heading', { name: 'What feels most like you?' }),
    ).toBeVisible();

    // Go back
    await page.getByRole('button', { name: 'Back' }).click();

    // Should be back on Step 0 (Basics) — Email field visible again
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('step 3 (Measurements) shows Complete Later button', async ({ page }) => {
    await navigateToStep(page, 3);

    await expect(page.getByRole('button', { name: 'Complete Later' })).toBeVisible();
  });

  test('Complete Later not visible on steps 1 and 2', async ({ page }) => {
    // Step 0 (Basics)
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'Complete Later' })).not.toBeVisible();

    // Step 1 (Style)
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password').fill('testpassword123');
    await cta(page).click();
    await expect(
      page.getByRole('heading', { name: 'What feels most like you?' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete Later' })).not.toBeVisible();

    // Step 2 (Colors)
    await cta(page).click();
    await expect(page.getByRole('button', { name: 'Complete Later' })).not.toBeVisible();
  });

  test('full wizard flow navigates through all steps', async ({ page }) => {
    await page.goto('/register');

    // Step 0: Basics
    await expect(
      page.getByRole('heading', { name: 'Create your account.' }),
    ).toBeVisible();
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password').fill('testpassword123');
    await cta(page).click();

    // Step 1: Style
    await expect(
      page.getByRole('heading', { name: 'What feels most like you?' }),
    ).toBeVisible();
    await cta(page).click();

    // Step 2: Colors — CTA enabled (no required fields)
    await cta(page).click();

    // Step 3: Measurements — Complete Later appears
    await expect(page.getByRole('button', { name: 'Complete Later' })).toBeVisible();
    await cta(page).click();

    // Step 4: Avatar — Complete Later still visible
    await expect(page.getByRole('button', { name: 'Complete Later' })).toBeVisible();
    await cta(page).click();

    // Step 5: Complete — step CTA/Back hidden, Create Account button visible
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    await expect(cta(page)).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).not.toBeVisible();
  });

  test('submit creates account and leaves the wizard', async ({ page }) => {
    await page.goto('/register');

    // Fill Step 0
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password').fill('testpassword123');
    await cta(page).click();

    // Navigate through Steps 1-4
    for (let i = 0; i < 4; i++) {
      await expect(cta(page)).toBeEnabled();
      await cta(page).click();
    }

    // Step 5: Submit
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Account' }).click();

    // `resolvePostRegisterRedirect` sends unverified accounts to the pending
    // page and verified ones to the dashboard, so the destination depends on
    // how the environment seeds `emailVerified`. Either is a successful signup.
    await page.waitForURL(/\/(dashboard|verify-email\/pending)/, { timeout: 15000 });
  });

  test('shows error on duplicate email', async ({ page }) => {
    // The shopper is a seed user — registration must fail as a duplicate email
    await page.goto('/register');

    await page.getByLabel('Email').fill(SEED_USERS.shopper.email);
    await page.getByLabel('Password').fill('testpassword123');
    await cta(page).click();

    // Navigate to Step 5
    for (let i = 0; i < 4; i++) {
      await expect(cta(page)).toBeEnabled();
      await cta(page).click();
    }

    // Submit
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Error message should appear (email already registered)
    await expect(
      page.getByText(/already registered|already exists|email.*taken/i),
    ).toBeVisible({ timeout: 10000 });
  });
});
