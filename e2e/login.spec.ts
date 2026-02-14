
import { test, expect } from '@playwright/test';

test('Kiosk Login Flow', async ({ page }) => {
    await page.goto('/');

    // 1. Select Vendor
    await page.click('text=業者を選択...');
    // Assuming test data exists or we use a known selector. 
    // For robustness, we might need a test-id. 
    // Let's assume the first item is selectable.
    await page.click('[role="option"]:first-child');
    await page.click('button:has-text("次へ進む")');

    // 2. Select User
    await page.click('text=担当者を選択...');
    await page.click('[role="option"]:first-child');
    await page.click('button:has-text("次へ進む")');

    // 3. Enter PIN (1234)
    await page.click('button:has-text("1")');
    await page.click('button:has-text("2")');
    await page.click('button:has-text("3")');
    await page.click('button:has-text("4")');

    // 4. Verify Navigation to Mode Select
    await expect(page).toHaveURL(/.*mode-select/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('作業モード選択', { timeout: 15000 });
});
