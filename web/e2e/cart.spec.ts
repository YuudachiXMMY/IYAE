import { test, expect, type Page } from '@playwright/test';
import { apiAs, signIn, signOut } from './session';

/**
 * The server cart persists per user, so items survive between runs and the
 * "cart is empty" assertions below could never come true. There is no bulk
 * clear endpoint — only DELETE /api/cart/items/{id} — so empty it item by item.
 */
async function clearServerCart(): Promise<void> {
  const cart = await apiAs<{ items: { id: number }[] }>('shopper', 'GET', '/api/cart');
  for (const item of cart.items) {
    await apiAs('shopper', 'DELETE', `/api/cart/items/${item.id}`);
  }
}

/** Select a size button on the product detail page if one is visible. */
async function selectSizeIfPresent(page: Page) {
  // ONE_SIZE carries an underscore in the app's own data (app/cart/page.tsx:103).
  const sizeButton = page.getByRole('button', { name: /^(XS|S|M|L|XL|XXL|ONE_SIZE)$/ }).first();
  if (await sizeButton.isVisible().catch(() => false)) {
    await sizeButton.click();
  }
}

/** Open the first catalogue product, pick a size if required, and add it. */
async function addFirstProductToCart(page: Page): Promise<void> {
  await page.goto('/products');
  await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

  const firstProductLink = page
    .locator('a[href*="/products/"]')
    .filter({ hasNot: page.locator('nav') })
    .first();
  await firstProductLink.click();
  await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
  await selectSizeIfPresent(page);
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });
}

// Serial: every test here clears and repopulates the ONE server-side cart the
// seed shopper owns, so running them concurrently means each test deletes the
// item another just added.
test.describe.configure({ mode: 'serial' });

test.describe('Shopping cart', () => {
  test.beforeEach(async ({ page }) => {
    await clearServerCart();
    await signIn(page, 'shopper');
    // Clear demo cart items from localStorage before each test
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.removeItem('clossette_demo_cart_items'));
  });

  test('empty cart shows browse products CTA', async ({ page }) => {
    await page.goto('/cart');

    // Empty cart message and Browse Products button
    await expect(page.getByText('Your cart is empty.')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('link', { name: 'Browse Products' })).toBeVisible();
  });

  test('product detail page renders Add to Cart button', async ({ page }) => {
    await page.goto('/products');

    // Wait for products to load
    await expect(page.locator('[class*="grid"]').locator('a').first()).toBeVisible({ timeout: 10000 });

    // Click the first product link
    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();

    // Wait for product detail page
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    // Select a size if size buttons are present
    await selectSizeIfPresent(page);

    // Add to Cart button should be visible
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
  });

  test('can add a product to cart and see it in cart page', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

    // Navigate to first product
    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    // Wait for product info
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });

    // Select a size if size buttons are present
    await selectSizeIfPresent(page);

    await page.getByRole('button', { name: 'Add to Cart' }).click();

    // Confirmation message should appear
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });

    // Navigate to cart
    await page.goto('/cart');

    // Cart should not be empty — either server items or the total count > 0
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Your cart is empty.')).not.toBeVisible({ timeout: 5000 });
  });

  test('cart page shows Your Cart heading', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });
  });

  test('quantity increase button updates item count', async ({ page }) => {
    // First add a product
    await addFirstProductToCart(page);

    // Go to cart
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });

    // The row loads asynchronously after the heading, so wait for the control
    // rather than probing it with an instant isVisible() and skipping.
    const increaseBtn = page.getByLabel('Increase quantity').first();
    await expect(increaseBtn).toBeVisible({ timeout: 10000 });

    // Read current quantity
    const quantityEl = page.locator('span.w-6').first();
    const qtyBefore = await quantityEl.textContent();

    await increaseBtn.click();

    // Wait for update
    await page.waitForTimeout(1000);
    const qtyAfter = await quantityEl.textContent();

    // Quantity should have incremented by 1
    expect(Number(qtyAfter)).toBe(Number(qtyBefore) + 1);
  });

  test('quantity decrease to zero removes item from cart', async ({ page }) => {
    // Add a product first
    await addFirstProductToCart(page);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });

    const decreaseBtn = page.getByLabel('Decrease quantity').first();
    await expect(decreaseBtn).toBeVisible({ timeout: 10000 });

    // Click decrease (quantity is 1 → removing the item)
    await decreaseBtn.click();
    await page.waitForTimeout(1500);

    // Cart should now be empty (or show empty state)
    await expect(page.getByText('Your cart is empty.')).toBeVisible({ timeout: 8000 });
  });

  test('remove item button clears item from cart', async ({ page }) => {
    // Add a product first
    await addFirstProductToCart(page);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });

    const removeBtn = page.getByLabel('Remove item').first();
    await expect(removeBtn).toBeVisible({ timeout: 10000 });

    await removeBtn.click();
    await page.waitForTimeout(1500);

    // After removal cart should be empty
    await expect(page.getByText('Your cart is empty.')).toBeVisible({ timeout: 8000 });
  });

  test('order summary shows total price', async ({ page }) => {
    // Add a product
    await addFirstProductToCart(page);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });

    const summaryHeading = page.getByRole('heading', { name: 'Order Summary' });
    await expect(summaryHeading).toBeVisible({ timeout: 10000 });
    // Total line should show a currency value
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.locator('text=/\\$[0-9]/').last()).toBeVisible({ timeout: 5000 });
  });

  test('checkout button is enabled when cart has items', async ({ page }) => {
    // Add a product
    await addFirstProductToCart(page);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });

    const checkoutBtn = page.getByRole('button', { name: 'Checkout' });
    await expect(checkoutBtn).toBeVisible({ timeout: 10000 });
    await expect(checkoutBtn).toBeEnabled();
  });

  test('unauthenticated user adding product creates demo cart item', async ({ page }) => {
    // `signIn` re-seeds the token on every navigation, so clearing storage by
    // hand is not enough — `signOut` registers a later init script that wins.
    await signOut(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('clossette_demo_cart_items'));

    await addFirstProductToCart(page);

    // Navigate to cart
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });

    // Demo item has an "AI recommendation" badge. `exact` keeps it off the
    // "AI recommendations" section label, which also contains the substring.
    await expect(
      page.getByText('AI recommendation', { exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });
});
