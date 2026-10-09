import { test, expect } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

const DESIGNER_EMAIL = SEED_USERS.designer.email;
const DESIGNER_PASSWORD = SEED_PASSWORD;
const UNIQUE_SUFFIX = () => Date.now().toString();

test.describe('Designer product CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DESIGNER_EMAIL);
    await page.getByLabel('Password').fill(DESIGNER_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard', { timeout: 10000 });
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

    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible({
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

    // Click on the product to edit
    await page.getByText(productName).click();
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

    // Product should be gone from list
    await expect(page.getByText(productName)).not.toBeVisible({ timeout: 10000 });
  });

  test('non-designer sees designer area gate', async ({ page }) => {
    // Log in as a buyer instead
    await page.goto('/login');
    await page.getByLabel('Email').fill(SEED_USERS.shopper.email);
    await page.getByLabel('Password').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard', { timeout: 10000 });

    await page.goto('/designer/products');
    await expect(page.getByText('Designer area')).toBeVisible({ timeout: 5000 });
  });
});
