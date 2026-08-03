import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import { E2E_DATA_DIR } from '../playwright.config';

/**
 * Drives the public /coupons page in a real browser. This is the only place the
 * QR canvas rendering and the SPA route are actually exercised — a curl of
 * /coupons proves nothing, since nginx and vite both serve index.html for every
 * path.
 */

const db = new Database(path.join(E2E_DATA_DIR, 'accounts.db'));
const now = () => new Date().toISOString();

function seedCoupon(code: string, credits: number, max: number, windowSeconds: number | null) {
  const r = db.prepare(
    'INSERT INTO coupons (code, value_credits, retired_at, created_at, updated_at) VALUES (?,?,NULL,?,?)'
  ).run(code, credits, now(), now());
  db.prepare(
    `INSERT INTO mint_limits (coupon_id, kind, max_count, window_seconds, created_at) VALUES (?,'cap',?,?,?)`
  ).run(r.lastInsertRowid, max, windowSeconds, now());
  return Number(r.lastInsertRowid);
}

function setGate(name: string, open: boolean) {
  db.prepare('UPDATE gates SET is_open = ? WHERE name = ?').run(open ? 1 : 0, name);
}

test.beforeEach(() => {
  db.exec('DELETE FROM tokens; DELETE FROM mint_limits; DELETE FROM coupons;');
  setGate('coupon', true);
  setGate('redemption', true);
});

test.describe('/coupons', () => {
  test('renders the real route, not the SPA fallback', async ({ page }) => {
    await page.goto('/coupons');
    // A path with no route redirects to "/", which has no such heading.
    await expect(page.getByRole('heading', { name: 'Redeem a coupon' })).toBeVisible();

    await page.goto('/total-nonsense-xyz');
    await expect(page.getByRole('heading', { name: 'Redeem a coupon' })).toHaveCount(0);
  });

  test('/coupon redirects to /coupons', async ({ page }) => {
    await page.goto('/coupon');
    await expect(page).toHaveURL(/\/coupons$/);
  });

  test('mints a token and renders a real QR image', async ({ page }) => {
    seedCoupon('BROWSER', 5, 10, 3600);
    await page.goto('/coupons');

    await page.getByLabel('Coupon code').fill('BROWSER');
    await page.getByRole('button', { name: 'Get token' }).click();

    await expect(page.getByRole('heading', { name: 'Your token' })).toBeVisible();
    await expect(page.getByText('Worth 5 credits')).toBeVisible();

    const token = await page.locator('.coupon-token').innerText();
    expect(token).toMatch(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}-[0-9A-Z]{6}$/);

    // The QR is generated client-side onto a canvas; assert a real data URL with
    // actual pixels rather than just that an <img> exists.
    const qr = page.getByAltText('Token QR code');
    await expect(qr).toBeVisible();
    const src = await qr.getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);
    expect(src!.length).toBeGreaterThan(500);

    // And the token really exists server-side.
    const count = db.prepare(`SELECT COUNT(*) n FROM tokens WHERE source='web'`).get() as any;
    expect(count.n).toBe(1);
  });

  test('uppercases typed input so lowercase codes work', async ({ page }) => {
    seedCoupon('UPPER', 1, 10, null);
    await page.goto('/coupons');

    await page.getByLabel('Coupon code').fill('upper');
    await expect(page.getByLabel('Coupon code')).toHaveValue('UPPER');
    await page.getByRole('button', { name: 'Get token' }).click();
    await expect(page.getByRole('heading', { name: 'Your token' })).toBeVisible();
  });

  test('copies the token to the clipboard', async ({ page }) => {
    seedCoupon('COPY', 1, 10, null);
    await page.goto('/coupons');
    await page.getByLabel('Coupon code').fill('COPY');
    await page.getByRole('button', { name: 'Get token' }).click();

    const token = await page.locator('.coupon-token').innerText();
    await page.getByRole('button', { name: 'Copy token' }).click();

    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(token);
  });

  test('warns that the token is shown only once', async ({ page }) => {
    seedCoupon('ONCE', 1, 10, null);
    await page.goto('/coupons');
    await page.getByLabel('Coupon code').fill('ONCE');
    await page.getByRole('button', { name: 'Get token' }).click();

    await expect(page.getByText(/shown only once/i)).toBeVisible();
  });

  test('shows the same error for an unknown code as for an inert one', async ({ page }) => {
    // Inert: created but with no limit rows.
    db.prepare('INSERT INTO coupons (code, value_credits, retired_at, created_at, updated_at) VALUES (?,?,NULL,?,?)')
      .run('INERT', 5, now(), now());

    await page.goto('/coupons');
    await page.getByLabel('Coupon code').fill('INERT');
    await page.getByRole('button', { name: 'Get token' }).click();
    const inertError = await page.locator('.coupon-error').innerText();

    await page.reload();
    await page.getByLabel('Coupon code').fill('NEVEREXISTED');
    await page.getByRole('button', { name: 'Get token' }).click();
    const unknownError = await page.locator('.coupon-error').innerText();

    expect(inertError).toBe(unknownError);
    expect(inertError).toContain('not valid');
  });

  test('surfaces the limit message when the cap is exhausted', async ({ page }) => {
    seedCoupon('TIGHT', 1, 1, 3600);
    await page.goto('/coupons');

    await page.getByLabel('Coupon code').fill('TIGHT');
    await page.getByRole('button', { name: 'Get token' }).click();
    await expect(page.getByRole('heading', { name: 'Your token' })).toBeVisible();

    await page.getByRole('button', { name: 'Use another code' }).click();
    await page.getByLabel('Coupon code').fill('TIGHT');
    await page.getByRole('button', { name: 'Get token' }).click();

    await expect(page.locator('.coupon-error')).toContainText('reached its limit');
  });

  test('shows a closed banner and disables minting when the gate is shut', async ({ page }) => {
    seedCoupon('GATED', 1, 10, null);
    setGate('coupon', false);
    await page.goto('/coupons');

    await expect(page.getByText(/minting is closed/i)).toBeVisible();
    await expect(page.getByLabel('Coupon code')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Get token' })).toBeDisabled();
  });

  test('lets you mint again with another code', async ({ page }) => {
    seedCoupon('FIRST', 1, 10, null);
    seedCoupon('SECOND', 9, 10, null);
    await page.goto('/coupons');

    await page.getByLabel('Coupon code').fill('FIRST');
    await page.getByRole('button', { name: 'Get token' }).click();
    await expect(page.getByText('Worth 1 credit')).toBeVisible();

    await page.getByRole('button', { name: 'Use another code' }).click();
    await page.getByLabel('Coupon code').fill('SECOND');
    await page.getByRole('button', { name: 'Get token' }).click();
    await expect(page.getByText('Worth 9 credits')).toBeVisible();
  });
});
