import { test, expect } from '@playwright/test';
import { signIn } from './session';

const UNIQUE_SUFFIX = () => Date.now().toString();

test.describe('Designer product CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'designer');
    await page.goto('/dashboard');
  });

  test('designer products page renders', async ({ page }) => {
    await page.goto('/designer/products');

    await expect(page.getByRole('heading', { name: 'My products' })).toBeVisible({
      timeout: 10000,
    });
    // Create product button is present
    await expect(page.getByRole('button', { name: 'Create product' })).toBeVisible();
  });

  test('navigates to new product form', async ({ page }) => {
    await page.goto('/designer/products');

    await page.getByRole('button', { name: 'Create product' }).click();
    await page.waitForURL('/designer/products/new', { timeout: 5000 });

    // "New Product" is a shadcn CardTitle, which renders a <div> — not a heading.
    await expect(page.getByText('New Product')).toBeVisible({
      timeout: 5000,
    });
  });

  test('create product form has required fields', async ({ page }) => {
    await page.goto('/designer/products/new');

    await expect(page.getByLabel(/Name/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/Price/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Create product/i })).toBeVisible();
  });

  test('create product → appears in list', async ({ page }) => {
    test.slow();
    const productName = `Test Product ${UNIQUE_SUFFIX()}`;

    await page.goto('/designer/products/new');

    // Fill required fields
    await page.getByLabel(/^Name/).fill(productName);
    await page.getByLabel(/Price/).fill('49.99');

    // Select category via combobox/select
    const categoryTrigger = page.getByRole('combobox').first();
    await categoryTrigger.click();
    await page.getByRole('option', { name: /Tops/i }).click();

    await page.getByRole('button', { name: /Create product/i }).click();

    // Should redirect back to products list
    await page.waitForURL('/designer/products', { timeout: 10000 });

    // New product should be visible in the list
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });
  });

  test('edit product price', async ({ page }) => {
    test.slow();
    const productName = `Edit Test ${UNIQUE_SUFFIX()}`;

    // Create a product first
    await page.goto('/designer/products/new');
    await page.getByLabel(/^Name/).fill(productName);
    await page.getByLabel(/Price/).fill('29.99');
    const categoryTrigger = page.getByRole('combobox').first();
    await categoryTrigger.click();
    await page.getByRole('option', { name: /Tops/i }).click();
    await page.getByRole('button', { name: /Create product/i }).click();
    await page.waitForURL('/designer/products', { timeout: 10000 });

    // The name node is pointer-events-none and sits under a stretched edit
    // link, so clicking the text fails the hit-target check — click the link.
    await page.getByRole('link', { name: `Edit ${productName}` }).click();
    await page.waitForURL(/\/designer\/products\/\d+\/edit/, { timeout: 5000 });

    // Update price
    const priceInput = page.getByLabel(/Price/);
    await priceInput.clear();
    await priceInput.fill('59.99');

    await page.getByRole('button', { name: /Save changes/i }).click();

    // Should stay on edit page or go back; either way no error
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test('delete product removes it from list', async ({ page }) => {
    test.slow();
    const productName = `Delete Test ${UNIQUE_SUFFIX()}`;

    // Create a product first
    await page.goto('/designer/products/new');
    await page.getByLabel(/^Name/).fill(productName);
    await page.getByLabel(/Price/).fill('19.99');
    const categoryTrigger = page.getByRole('combobox').first();
    await categoryTrigger.click();
    await page.getByRole('option', { name: /Tops/i }).click();
    await page.getByRole('button', { name: /Create product/i }).click();
    await page.waitForURL('/designer/products', { timeout: 10000 });
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });

    // Open the actions dropdown for the product
    const productArticle = page.locator('article').filter({ hasText: productName });
    await productArticle.hover();
    await productArticle.getByRole('button', { name: /Actions for/i }).click();

    // Click Delete
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Confirm in dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Delete' }).last().click();

    // Product should be gone from the list. Assert on the row's edit link: the
    // bare name also appears inside the delete-confirm dialog, which makes a
    // plain text match ambiguous.
    await expect(
      page.getByRole('link', { name: `Edit ${productName}` }),
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('non-designer sees designer area gate', async ({ page }) => {
    // Act as a buyer instead of the designer the suite signs in as.
    await signIn(page, 'shopper');

    await page.goto('/designer/products');
    await expect(page.getByText('Designer area')).toBeVisible({ timeout: 5000 });
  });
});
