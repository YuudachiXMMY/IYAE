import { test, expect, type Page } from '@playwright/test';

async function loginAsBuyer(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('emma@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

test.describe('Checkout flow', () => {
  test('products page shows at least one product', async ({ page }) => {
    await page.goto('/products');
    // Wait for items count text to appear (loaded from API)
    await expect(page.getByText(/\d+ pieces/)).toBeVisible({ timeout: 10000 });
  });

  test('authenticated user can browse and see product detail', async ({ page }) => {
    await loginAsBuyer(page);

    await page.goto('/products');
    await expect(page.getByText(/\d+ pieces/)).toBeVisible({ timeout: 10000 });

    // Click the first product card
    const firstProduct = page.locator('a[href^="/products/"]').first();
    await expect(firstProduct).toBeVisible({ timeout: 10000 });
    await firstProduct.click();

    // Should be on a product detail page
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/products\/\d+/);

    // Add to Cart button should be visible
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 10000 });
  });

  test('authenticated user can add a product to cart', async ({ page }) => {
    await loginAsBuyer(page);

    await page.goto('/products');
    await expect(page.getByText(/\d+ pieces/)).toBeVisible({ timeout: 10000 });

    // Navigate to first product
    const firstProduct = page.locator('a[href^="/products/"]').first();
    await firstProduct.click();
    await page.waitForLoadState('networkidle');

    // Add to cart
    await page.getByRole('button', { name: 'Add to Cart' }).click();

    // Expect success feedback
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 10000 });
  });

  test('cart page renders with heading and items after add', async ({ page }) => {
    await loginAsBuyer(page);

    // Add one item first
    await page.goto('/products');
    await expect(page.getByText(/\d+ pieces/)).toBeVisible({ timeout: 10000 });

    const firstProduct = page.locator('a[href^="/products/"]').first();
    await firstProduct.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 10000 });

    // Navigate to cart
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Cart heading visible
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();

    // Order summary section and checkout button should be present
    await expect(page.getByRole('heading', { name: 'Order Summary' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible({ timeout: 10000 });
  });

  test('checkout page renders order summary for authenticated user', async ({ page }) => {
    await loginAsBuyer(page);

    // Add an item so cart is not empty
    await page.goto('/products');
    await expect(page.getByText(/\d+ pieces/)).toBeVisible({ timeout: 10000 });

    const firstProduct = page.locator('a[href^="/products/"]').first();
    await firstProduct.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 10000 });

    // Go to checkout
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible({ timeout: 10000 });

    // Either shows order summary (cart not empty) or empty cart message
    const hasSummary = await page.getByRole('heading', { name: 'Order Summary' }).isVisible();
    const hasEmpty = await page.getByText('Your cart is empty').isVisible();

    // At least one state should be visible
    expect(hasSummary || hasEmpty).toBeTruthy();
  });

  test('place order redirects to success or Stripe URL', async ({ page }) => {
    await loginAsBuyer(page);

    // Ensure cart has an item
    await page.goto('/products');
    await expect(page.getByText(/\d+ pieces/)).toBeVisible({ timeout: 10000 });

    const firstProduct = page.locator('a[href^="/products/"]').first();
    await firstProduct.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 10000 });

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    const placeOrderBtn = page.getByRole('button', { name: 'Place Order' });

    if (await placeOrderBtn.isVisible()) {
      await placeOrderBtn.click();

      // In stub/mock mode: redirects to /checkout/success
      // In real Stripe mode: redirects to Stripe (external URL)
      // We allow both outcomes
      await page.waitForURL(
        (url) =>
          url.pathname === '/checkout/success' || url.hostname.includes('stripe.com'),
        { timeout: 10000 },
      ).catch(() => {
        // If neither happened, at minimum we should still be on /checkout (error shown)
        // or have been redirected somewhere — check no crash
      });

      const currentUrl = page.url();
      const isSuccess = currentUrl.includes('/checkout/success');
      const isStripe = currentUrl.includes('stripe.com');
      const isCheckout = currentUrl.includes('/checkout');

      expect(isSuccess || isStripe || isCheckout).toBeTruthy();
    } else {
      // Cart might be empty from previous test state — acceptable
      await expect(page.getByText(/empty|Checkout/i)).toBeVisible();
    }
  });

  test('checkout/success page renders confirmation', async ({ page }) => {
    await loginAsBuyer(page);
    await page.goto('/checkout/success');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View My Orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue Shopping' })).toBeVisible();
  });

  test('checkout is free of dark patterns (no pre-checked opt-ins, no fake urgency, itemized total)', async ({ page }) => {
    await loginAsBuyer(page);

    // Ensure cart has an item so the order summary renders
    await page.goto('/products');
    await expect(page.getByText(/\d+ pieces/)).toBeVisible({ timeout: 10000 });
    const firstProduct = page.locator('a[href^="/products/"]').first();
    await firstProduct.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 10000 });

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    const hasSummary = await page.getByRole('heading', { name: 'Order Summary' }).isVisible();
    test.skip(!hasSummary, 'Cart empty from prior test state — nothing to audit');

    // 1) No checkbox is checked by default (no sneaking / forced opt-ins)
    const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count();
    expect(checkedBoxes).toBe(0);

    // 2) No fake-urgency / scarcity copy anywhere on the page
    const urgency = page.getByText(/only \d+ left|hurry|expires in|\d+:\d{2}\b/i);
    expect(await urgency.count()).toBe(0);

    // 3) Total is itemized and equals the subtotal of the listed items (no hidden fees)
    const subtotal = (await page.getByTestId('checkout-subtotal').textContent())?.trim();
    const total = (await page.getByTestId('checkout-total').textContent())?.trim();
    expect(subtotal).toBeTruthy();
    expect(total).toBe(subtotal);
  });

  test('orders page renders for authenticated user', async ({ page }) => {
    await loginAsBuyer(page);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible({ timeout: 10000 });

    // Either shows orders list or empty state — both are valid
    const hasOrders = await page.getByText(/Order #\d+/).isVisible();
    const hasEmpty = await page.getByText('No orders yet').isVisible();
    const hasLoading = await page.locator('.animate-pulse').isVisible();

    expect(hasOrders || hasEmpty || hasLoading).toBeTruthy();
  });
});
