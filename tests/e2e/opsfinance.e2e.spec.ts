import { test, expect } from '@playwright/test';

const E2E_ENVIRONMENT = 'E2E TEST ENVIRONMENT';

async function authenticateWithUat(page: any) {
  const email = process.env.PLAYWRIGHT_UAT_EMAIL;
  const password = process.env.PLAYWRIGHT_UAT_PASSWORD;

  if (!email || !password) {
    throw new Error('PLAYWRIGHT_UAT_EMAIL and PLAYWRIGHT_UAT_PASSWORD must be set for protected-route E2E tests.');
  }

  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 15_000 });
  await expect(page.getByText(/Authenticated user:/)).toBeVisible();
}

test.describe(E2E_ENVIRONMENT, () => {
  test('auth protected route placeholder and landing route render', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OpsFinance' })).toBeVisible();
    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });

  test('business access and settings navigation are available in the mock environment', async ({ page }) => {
    await authenticateWithUat(page);

    await page.goto('/');
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByRole('link', { name: 'Subscription', exact: true }).click();
    await expect(page.getByRole('heading', { name: /OpsFinance current plan/i })).toBeVisible();
  });

  test('money in, money out, transfer, upload, reconciliation, and reports screens load', async ({ page }) => {
    await authenticateWithUat(page);

    await page.goto('/transactions');
    await expect(page.getByText('All Transactions')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Money In', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Money Out', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transfer', exact: true })).toBeVisible();

    await page.goto('/upload');
    await expect(page.getByRole('heading', { name: 'Upload & Convert' })).toBeVisible();
    await expect(page.getByText('Parse & review')).toBeVisible();

    await page.goto('/reconciliation');
    await expect(page.getByRole('heading', { name: 'Bank Reconciliation' })).toBeVisible();

    await page.goto('/reports');
    await expect(page.getByText('General Ledger')).toBeVisible();
  });
});
