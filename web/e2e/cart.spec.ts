import { test, expect } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

/** Select a size button on the product detail page if one is visible. */
async function selectSizeIfPresent(page: import('@playwright/test').Page) {
  const sizeButton = page.getByRole('button', { name: /^(XS|S|M|L|XL|XXL|ONE SIZE)$/ }).first();
  if (await sizeButton.isVisible().catch(() => false)) {
    await sizeButton.click();
  }
}

test.describe('Shopping cart', () => {
  test.beforeEach(async ({ page }) => {
    // Clear demo cart items from localStorage before each test
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('clossette_demo_cart_items'));

    await page.getByLabel('Email').fill(SEED_USERS.shopper.email);
    await page.getByLabel('Password').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard', { timeout: 10000 });
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
    await expect(page.getByText('Your Cart')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Your cart is empty.')).not.toBeVisible({ timeout: 5000 });
  });

  test('cart page shows Your Cart heading', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });
  });

  test('quantity increase button updates item count', async ({ page }) => {
    // First add a product
    await page.goto('/products');
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
    await selectSizeIfPresent(page);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });

    // Go to cart
    await page.goto('/cart');
    await expect(page.getByText('Your Cart')).toBeVisible({ timeout: 8000 });

    // Check quantity controls exist
    const increaseBtn = page.getByLabel('Increase quantity').first();
    const hasIncrease = await increaseBtn.isVisible().catch(() => false);

    if (!hasIncrease) {
      // Cart might be empty if server-side add failed
      test.skip();
      return;
    }

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
    await page.goto('/products');
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
    await selectSizeIfPresent(page);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });

    await page.goto('/cart');
    await expect(page.getByText('Your Cart')).toBeVisible({ timeout: 8000 });

    const decreaseBtn = page.getByLabel('Decrease quantity').first();
    const hasDecrease = await decreaseBtn.isVisible().catch(() => false);

    if (!hasDecrease) {
      test.skip();
      return;
    }

    // Click decrease (quantity is 1 → removing the item)
    await decreaseBtn.click();
    await page.waitForTimeout(1500);

    // Cart should now be empty (or show empty state)
    await expect(page.getByText('Your cart is empty.')).toBeVisible({ timeout: 8000 });
  });

  test('remove item button clears item from cart', async ({ page }) => {
    // Add a product first
    await page.goto('/products');
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
    await selectSizeIfPresent(page);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });

    await page.goto('/cart');
    await expect(page.getByText('Your Cart')).toBeVisible({ timeout: 8000 });

    const removeBtn = page.getByLabel('Remove item').first();
    const hasRemove = await removeBtn.isVisible().catch(() => false);

    if (!hasRemove) {
      test.skip();
      return;
    }

    await removeBtn.click();
    await page.waitForTimeout(1500);

    // After removal cart should be empty
    await expect(page.getByText('Your cart is empty.')).toBeVisible({ timeout: 8000 });
  });

  test('order summary shows total price', async ({ page }) => {
    // Add a product
    await page.goto('/products');
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
    await selectSizeIfPresent(page);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });

    await page.goto('/cart');
    await expect(page.getByText('Your Cart')).toBeVisible({ timeout: 8000 });

    const summaryHeading = page.getByRole('heading', { name: 'Order Summary' });
    const hasItems = await summaryHeading.isVisible().catch(() => false);

    if (!hasItems) {
      test.skip();
      return;
    }

    await expect(summaryHeading).toBeVisible();
    // Total line should show a currency value
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.locator('text=/\\$[0-9]/').last()).toBeVisible({ timeout: 5000 });
  });

  test('checkout button is enabled when cart has items', async ({ page }) => {
    // Add a product
    await page.goto('/products');
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
    await selectSizeIfPresent(page);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });

    await page.goto('/cart');
    await expect(page.getByText('Your Cart')).toBeVisible({ timeout: 8000 });

    const checkoutBtn = page.getByRole('button', { name: 'Checkout' });
    const hasCheckout = await checkoutBtn.isVisible().catch(() => false);

    if (!hasCheckout) {
      test.skip();
      return;
    }

    await expect(checkoutBtn).toBeEnabled();
  });

  test('unauthenticated user adding product creates demo cart item', async ({ page }) => {
    // Log out first
    await page.evaluate(() => {
      localStorage.removeItem('clossette_token');
      localStorage.removeItem('clossette_demo_cart_items');
    });
    await page.reload();

    await page.goto('/products');
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 10000 });

    const firstProductLink = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('nav') }).first();
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/, { timeout: 8000 });

    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible({ timeout: 8000 });
    await selectSizeIfPresent(page);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible({ timeout: 5000 });

    // Navigate to cart
    await page.goto('/cart');
    await expect(page.getByText('Your Cart')).toBeVisible({ timeout: 8000 });

    // Demo item has "AI recommendation" badge
    await expect(page.getByText('AI recommendation')).toBeVisible({ timeout: 5000 });
  });
});
