import { test, expect, type Page } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

/**
 * Navigate through registration wizard steps by filling basics and clicking Next.
 * `targetStep` is 0-indexed (0 = Basics, 1 = Style, 2 = Colors, 3 = Measurements, 4 = Avatar, 5 = Complete).
 */
async function navigateToStep(page: Page, targetStep: number): Promise<void> {
  await page.goto('/register');

  if (targetStep === 0) return;

  // Fill required fields on Step 0 (Basics)
  await page.getByLabel('Email').fill(`testuser+${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('testpassword123');

  for (let i = 0; i < targetStep; i++) {
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
  }
}

test.describe('Registration Wizard', () => {
  test('renders step 1 (Basics) with required fields', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: 'Join IYAE' })).toBeVisible();

    // WizardProgress step labels
    await expect(page.getByText('Basics')).toBeVisible();
    await expect(page.getByText('Style')).toBeVisible();

    // Step 0 input fields
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('Next button disabled without required fields', async ({ page }) => {
    await page.goto('/register');

    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeDisabled();
  });

  test('Next button enabled after filling email and password', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill('testuser@example.com');
    await page.getByLabel('Password').fill(SEED_PASSWORD);

    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeEnabled();
  });

  test('advances to step 2 (Style) on Next click', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill(`testuser+${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('testpassword123');

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Style Aesthetics')).toBeVisible();
  });

  test('Back button returns to previous step', async ({ page }) => {
    await navigateToStep(page, 1);

    // Should be on Step 1 (Style)
    await expect(page.getByText('Style Aesthetics')).toBeVisible();

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
    await page.getByLabel('Email').fill(`testuser+${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Style Aesthetics')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete Later' })).not.toBeVisible();

    // Step 2 (Colors)
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('button', { name: 'Complete Later' })).not.toBeVisible();
  });

  test('full wizard flow navigates through all steps', async ({ page }) => {
    await page.goto('/register');

    // Step 0: Basics
    await expect(page.getByRole('heading', { name: 'Join IYAE' })).toBeVisible();
    await page.getByLabel('Email').fill(`testuser+${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 1: Style
    await expect(page.getByText('Style Aesthetics')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Colors — Next enabled (no required fields)
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Measurements — Complete Later appears
    await expect(page.getByRole('button', { name: 'Complete Later' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Avatar — Complete Later still visible
    await expect(page.getByRole('button', { name: 'Complete Later' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5: Complete — Next/Back hidden, Create Account button visible
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).not.toBeVisible();
  });

  test('submit creates account and redirects to dashboard', async ({ page }) => {
    const uniqueEmail = `testuser+${Date.now()}@example.com`;

    await page.goto('/register');

    // Fill Step 0
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: 'Next' }).click();

    // Navigate through Steps 1-4
    for (let i = 0; i < 4; i++) {
      const nextBtn = page.getByRole('button', { name: 'Next' });
      await expect(nextBtn).toBeEnabled();
      await nextBtn.click();
    }

    // Step 5: Submit
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should redirect to /dashboard on success
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows error on duplicate email', async ({ page }) => {
    // The shopper is a seed user — registration must fail as a duplicate email
    await page.goto('/register');

    await page.getByLabel('Email').fill(SEED_USERS.shopper.email);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: 'Next' }).click();

    // Navigate to Step 5
    for (let i = 0; i < 4; i++) {
      const nextBtn = page.getByRole('button', { name: 'Next' });
      await expect(nextBtn).toBeEnabled();
      await nextBtn.click();
    }

    // Submit
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Error message should appear (email already registered)
    await expect(
      page.getByText(/already registered|already exists|email.*taken/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
