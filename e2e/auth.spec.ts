import { test, expect } from '@playwright/test';
import { register, login, logout, generateUniqueUser } from './helpers/auth';
import { getToken, getAuthState } from './helpers/debug';
import { API_MODE } from './helpers/config';

test.describe('Authentication', () => {
  test('should register a new user', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    // Should be redirected to home page
    await expect(page).toHaveURL('/');
    // Should see username in header
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
    // Should be able to access editor
    await page.click('a[href="/editor"]');
    await expect(page).toHaveURL('/editor');
  });

  test('should login with existing user', async ({ page }) => {
    const user = generateUniqueUser();
    // First register a user
    await register(page, user.username, user.email, user.password);
    // Logout
    await logout(page);
    // Should see Sign in link
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    // Login again
    await login(page, user.email, user.password);
    // Should be logged in
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show error message
    await expect(page.locator('.error-messages')).toBeVisible();
  });

  test('should fail login with wrong password', async ({ page }) => {
    const user = generateUniqueUser();
    // First register a user with correct credentials
    await register(page, user.username, user.email, user.password);
    // Logout
    await logout(page);
    // Try to login with correct email but wrong password
    await page.goto('/login');
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', 'wrong-password-that-does-not-match');
    await page.click('button[type="submit"]');
    // Should show generic error message without leaking details
    await expect(page.locator('.error-messages')).toBeVisible();
    // Should remain on login page
    await expect(page).toHaveURL('/login');
  });

  test('should handle invalid token on page reload gracefully', async ({ page }) => {
    const user = generateUniqueUser();
    // Register and log in so a valid token is stored
    await register(page, user.username, user.email, user.password);
    await expect(page).toHaveURL('/');

    // Corrupt the stored token to simulate an invalid/expired token scenario
    await page.evaluate(() => {
      const invalidToken = 'invalid.token.value';
      localStorage.setItem('jwtToken', invalidToken);
    });

    // Reload the page with the corrupted token
    await page.reload();

    // The app should redirect to login instead of showing a blank screen
    await expect(page).toHaveURL('/login');

    // The page should render the login form, not a blank screen
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // No sensitive token data should be visible in the DOM
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('invalid.token.value');
  });
});