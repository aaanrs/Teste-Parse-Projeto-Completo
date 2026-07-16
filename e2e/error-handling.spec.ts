import { test, expect, Page, Route } from '@playwright/test';
import { API_MODE } from './helpers/config';

test.beforeEach(({ }, testInfo) => {
  testInfo.skip(!API_MODE, 'API-only: all tests use page.route() API mocking');
});

const API_BASE = 'https://api.realworld.show/api';

/**
 * Helper to mock an API endpoint with a specific error response
 */
async function mockApiError(page: Page, endpoint: string, status: number, errorBody: object = {}, method?: string) {
  await page.route(`${API_BASE}${endpoint}`, async (route: Route) => {
    if (method && route.request().method() !== method) {
      return await route.continue();
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(errorBody),
    });
  });
}

/**
 * Helper to set a fake JWT token to simulate authenticated state
 */
async function setFakeAuthToken(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('jwtToken', 'fake-token-for-testing');
  });
}

test.describe('Error Handling - 400 Bad Request', () => {
  test('should handle 400 on login with validation errors', async ({ page }) => {
    await mockApiError(page, '/users/login', 400, {
      errors: { 'email or password': ['is invalid'] },
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    // Should show error messages, not crash
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should handle 400 on registration with validation errors', async ({ page }) => {
    await mockApiError(page, '/users', 400, {
      errors: {
        email: ['is already taken'],
        username: ['is too short (minimum is 3 characters)'],
      },
    });
    await page.goto('/register');
    await page.fill('input[name="username"]', 'ab');
    await page.fill('input[name="email"]', 'taken@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/register');
  });
});

test.describe('Error Handling - 401 Unauthorized', () => {
  test('should handle 401 on accessing protected resource', async ({ page }) => {
    await mockApiError(page, '/user', 401, { errors: { message: ['Unauthorized'] } });
    await page.goto('/settings');
    await expect(page).toHaveURL('/login');
  });

  test('should handle 401 on article creation', async ({ page }) => {
    await setFakeAuthToken(page);
    await mockApiError(page, '/articles', 401, { errors: { message: ['Unauthorized'] } }, 'POST');
    await page.goto('/editor');
    await page.fill('input[name="title"]', 'Test Article');
    await page.fill('input[name="description"]', 'Test Description');
    await page.fill('textarea[name="body"]', 'Test Body');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Error Handling - 403 Forbidden', () => {
  test('should handle 403 on editing another users article', async ({ page }) => {
    await setFakeAuthToken(page);
    await mockApiError(page, '/articles/some-slug', 403, { errors: { message: ['Forbidden'] } }, 'PUT');
    await page.goto('/editor/some-slug');
    await page.fill('input[name="title"]', 'Updated Title');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-messages')).toBeVisible();
  });
});

test.describe('Error Handling - 404 Not Found', () => {
  test('should handle 404 on article not found', async ({ page }) => {
    await mockApiError(page, '/articles/nonexistent-article', 404, { errors: { message: ['Not Found'] } });
    await page.goto('/article/nonexistent-article');
    await expect(page.locator('text=Not Found')).toBeVisible();
  });

  test('should handle 404 on profile not found', async ({ page }) => {
    await mockApiError(page, '/profiles/nonexistent-user', 404, { errors: { message: ['Not Found'] } });
    await page.goto('/profile/nonexistent-user');
    await expect(page.locator('text=Not Found')).toBeVisible();
  });
});

test.describe('Error Handling - 422 Unprocessable Entity', () => {
  test('should handle 422 on article creation with missing fields', async ({ page }) => {
    await setFakeAuthToken(page);
    await mockApiError(page, '/articles', 422, {
      errors: { title: ["can't be blank"], body: ["can't be blank"] },
    }, 'POST');
    await page.goto('/editor');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/editor');
  });
});

test.describe('Error Handling - 500 Internal Server Error', () => {
  test('should handle 500 on login', async ({ page }) => {
    await mockApiError(page, '/users/login', 500, { errors: { message: ['Internal Server Error'] } });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('should handle 500 on article list', async ({ page }) => {
    await mockApiError(page, '/articles', 500, { errors: { message: ['Internal Server Error'] } });
    await page.goto('/');
    await expect(page.locator('text=Internal Server Error')).toBeVisible();
  });
});