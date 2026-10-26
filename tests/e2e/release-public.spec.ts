import { expect, test } from '@playwright/test';

test('signed-out visitors see login and cannot open financial data', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  await page.goto('/transactions');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test('standalone payment handlers remain disabled', async ({ request }) => {
  for (const endpoint of ['checkout', 'webhook']) {
    const response = await request.post(`/api/payments/${endpoint}`, { data: {} });
    expect(response.status()).toBe(410);
  }
});
