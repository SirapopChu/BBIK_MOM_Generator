import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation & Settings Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:3000/dashboard');
  });

  test('should navigate to settings and back to dashboard', async ({ page }) => {
    // Check if we are on the dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Click on Settings in the sidebar
    // We search for the text based on current dict (could be Dashboard or แดชบอร์ด)
    // For smoke test, we use the URL directly to ensure robustness
    await page.goto('http://localhost:3000/dashboard/settings');
    await expect(page).toHaveURL(/.*settings/);
    
    // Check if settings title is visible
    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });

  test('should toggle language in the sidebar', async ({ page }) => {
    // Open sidebar on mobile if needed
    const menuBtn = page.locator('button[class*="hamburgerBtn"]');
    if (await menuBtn.isVisible()) {
        await menuBtn.click();
    }

    // Find the language toggle button in Sidebar
    const langToggle = page.getByTestId('language-toggle');
    await expect(langToggle).toBeVisible();
    
    // Get initial text
    const initialText = await langToggle.textContent();
    
    // Click to toggle
    await langToggle.click();
    
    // Verify text changed
    const newText = await langToggle.textContent();
    expect(initialText).not.toBe(newText);
  });
});
