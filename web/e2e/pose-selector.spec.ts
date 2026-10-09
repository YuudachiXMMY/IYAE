import { test, expect, type Page } from '@playwright/test';
import { signIn } from './session';

// NOTE: the 5 canvas-dependent tests below are `test.fixme` — they require a seeded
// outfit with a RIGGED garment (non-null riggedGlbUrl) reachable at /outfits/[id]/view,
// which `DataSeeder` does not create (it seeds no outfits/looks/rigging_tasks). The
// roving-tabindex + arrow-key a11y behavior they assert is covered deterministically in
// CI by web/__tests__/components/PoseSelector.test.tsx. Un-fixme once a rigged outfit is
// seeded (see .claude/PRPs/plans/completed/phase9-live-validation.plan.md, Task 4A).
test.describe('Pose Selector', () => {
  test.beforeEach(async ({ page }) => {
    // Seeded token, not the sign-in form: the API allows only five logins per
    // minute per IP and this spec's subject is the pose strip.
    await signIn(page, 'shopper');
    await page.goto('/dashboard');
  });

  async function navigateToOutfitWithViewer(page: Page) {
    await page.goto('/outfits');
    const viewLink = page.locator('a[href*="/outfits/"][href*="/view"]').first();
    await viewLink.click();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
  }

  test.fixme('shows pose selector with category labels', async ({ page }) => {
    test.setTimeout(30000);
    await navigateToOutfitWithViewer(page);
    await expect(page.getByRole('button', { name: 'A-Pose' })).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('button', { name: 'A-Pose' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Relaxed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Walking' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sitting' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contrapposto' })).toBeVisible();

    await expect(page.getByText('Stationary')).toBeVisible();
    await expect(page.getByText('Movement')).toBeVisible();
    await expect(page.getByText('Lifestyle')).toBeVisible();

    for (const name of ['A-Pose', 'Relaxed', 'Walking', 'Sitting', 'Contrapposto']) {
      await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test.fixme('switches active pose state on click', async ({ page }) => {
    test.setTimeout(30000);
    await navigateToOutfitWithViewer(page);
    await expect(page.getByRole('button', { name: 'A-Pose' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Relaxed' }).click();
    await expect(page.getByRole('button', { name: 'Relaxed' })).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['A-Pose', 'Walking', 'Sitting', 'Contrapposto']) {
      await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }

    await page.getByRole('button', { name: 'Walking' }).click();
    await expect(page.getByRole('button', { name: 'Walking' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Relaxed' })).toHaveAttribute('aria-pressed', 'false');
  });

  test.fixme('arrow keys move focus and selection (APG roving-tabindex)', async ({ page }) => {
    test.setTimeout(30000);
    await navigateToOutfitWithViewer(page);
    await expect(page.getByRole('button', { name: 'A-Pose' })).toBeVisible({ timeout: 15000 });

    const aPose = page.getByRole('button', { name: 'A-Pose' });
    const relaxed = page.getByRole('button', { name: 'Relaxed' });

    // Focus the first pose, then ArrowRight moves focus AND selection to the next.
    await aPose.focus();
    await page.keyboard.press('ArrowRight');
    await expect(relaxed).toBeFocused();
    await expect(relaxed).toHaveAttribute('aria-pressed', 'true');

    // ArrowLeft moves back; clamps at the first pose.
    await page.keyboard.press('ArrowLeft');
    await expect(aPose).toBeFocused();
    await expect(aPose).toHaveAttribute('aria-pressed', 'true');
  });

  test.fixme('pose change produces different canvas screenshot', async ({ page }) => {
    test.setTimeout(30000);
    await navigateToOutfitWithViewer(page);
    await expect(page.getByRole('button', { name: 'A-Pose' })).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);
    await expect(page.locator('canvas')).toHaveScreenshot('pose-initial.png', { maxDiffPixelRatio: 0.05 });

    await page.getByRole('button', { name: 'Sitting' }).click();
    await page.waitForTimeout(800);
    await expect(page.locator('canvas')).toHaveScreenshot('pose-sitting.png', { maxDiffPixelRatio: 0.05 });
  });

  test.fixme('handles rapid pose switching without crash', async ({ page }) => {
    test.setTimeout(30000);
    await navigateToOutfitWithViewer(page);
    await expect(page.getByRole('button', { name: 'A-Pose' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'A-Pose' }).click();
    await page.getByRole('button', { name: 'Relaxed' }).click();
    await page.getByRole('button', { name: 'Walking' }).click();
    await page.getByRole('button', { name: 'Sitting' }).click();
    await page.getByRole('button', { name: 'Contrapposto' }).click();

    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: 'Contrapposto' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('pose selector hidden without rigged garments', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/outfits/99999/view');
    await expect(
      page.getByText(/failed to load|not found|error/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'A-Pose' })).not.toBeVisible();
  });
});
