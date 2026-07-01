import { test, expect } from '@playwright/test';
import { register, generateUniqueUser } from './helpers/auth';
import {
  createArticle,
  editArticle,
  deleteArticle,
  favoriteArticle,
  unfavoriteArticle,
  generateUniqueArticle,
} from './helpers/articles';
import { API_MODE } from './helpers/config';

test.describe.configure({ mode: 'serial' });

test.describe('Articles', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login before each test
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
  });

  test.afterEach(async ({ context }) => {
    // Close the browser context to ensure complete isolation between tests.
    // This releases browser instances, network connections, and other resources.
    await context.close();
  });

  test('should create a new article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Should be on article page
    await expect(page).toHaveURL(/\/article\/.+/);

    // Should show article content
    await expect(page.locator('h1')).toHaveText(article.title);
    await expect(page.locator('.article-content p')).toContainText(article.body);

    // Should show tags
    for (const tag of article.tags || []) {
      await expect(page.locator(`.tag-list .tag-default:has-text("${tag}")`)).toBeVisible();
    }
  });

  test('should edit an existing article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Get the article slug from URL
    const url = page.url();
    const slug = url.split('/article/')[1];

    const updatedArticle = generateUniqueArticle();
    await editArticle(page, slug, updatedArticle);

    // Should be on updated article page
    await expect(page).toHaveURL(/\/article\/.+/);

    // Should show updated content
    await expect(page.locator('h1')).toHaveText(updatedArticle.title);
    await expect(page.locator('.article-content p')).toContainText(updatedArticle.body);
  });

  test('should delete an existing article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Get the article slug from URL
    const url = page.url();
    const slug = url.split('/article/')[1];

    await deleteArticle(page, slug);

    // Should be redirected away from the article page
    await expect(page).not.toHaveURL(/\/article\/.+/);
  });

  test('should favorite an article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    const url = page.url();
    const slug = url.split('/article/')[1];

    await favoriteArticle(page, slug);

    // Should show favorited state
    const favoriteButton = page.locator('.article-meta button.btn-primary');
    await expect(favoriteButton).toBeVisible();
  });

  test('should unfavorite an article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    const url = page.url();
    const slug = url.split('/article/')[1];

    await favoriteArticle(page, slug);
    await unfavoriteArticle(page, slug);

    // Should show unfavorited state
    const unfavoriteButton = page.locator('.article-meta button.btn-outline-primary');
    await expect(unfavoriteButton).toBeVisible();
  });

  if (API_MODE) {
    test('should list articles', async ({ page }) => {
      const article = generateUniqueArticle();

      await createArticle(page, article);

      await page.goto('/');

      // Should show the created article in the feed
      await expect(page.locator(`.article-preview:has-text("${article.title}")`)).toBeVisible();
    });
  }
});