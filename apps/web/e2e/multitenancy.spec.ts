import { test, expect } from '@playwright/test';

test.describe('Multi-Tenant Subdomain Routing & Isolation Workflows', () => {

  test('valid school subdomain resolves successfully and loads login page', async ({ page }) => {
    // 1. Visit valid school subdomain saraswati
    await page.goto('http://saraswati.localhost:3002/login');

    // 2. Assert page header or login button is visible
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
  });

  test('invalid school subdomain returns 404 not found page', async ({ page }) => {
    // 1. Visit an unregistered school subdomain
    await page.goto('http://invalidsubdomain.localhost:3002/login');

    // 2. Next.js notFound() renders default 404 page containing 'This page could not be found'
    await expect(page.locator('text=This page could not be found')).toBeVisible({ timeout: 10000 });
  });

});
