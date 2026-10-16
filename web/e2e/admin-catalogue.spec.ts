import { test, expect } from '@playwright/test';
import { signIn, apiAs } from './session';

/**
 * B-11. The operator ADMIN must be able to put content in the shop.
 *
 * This is the only test that exercises the whole chain for ADMIN — JWT, the `/api/designer/**`
 * matcher, `DesignerUploadController`'s own role check, `ProductService.resolveDesignerProfile`,
 * and the `DesignerProfile` that `DataSeeder`/`AdminBootstrap` create for the operator. The unit
 * and WebMvc slices each pin one link; a missing profile, for instance, is invisible to every
 * one of them because they mock the service that resolves it.
 *
 * Mutates state (creates listings under the operator account), so it belongs to the serial
 * `regression` project — which it joins automatically, since the split is by `testIgnore`.
 */

const UNIQUE_SUFFIX = () => Date.now().toString();

type ProductSummary = { id: number; name: string };

test.describe('Operator ADMIN catalogue access', () => {
  const createdIds: number[] = [];

  test.afterAll(async () => {
    for (const id of createdIds) {
      await apiAs('admin', 'DELETE', `/api/designer/products/${id}`).catch(() => {
        // Best effort: a leaked listing makes the next run noisier, not wrong, and throwing
        // here would mask the failure of the test that created it.
      });
    }
  });

  test('reaches the designer products page instead of the "Designer area" dead end', async ({
    page,
  }) => {
    await signIn(page, 'admin');
    await page.goto('/designer/products');

    await expect(page.getByRole('heading', { name: 'My products' })).toBeVisible({
      timeout: 10000,
    });
    // The in-place gate a BUYER gets. Before B-11 this is what the operator saw — and the four
    // sibling routes bounced them to /dashboard outright.
    await expect(page.getByText('Designer area')).not.toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('is offered the Studio link in the header menu alongside Admin', async ({ page }) => {
    // SiteHeader used to treat designer and admin as mutually exclusive branches, so an ADMIN
    // got the Admin link and no route into the studio at all.
    await signIn(page, 'admin');
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Account menu' }).click();

    await expect(page.getByRole('menuitem', { name: 'Studio' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('menuitem', { name: 'Promotions' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
  });

  test('creates a product through the studio form and sees it in the list', async ({ page }) => {
    test.slow();
    const productName = `Operator Listing ${UNIQUE_SUFFIX()}`;

    await signIn(page, 'admin');
    await page.goto('/designer/products/new');

    await page.getByLabel(/^Name/).fill(productName);
    await page.getByLabel(/Price/).fill('148.00');
    const categoryTrigger = page.getByRole('combobox').first();
    await categoryTrigger.click();
    await page.getByRole('option', { name: /Tops/i }).click();

    await page.getByRole('button', { name: /Create product/i }).click();

    await page.waitForURL('/designer/products', { timeout: 10000 });
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });

    const mine = await apiAs<ProductSummary[]>('admin', 'GET', '/api/designer/products');
    const created = mine.find((p) => p.name === productName);
    expect(created, 'the created listing should be owned by the operator').toBeTruthy();
    createdIds.push(created!.id);
  });

  test('may write to the promotions surface', async () => {
    // `/api/promotions/**` was the second matcher reserved to DESIGNER, so the operator could not
    // fill the FEATURED carousel. No UI path here — this is the authorization itself.
    const productName = `Operator Promo Source ${UNIQUE_SUFFIX()}`;
    const product = await apiAs<ProductSummary>('admin', 'POST', '/api/designer/products', {
      name: productName,
      price: 96.0,
      currency: 'CAD',
      category: 'Tops',
      sizes: ['S', 'M'],
    });
    createdIds.push(product.id);

    // startAt/endAt are both @NotNull on PromotionRequest — omitting them answers 400, which
    // would pass straight through an authorization check and prove nothing.
    const now = Date.now();
    const promotion = await apiAs<{ id: number; slotType: string }>(
      'admin',
      'POST',
      '/api/promotions',
      {
        productId: product.id,
        slotType: 'FEATURED',
        weight: 1,
        startAt: new Date(now - 60_000).toISOString(),
        endAt: new Date(now + 3_600_000).toISOString(),
      },
    );

    expect(promotion.slotType).toBe('FEATURED');
    await apiAs('admin', 'DELETE', `/api/promotions/${promotion.id}`).catch(() => {});
  });
});
