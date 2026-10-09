import { test, expect } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

test.describe('Authentication flows', () => {
  test('buyer can log in and reach the dashboard', async ({ page }) => {
    await page.goto('/login');

    // Verify the login page rendered (editorial <h1>, trailing period)
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();

    // Fill credentials
    await page.getByLabel('Email').fill(SEED_USERS.shopper.email);
    await page.getByLabel('Password').fill(SEED_PASSWORD);

    // Submit
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should redirect to /dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('register page renders wizard and accepts input on step 1', async ({ page }) => {
    await page.goto('/register');

    // There is no page-level heading any more — the wizard step owns it.
    await expect(
      page.getByRole('heading', { name: 'Create your account.' }),
    ).toBeVisible();

    // WizardProgress now groups the six steps into three display labels. Scope
    // to <main>: SiteHeader also carries an "ACCOUNT" link.
    const wizard = page.getByRole('main');
    await expect(wizard.getByText('ACCOUNT', { exact: true })).toBeVisible();
    await expect(wizard.getByText('STYLE PROFILE', { exact: true })).toBeVisible();

    // StepBasics fields are visible
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Fill required fields on step 1 (Basics)
    await page.getByLabel('Email').fill(`testuser+${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('testpassword123');

    // The step CTA is "CONTINUE" (CTA_LABEL in app/register/page.tsx), not "Next".
    const nextButton = page.getByRole('button', { name: 'CONTINUE' });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    // Advance to step 2
    await nextButton.click();

    // Should now see the Style step's heading
    await expect(
      page.getByRole('heading', { name: 'What feels most like you?' }),
    ).toBeVisible();
  });

  test('products page loads without authentication', async ({ page }) => {
    await page.goto('/products');

    // Verify the products page header
    await expect(
      page.getByRole('heading', { name: 'Pieces, considered for you.' }),
    ).toBeVisible();

    // Wait for loading to complete — the count reads "N pieces" after fetch
    await expect(page.getByText(/\d+ pieces?/)).toBeVisible({ timeout: 10000 });
  });

  test('login shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should show an error message and stay on login page
    await expect(page.getByText(/error|invalid|incorrect/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/login');

    const registerLink = page.getByRole('link', { name: 'Create an account' });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute('href', '/register');
  });

  test('register page has link to login', async ({ page }) => {
    await page.goto('/register');

    const loginLink = page.getByRole('link', { name: 'Sign in' });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });
});
