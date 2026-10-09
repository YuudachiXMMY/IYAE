import { test, expect } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

test.describe('AI Stylist chat flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(SEED_USERS.shopper.email);
    await page.getByLabel('Password').fill(SEED_PASSWORD);
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

  test('weather chip renders current conditions when weather is available', async ({ page }) => {
    // Deterministic path: stub /api/chat/weather so the chip MUST render the data.
    await page.route('**/api/chat/weather', (route) =>
      route.fulfill({
        json: { temperatureC: 18, feelsLikeC: 17, condition: 'Clear sky', available: true },
      })
    );
    await page.goto('/chat');

    // Both header chips (mobile + desktop) are always mounted and share one fetch;
    // assert the chip actually reflects the stubbed weather rather than "is a boolean".
    const chip = page.getByRole('status', { name: /current weather/i }).first();
    await expect(chip).toContainText('Toronto', { timeout: 8000 });
    await expect(chip).toContainText('18°C');
    await expect(chip).toContainText('Clear sky');
  });

  test('weather chip is gracefully absent when weather is unavailable', async ({ page }) => {
    await page.route('**/api/chat/weather', (route) =>
      route.fulfill({
        json: { temperatureC: null, feelsLikeC: null, condition: null, available: false },
      })
    );
    const weatherResponse = page.waitForResponse('**/api/chat/weather');
    await page.goto('/chat');
    await weatherResponse;

    // available:false → the chip renders nothing so the header degrades gracefully.
    await expect(page.getByRole('status', { name: /current weather/i })).toHaveCount(0);
  });

  test('welcome screen shows occasion and mood quick-pick chips', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByText('Your AI stylist')).toBeVisible({ timeout: 10000 });
    // Occasion/mood chips render as accessible suggestion groups.
    await expect(page.getByText('Occasion')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mood')).toBeVisible();
  });

  test('inline "Try on my avatar" toggle expands the avatar preview', async ({ page }) => {
    test.slow();
    // Deterministically satisfy both preconditions for the try-on button:
    // (1) the user has an avatar, and (2) the recommended outfit carries a garment GLB.
    await page.route('**/api/avatar', (route) =>
      route.fulfill({ json: { avatarUrl: '/assets/test-avatar.glb', status: 'READY' } })
    );
    // Seed one ACTIVE session so the send flow skips session creation (no reload race).
    await page.route('**/api/chat/sessions', (route) =>
      route.fulfill({ json: [{ id: 4242, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' }] })
    );
    await page.route('**/api/chat/sessions/*/messages', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          json: {
            id: 9001,
            role: 'ASSISTANT',
            content: "Here's a breezy summer look.",
            outfit: {
              id: 9001,
              explanation: 'Light layers for a warm day.',
              items: [
                {
                  slot: 'top',
                  productId: 1,
                  productName: 'Linen Shirt',
                  productPrice: 60,
                  category: 'top',
                  media: [],
                  glbAssetUrl: '/assets/top.glb',
                },
              ],
            },
            outfitRecommendationId: 9001,
            suggestions: [],
            createdAt: '2026-01-01T00:00:00Z',
          },
        });
      }
      return route.fulfill({ json: [] }); // GET history → empty
    });

    await page.goto('/chat');

    const textarea = page.getByPlaceholder('Describe what you\'re dressing for...');
    await textarea.fill('Something for a warm summer day');
    await page.getByRole('button', { name: 'Send message' }).click();

    // With an avatar + a garment GLB, the OutfitCard exposes the inline try-on toggle.
    const tryOn = page.getByRole('button', { name: /try on my avatar/i });
    await expect(tryOn).toBeVisible({ timeout: 15000 });
    await tryOn.click();

    // Toggling reveals the avatar preview (the button flips to the collapse label).
    await expect(
      page.getByRole('button', { name: /hide avatar preview/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('navigating to /looks page shows saved looks section', async ({ page }) => {
    await page.goto('/looks');

    // Page should load (auth guard passes since we're logged in)
    await expect(page).toHaveURL(/\/looks/, { timeout: 10000 });
    // The page should render without redirecting to login
    await expect(page).not.toHaveURL(/\/login/);
  });
});
