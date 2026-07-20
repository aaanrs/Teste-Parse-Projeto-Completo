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
    // Should show error messages, not crash
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/register');
  });

  test('should handle 400 on article creation', async ({ page }) => {
    await page.goto('/');
    await setFakeAuthToken(page);

    await mockApiError(page, '/user', 200, {
      user: {
        email: 'test@test.com',
        username: 'testuser',
        bio: '',
        image: '',
        token: 'fake-token-for-testing',
      },
    });
    await mockApiError(page, '/articles', 400, {
      errors: { title: ['is too short'] },
    }, 'POST');

    await page.goto('/editor');
    await page.fill('input[name="title"]', 'ab');
    await page.fill('input[name="description"]', 'Some description');
    await page.fill('textarea[name="body"]', 'Some body content');
    await page.click('button[type="submit"]');
    // Should show error messages, not crash
    await expect(page.locator('.error-messages')).toBeVisible();
  });
});

test.describe('Error Handling - 401 Unauthorized', () => {
  test('401 login attempt', async ({ page }) => {
    await mockApiError(page, '/users/login', 401, {
      errors: { 'email or password': ['is invalid'] },
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show error messages and remain on login page
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('401 settings form', async ({ page }) => {
    await page.goto('/');
    await setFakeAuthToken(page);

    // Mock GET /user to return a valid authenticated user so the settings form renders
    await page.route(`${API_BASE}/user`, async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              email: 'test@test.com',
              username: 'testuser',
              bio: 'A short bio',
              image: 'https://example.com/avatar.jpg',
              token: 'fake-token-for-testing',
            },
          }),
        });
        return;
      }
      // Mock PUT /user to return 401 Unauthorized
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: { message: ['Unauthorized'] },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/settings');

    // Fill in the settings form
    await page.fill('input[name="username"]', 'updateduser');
    await page.fill('input[name="email"]', 'updated@test.com');
    await page.fill('textarea[name="bio"]', 'Updated bio');
    await page.click('button[type="submit"]');

    // Should show error messages when the server responds with 401
    await expect(page.locator('.error-messages')).toBeVisible();
  });
});

test.describe('Error Handling - 404 Not Found', () => {
  test('should handle 404 on article page', async ({ page }) => {
    await mockApiError(page, '/articles/nonexistent-slug-xyz', 404, {
      errors: { article: ['not found'] },
    });
    await page.goto('/article/nonexistent-slug-xyz');
    // Should not show a blank white page; either redirect or show a message
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('should handle 404 on profile page', async ({ page }) => {
    await mockApiError(page, '/profiles/ghost-user-xyz', 404, {
      errors: { profile: ['not found'] },
    });
    await page.goto('/profile/ghost-user-xyz');
    // Should not show a blank white page
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});

test.describe('Error Handling - 422 Unprocessable Entity', () => {
  test('should handle 422 on registration', async ({ page }) => {
    await mockApiError(page, '/users', 422, {
      errors: {
        email: ['is invalid'],
        password: ['is too short (minimum is 8 characters)'],
      },
    });
    await page.goto('/register');
    await page.fill('input[name="username"]', 'validuser');
    await page.fill('input[name="email"]', 'not-an-email');
    await page.fill('input[name="password"]', 'short');
    await page.click('button[type="submit"]');
    // Should show error messages, not crash
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/register');
  });

  test('should handle 422 on article creation', async ({ page }) => {
    await page.goto('/');
    await setFakeAuthToken(page);

    await mockApiError(page, '/user', 200, {
      user: {
        email: 'test@test.com',
        username: 'testuser',
        bio: '',
        image: '',
        token: 'fake-token-for-testing',
      },
    });
    await mockApiError(page, '/articles', 422, {
      errors: { body: ['is required'] },
    }, 'POST');

    await page.goto('/editor');
    await page.fill('input[name="title"]', 'A Valid Title');
    await page.fill('input[name="description"]', 'A valid description');
    await page.click('button[type="submit"]');
    // Should show error messages, not crash
    await expect(page.locator('.error-messages')).toBeVisible();
  });
});

test.describe('Error Handling - 500 Server Error', () => {
  test('should handle 500 on login', async ({ page }) => {
    await mockApiError(page, '/users/login', 500, {
      errors: { server: ['internal error'] },
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    // Should not navigate away and should not show a blank page
    await expect(page).toHaveURL('/login');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('should handle 500 on article list', async ({ page }) => {
    await mockApiError(page, '/articles', 500, {
      errors: { server: ['internal error'] },
    });
    await page.goto('/');
    // Should not show a blank white page
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});