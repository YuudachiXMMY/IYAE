import { test, expect } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

test.describe('Authentication flows', () => {
  test('buyer can log in and reach the dashboard', async ({ page }) => {
    await page.goto('/login');

    // Verify the login page rendered
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

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

    // Verify the register page heading rendered
    await expect(page.getByRole('heading', { name: 'Join IYAE' })).toBeVisible();

    // Verify WizardProgress step labels are visible
    await expect(page.getByText('Basics')).toBeVisible();
    await expect(page.getByText('Style')).toBeVisible();

    // StepBasics fields are visible
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Fill required fields on step 1 (Basics)
    await page.getByLabel('Email').fill(`testuser+${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('testpassword123');

    // Next button should become enabled after filling required fields
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    // Advance to step 2
    await nextButton.click();

    // Should now see Style step
    await expect(page.getByText('Style Aesthetics')).toBeVisible();
  });

  test('products page loads without authentication', async ({ page }) => {
    await page.goto('/products');

    // Verify the products page header
    await expect(page.getByRole('heading', { name: 'Browse Products' })).toBeVisible();

    // Wait for loading to complete — the item count text appears after fetch
    await expect(page.getByText(/\d+ items/)).toBeVisible({ timeout: 10000 });
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

    const registerLink = page.getByRole('link', { name: 'Create one' });
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
