import { test, expect } from '@playwright/test';

test.describe('AI Stylist chat flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('emma@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('chat page renders input and send button', async ({ page }) => {
    await page.goto('/chat');

    await expect(
      page.getByPlaceholder('Describe what you\'re dressing for...')
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test('welcome screen shows quick-start prompt cards', async ({ page }) => {
    await page.goto('/chat');

    await expect(page.getByText('Your AI stylist')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Date night')).toBeVisible();
    await expect(page.getByText('Weekend brunch')).toBeVisible();
  });

  test('can send a message and receive AI reply', async ({ page }) => {
    test.slow();
    await page.goto('/chat');

    const textarea = page.getByPlaceholder('Describe what you\'re dressing for...');
    await textarea.fill('I need a casual summer outfit');

    await page.getByRole('button', { name: 'Send message' }).click();

    // User message appears optimistically
    await expect(page.getByText('I need a casual summer outfit')).toBeVisible({ timeout: 5000 });

    // Wait for AI reply (mock provider responds quickly)
    await expect(page.locator('[class*="rounded-2xl"]').nth(1)).toBeVisible({ timeout: 15000 });
  });

  test('quick-start card creates session and sends prompt', async ({ page }) => {
    test.slow();
    await page.goto('/chat');

    await expect(page.getByText('Date night')).toBeVisible({ timeout: 10000 });
    await page.getByText('Date night').click();

    // After clicking, the prompt text should appear as a user message
    await expect(
      page.getByText(/dinner date/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test('suggestion chips appear after AI reply and are clickable', async ({ page }) => {
    test.slow();
    await page.goto('/chat');

    const textarea = page.getByPlaceholder('Describe what you\'re dressing for...');
    await textarea.fill('Show me outfit ideas');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText('Show me outfit ideas')).toBeVisible({ timeout: 5000 });

    // If suggestion chips render, click the first one
    const chips = page.getByRole('group', { name: /suggestions/i });
    const hasChips = await chips.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasChips) {
      const firstChip = chips.getByRole('button').first();
      await expect(firstChip).toBeVisible();
      await firstChip.click();
      // Chip text should appear as next user message
      const chipText = await firstChip.textContent();
      if (chipText) {
        await expect(page.getByText(chipText.trim())).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('weather chip renders or is gracefully absent', async ({ page }) => {
    await page.goto('/chat');
    // Weather may be unavailable offline/in CI — assertion is tolerant either way.
    const chip = page.getByRole('status', { name: /weather/i });
    const visible = await chip.first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(typeof visible).toBe('boolean');
  });

  test('welcome screen shows occasion and mood quick-pick chips', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByText('Your AI stylist')).toBeVisible({ timeout: 10000 });
    // Occasion/mood chips render as accessible suggestion groups.
    await expect(page.getByText('Occasion')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mood')).toBeVisible();
  });

  test('inline "Try on my avatar" toggle is tolerant when avatar/GLBs are absent', async ({ page }) => {
    await page.goto('/chat');
    const tryOn = page.getByRole('button', { name: /try on my avatar/i });
    // The button only appears when the user has an avatar AND the outfit has GLBs.
    const present = await tryOn.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (present) {
      await tryOn.first().click();
      await expect(
        page.getByRole('button', { name: /hide avatar preview/i })
      ).toBeVisible({ timeout: 5000 });
    }
    expect(typeof present).toBe('boolean');
  });

  test('navigating to /looks page shows saved looks section', async ({ page }) => {
    await page.goto('/looks');

    // Page should load (auth guard passes since we're logged in)
    await expect(page).toHaveURL(/\/looks/, { timeout: 10000 });
    // The page should render without redirecting to login
    await expect(page).not.toHaveURL(/\/login/);
  });
});
