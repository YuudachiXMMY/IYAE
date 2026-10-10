import { test, expect, type Page } from '@playwright/test';
import { apiAs, signIn } from './session';

/**
 * The default Discover tab is a SERVER feed, and `feedPosts ?? localPosts` does
 * not fall back on a *successful empty* response — so with no posts on the
 * server `/community` renders its empty state and every interaction test here
 * silently skips. This spec therefore seeds its own post through the API and
 * removes it afterwards, instead of hoping the database happens to hold one.
 *
 * The post is authored by the designer so the shopper sees a post they do not
 * own: `ownedByCurrentUser` gates the Follow button.
 */
interface SeededPost {
  id: number;
  userId: number;
}

let postId: number | null = null;
let authorUserId: number | null = null;
// Unique per run so a leftover fixture from an interrupted run can't be matched
// instead of this one.
const fixtureCaption = `E2E fixture look — layered neutrals ${Date.now()}.`;

test.beforeAll(async () => {
  const post = await apiAs<SeededPost>('designer', 'POST', '/api/posts', {
    content: fixtureCaption,
    mediaUrls: ['/assets/images/community/post-1.svg'],
    topic: 'body-confidence',
    city: 'Toronto',
  });
  postId = post.id;
  authorUserId = post.userId;
});

test.afterAll(async () => {
  if (postId == null) return;
  await apiAs('designer', 'DELETE', `/api/posts/${postId}`).catch(() => {
    /* best effort — a leftover fixture post is harmless */
  });
  postId = null;
});

/** The post this run seeded — never "whatever article is first". */
function fixturePost(page: Page) {
  return page.locator('article').filter({ hasText: fixtureCaption });
}

test.describe('Community feed', () => {
  test.beforeEach(async ({ page }) => {
    // The follow test below leaves a real follow edge behind, which would put
    // the author's post into the Following feed and start the next run's
    // button on "Following". Reset it so every test sees the same state.
    if (authorUserId != null) {
      await apiAs('shopper', 'DELETE', `/api/follows/${authorUserId}`).catch(() => {
        /* not following — nothing to undo */
      });
    }

    await signIn(page, 'shopper');
    await page.goto('/community');
    // The editorial <h1>; the old "IYAE Community" heading is gone.
    await expect(
      page.getByRole('heading', { name: 'Style, in real life.' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('community page renders with tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Following' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discover' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toronto' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Body confidence' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reposted' })).toBeVisible();
  });

  test('discover tab shows the seeded post', async ({ page }) => {
    await expect(fixturePost(page)).toBeVisible({ timeout: 10000 });
  });

  test('tab switching changes active tab state', async ({ page }) => {
    // FilterPill carries aria-pressed, so assert the selection itself rather
    // than a feed's contents: which posts a feed holds depends on follow edges
    // and seeded data, while "this tab is the active one" is the actual subject.
    const following = page.getByRole('button', { name: 'Following' });
    const discover = page.getByRole('button', { name: 'Discover' });

    await expect(discover).toHaveAttribute('aria-pressed', 'true');
    await expect(following).toHaveAttribute('aria-pressed', 'false');

    await following.click();
    await expect(following).toHaveAttribute('aria-pressed', 'true');
    await expect(discover).toHaveAttribute('aria-pressed', 'false');

    const saved = page.getByRole('button', { name: 'Saved' });
    await saved.click();
    await expect(saved).toHaveAttribute('aria-pressed', 'true');
    await expect(following).toHaveAttribute('aria-pressed', 'false');
  });

  test('like button increments the count', async ({ page }) => {
    const firstPost = fixturePost(page);
    await expect(firstPost).toBeVisible({ timeout: 10000 });

    // The count is a bare number inside the Like button — the card has no
    // "N likes" text any more.
    const likeBtn = firstPost.getByLabel('Like');
    await expect(likeBtn).toHaveText(/^0$/);

    await likeBtn.click();
    // Real server write-through: POST /api/posts/{id}/like.
    await expect(likeBtn).toHaveText(/^1$/, { timeout: 10000 });
  });

  test('opening post detail dialog via comment area', async ({ page }) => {
    const firstPost = fixturePost(page);
    await expect(firstPost).toBeVisible({ timeout: 10000 });

    // With no comments the trigger reads "Add a comment...".
    await firstPost.getByText(/add a comment|view all/i).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  test('follow button on a post toggles follow state', async ({ page }) => {
    const firstPost = fixturePost(page);
    await expect(firstPost).toBeVisible({ timeout: 10000 });

    // The creator <aside> rail was removed; Follow now lives in the card and
    // only renders for posts the viewer does not own.
    const followBtn = firstPost.getByRole('button', { name: /^Follow$/ });
    await expect(followBtn).toBeVisible();

    await followBtn.click();
    await expect(
      firstPost.getByRole('button', { name: 'Following' }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('shop this look link targets the outfit generator', async ({ page }) => {
    const firstPost = fixturePost(page);
    await expect(firstPost).toBeVisible({ timeout: 10000 });

    const linkHref = await firstPost
      .getByRole('link', { name: 'Shop This Look' })
      .getAttribute('href');

    // buildOutfitGeneratorHref returns /outfits?… — the mode travels as
    // `source`, while `event` carries the occasion tag.
    expect(linkHref).toContain('/outfits');
    expect(linkHref).toContain('source=shop');
  });
});
