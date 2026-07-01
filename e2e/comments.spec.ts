import { test, expect } from '@playwright/test';
import { register, generateUniqueUser } from './helpers/auth';
import { createArticle, generateUniqueArticle } from './helpers/articles';
import { addComment, deleteComment, getCommentCount } from './helpers/comments';
import { API_MODE } from './helpers/config';

test.describe.configure({ mode: 'serial' });

test.describe('Comments', () => {
  // Force each test to use a fresh browser context
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    // Register and login, then create an article
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    const article = generateUniqueArticle();
    await createArticle(page, article);
  });

  test.afterEach(async ({ context }) => {
    // Close the browser context to ensure complete isolation between tests.
    // This releases browser instances, network connections, and other resources.
    await context.close();
  });

  test('should add a comment to an article', async ({ page }) => {
    const commentText = 'This is a test comment from Playwright!';
    await addComment(page, commentText);
    // Comment should be visible
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).toBeVisible();
  });

  test('should delete own comment', async ({ page }) => {
    const commentText = 'Comment to be deleted';
    await addComment(page, commentText);
    // Comment should be visible
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).toBeVisible();