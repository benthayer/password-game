import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// storage/db.ts opens its database at module load from DATA_DIR, so the env var
// has to be set before it is ever imported. Hence the dynamic imports below —
// static ones would be hoisted above this line and open ./data for real.
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-coupon-test-'));
process.env.DATA_DIR = TEST_DATA_DIR;

let svc: typeof import('./coupon-service.js');
let store: typeof import('../storage/db.js');

const ADDRESS = 'a'.repeat(64);
const OTHER_ADDRESS = 'b'.repeat(64);

beforeAll(async () => {
  svc = await import('./coupon-service.js');
  store = await import('../storage/db.js');
});

beforeEach(() => {
  store.db.exec('DELETE FROM tokens; DELETE FROM mint_limits; DELETE FROM coupons; DELETE FROM accounts;');
  svc.setGate('coupon', true);
  svc.setGate('redemption', true);
});

/** Coupon that is actually mintable: created, then given a cap. */
function liveCoupon(code: string, credits: number, max = 100, window: number | null = null) {
  const { coupon } = svc.addCoupon(code, credits);
  svc.addCap(coupon.id, max, window);
  return coupon;
}

function backdateToken(tokenId: number, secondsAgo: number) {
  store.db.prepare('UPDATE tokens SET minted_at = ? WHERE id = ?')
    .run(new Date(Date.now() - secondsAgo * 1000).toISOString(), tokenId);
}

// =============================================================================

describe('redeeming', () => {
  it('grants exactly the token value and marks it used', async () => {
    liveCoupon('WELCOME', 5);
    const minted = svc.mintFromCoupon('WELCOME');

    const result = await svc.redeemToken(minted.token, ADDRESS);

    expect(result.credits).toBe(5);
    // 5 credits = 5 GB-years + 250 GB egress at the current rate.
    expect(result.gbYearsRemaining).toBe(5);
    expect(result.egressGbRemaining).toBe(250);
  });

  it('refuses a second redeem and grants nothing extra', async () => {
    liveCoupon('ONCE', 3);
    const minted = svc.mintFromCoupon('ONCE');
    await svc.redeemToken(minted.token, ADDRESS);

    await expect(svc.redeemToken(minted.token, OTHER_ADDRESS)).rejects.toMatchObject({
      code: 'token_already_used',
    });

    // The second address must not have been credited at all.
    expect(await store.getAccount(OTHER_ADDRESS)).toBeNull();
    const account = await store.getAccount(ADDRESS);
    expect(account!.gbYearsRemaining).toBe(3);
  });

  it('accepts a token regardless of case, spacing or hyphens', async () => {
    liveCoupon('FORMAT', 1);
    const minted = svc.mintFromCoupon('FORMAT');
    const mangled = minted.token.toLowerCase().replace(/-/g, ' ');

    await expect(svc.redeemToken(mangled, ADDRESS)).resolves.toMatchObject({ credits: 1 });
  });

  it('refuses a revoked token', async () => {
    liveCoupon('KILLED', 2);
    const minted = svc.mintFromCoupon('KILLED');
    svc.revokeTokens(String(minted.tokenId));

    await expect(svc.redeemToken(minted.token, ADDRESS)).rejects.toMatchObject({
      code: 'token_revoked',
    });
  });

  it('refuses an unknown token', async () => {
    await expect(svc.redeemToken('PG-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZZ', ADDRESS))
      .rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('is blocked by the redemption gate but minting still works', async () => {
    liveCoupon('GATED', 1);
    const minted = svc.mintFromCoupon('GATED');
    svc.setGate('redemption', false);

    await expect(svc.redeemToken(minted.token, ADDRESS)).rejects.toMatchObject({
      code: 'redemption_gate_closed',
    });
    expect(() => svc.mintFromCoupon('GATED')).not.toThrow();
  });

  it('leaves already-redeemed tokens alone when revoking', async () => {
    liveCoupon('SPENT', 4);
    const minted = svc.mintFromCoupon('SPENT');
    await svc.redeemToken(minted.token, ADDRESS);

    const { revoked } = svc.revokeTokens('all');
    expect(revoked).toBe(0);
    const account = await store.getAccount(ADDRESS);
    expect(account!.gbYearsRemaining).toBe(4);
  });
});

describe('a coupon with no limits is unusable', () => {
  it('refuses to mint and reports the same error as an unknown code', () => {
    svc.addCoupon('INERT', 5); // no cap set

    let inertError: any;
    let unknownError: any;
    try { svc.mintFromCoupon('INERT'); } catch (e) { inertError = e; }
    try { svc.mintFromCoupon('NEVEREXISTED'); } catch (e) { unknownError = e; }

    expect(inertError.code).toBe('invalid_code');
    // Identical code AND message, or the endpoint becomes an oracle for which
    // codes exist.
    expect(inertError.code).toBe(unknownError.code);
    expect(inertError.message).toBe(unknownError.message);
  });

  it('becomes usable once a cap is added', () => {
    const { coupon } = svc.addCoupon('LATER', 2);
    expect(() => svc.mintFromCoupon('LATER')).toThrow();

    svc.addCap(coupon.id, 5, null);
    expect(svc.mintFromCoupon('LATER').credits).toBe(2);
  });

  it('is usable with only an inherit_global row, which contributes no caps', () => {
    const { coupon } = svc.addCoupon('INHERIT', 7);
    svc.setCouponGlobal(coupon.id);

    const limits = svc.listLimits(coupon.id);
    expect(limits).toHaveLength(1);
    expect(limits[0].kind).toBe('inherit_global');
    expect(limits.filter(l => l.kind === 'cap')).toHaveLength(0);

    // No global caps exist, so nothing bounds it.
    expect(svc.mintFromCoupon('INHERIT').credits).toBe(7);
  });

  it('goes back to unusable when its last rule is removed', () => {
    const { coupon } = svc.addCoupon('TEMP', 1);
    const cap = svc.addCap(coupon.id, 5, null);
    expect(svc.mintFromCoupon('TEMP').credits).toBe(1);

    const { nowInert } = svc.removeLimit(coupon.id, cap.id);
    expect(nowInert).toBe(true);
    expect(() => svc.mintFromCoupon('TEMP')).toThrow(expect.objectContaining({ code: 'invalid_code' }));
  });

  it('switching to global clears own rules and reports the count', () => {
    const { coupon } = svc.addCoupon('SWITCH', 1);
    svc.addCap(coupon.id, 5, null);
    svc.addCap(coupon.id, 2, 3600);

    const { removed } = svc.setCouponGlobal(coupon.id);
    expect(removed).toBe(2);
    expect(svc.listLimits(coupon.id).map(l => l.kind)).toEqual(['inherit_global']);
  });
});

describe('caps are conjunctive', () => {
  it('enforces the global cap even when the coupon cap has headroom', () => {
    svc.addCap(null, 1, 3600);         // global: 1/hour
    liveCoupon('LOOSE', 1, 99, 3600);  // coupon: 99/hour

    expect(svc.mintFromCoupon('LOOSE').credits).toBe(1);
    expect(() => svc.mintFromCoupon('LOOSE')).toThrow(expect.objectContaining({ code: 'limit_exceeded' }));
  });

  it('enforces the coupon cap even when the global cap has headroom', () => {
    svc.addCap(null, 99, 3600);
    liveCoupon('TIGHT', 1, 1, 3600);

    expect(svc.mintFromCoupon('TIGHT').credits).toBe(1);
    expect(() => svc.mintFromCoupon('TIGHT')).toThrow(expect.objectContaining({ code: 'limit_exceeded' }));
  });

  it('enforces two caps in the same scope independently', () => {
    // The case a naive "check global then check coupon" implementation gets
    // wrong: both of these are global, and exhausting either must block.
    svc.addCap(null, 2, 3600);    // 2/hour
    svc.addCap(null, 50, 86400);  // 50/day
    liveCoupon('SAME', 1);

    svc.mintFromCoupon('SAME');
    svc.mintFromCoupon('SAME');
    expect(() => svc.mintFromCoupon('SAME')).toThrow(expect.objectContaining({ code: 'limit_exceeded' }));
  });

  it('lets a mint through once the window slides past old mints', () => {
    svc.addCap(null, 1, 3600);
    liveCoupon('SLIDE', 1);

    const first = svc.mintFromCoupon('SLIDE');
    expect(() => svc.mintFromCoupon('SLIDE')).toThrow();

    backdateToken(first.tokenId, 3601);
    expect(svc.mintFromCoupon('SLIDE').credits).toBe(1);
  });

  it('is blocked by the coupon gate regardless of caps', () => {
    liveCoupon('CLOSED', 1);
    svc.setGate('coupon', false);
    expect(() => svc.mintFromCoupon('CLOSED')).toThrow(expect.objectContaining({ code: 'coupon_gate_closed' }));
  });
});

describe('admin mint is god mode', () => {
  it('works while every cap is exhausted', () => {
    svc.addCap(null, 1, 3600);
    liveCoupon('DRAINED', 1);
    svc.mintFromCoupon('DRAINED');
    expect(() => svc.mintFromCoupon('DRAINED')).toThrow();

    expect(svc.mintManual(10).credits).toBe(10);
  });

  it('does not consume the public budget', () => {
    svc.addCap(null, 1, 3600);
    liveCoupon('BUDGET', 1);

    svc.mintManual(5);
    svc.mintManual(5);

    // Admin mints are excluded from counts, so the single web slot is untouched.
    const status = svc.limitStatus();
    const globalRow = status.rows.find(r => r.scope === 'GLOBAL')!;
    expect(globalRow.used).toBe(0);
    expect(svc.mintFromCoupon('BUDGET').credits).toBe(1);
  });

  it('ignores the coupon gate', () => {
    svc.setGate('coupon', false);
    expect(svc.mintManual(1).credits).toBe(1);
  });
});

describe('limit status agrees with enforcement', () => {
  it('reports zero remaining exactly when the next mint is refused', () => {
    svc.addCap(null, 2, 3600);
    liveCoupon('BOUNDARY', 1);

    svc.mintFromCoupon('BOUNDARY');
    let row = svc.limitStatus().rows.find(r => r.scope === 'GLOBAL')!;
    expect(row.used).toBe(1);
    expect(row.remaining).toBe(1);

    svc.mintFromCoupon('BOUNDARY');
    row = svc.limitStatus().rows.find(r => r.scope === 'GLOBAL')!;
    expect(row.used).toBe(2);
    expect(row.remaining).toBe(0);

    expect(() => svc.mintFromCoupon('BOUNDARY')).toThrow(expect.objectContaining({ code: 'limit_exceeded' }));
  });

  it('reports freesAt as the oldest counted mint plus the window', () => {
    svc.addCap(null, 1, 3600);
    liveCoupon('FREES', 1);
    const minted = svc.mintFromCoupon('FREES');
    backdateToken(minted.tokenId, 600);

    const row = svc.limitStatus().rows.find(r => r.scope === 'GLOBAL')!;
    const mintedAt = (store.db.prepare('SELECT minted_at FROM tokens WHERE id = ?').get(minted.tokenId) as any).minted_at;
    expect(row.freesAt).toBe(new Date(new Date(mintedAt).getTime() + 3600 * 1000).toISOString());
  });

  it('gives an all-time cap no freesAt, since capacity never returns', () => {
    svc.addCap(null, 1, null);
    liveCoupon('FOREVER', 1);
    svc.mintFromCoupon('FOREVER');

    const row = svc.limitStatus().rows.find(r => r.scope === 'GLOBAL')!;
    expect(row.remaining).toBe(0);
    expect(row.freesAt).toBeNull();
  });

  it('lists inert coupons separately from rule rows', () => {
    svc.addCoupon('NOLIMITS', 1);
    liveCoupon('HASLIMITS', 1);

    const status = svc.limitStatus();
    expect(status.inertCoupons).toContain('NOLIMITS');
    expect(status.inertCoupons).not.toContain('HASLIMITS');
  });
});

describe('scoped rule removal', () => {
  it('refuses an id belonging to another scope', () => {
    const globalCap = svc.addCap(null, 5, null);
    const { coupon } = svc.addCoupon('SCOPED', 1);
    svc.addCap(coupon.id, 5, null);

    expect(() => svc.removeLimit(coupon.id, globalCap.id)).toThrow(/global scope/);
    // And the global rule is still there.
    expect(svc.listLimits(null).map(l => l.id)).toContain(globalCap.id);
  });
});

describe('code reuse', () => {
  it('gives a recreated code a new id and fresh counters', () => {
    const first = liveCoupon('REUSE', 5, 1, null); // 1 mint, all-time
    svc.mintFromCoupon('REUSE');
    expect(() => svc.mintFromCoupon('REUSE')).toThrow(expect.objectContaining({ code: 'limit_exceeded' }));

    svc.retireCoupon('REUSE');
    const { coupon: second } = svc.addCoupon('REUSE', 5);
    svc.addCap(second.id, 1, null);

    expect(second.id).not.toBe(first.id);
    // Counts are keyed on coupon_id, so the retired coupon's mint doesn't carry
    // over — this is the whole point of the surrogate key.
    expect(svc.mintFromCoupon('REUSE').credits).toBe(5);
  });

  it('keeps tokens from a retired coupon redeemable', async () => {
    liveCoupon('OLD', 6);
    const minted = svc.mintFromCoupon('OLD');
    svc.retireCoupon('OLD');

    await expect(svc.redeemToken(minted.token, ADDRESS)).resolves.toMatchObject({ credits: 6 });
  });

  it('makes a retired code unresolvable and unmintable', () => {
    liveCoupon('GONE', 1);
    svc.retireCoupon('GONE');

    expect(svc.resolveLiveCoupon('GONE')).toBeNull();
    expect(() => svc.mintFromCoupon('GONE')).toThrow(expect.objectContaining({ code: 'invalid_code' }));
  });

  it('reports retired coupons as separate rows in stats, not merged', () => {
    liveCoupon('TWICE', 1);
    svc.mintFromCoupon('TWICE');
    svc.retireCoupon('TWICE');
    const second = liveCoupon('TWICE', 9);
    svc.mintFromCoupon('TWICE');

    const rows = svc.couponStats(svc.parseStatsRange([])).filter(r => r.code === 'TWICE');
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.retired)).toHaveLength(1);
    expect(rows.find(r => r.couponId === second.id)!.minted).toBe(1);
  });

  it('allows one live coupon per code but any number of retired ones', () => {
    liveCoupon('UNIQ', 1);
    svc.retireCoupon('UNIQ');
    liveCoupon('UNIQ', 1);
    svc.retireCoupon('UNIQ');
    liveCoupon('UNIQ', 1);

    const all = store.db.prepare('SELECT retired_at FROM coupons WHERE code = ?').all('UNIQ') as any[];
    expect(all).toHaveLength(3);
    expect(all.filter(r => r.retired_at === null)).toHaveLength(1);

    // The partial unique index must reject a second *live* row for the code.
    expect(() =>
      store.db.prepare(`
        INSERT INTO coupons (code, value_credits, retired_at, created_at, updated_at)
        VALUES ('UNIQ', 1, NULL, '2026-01-01', '2026-01-01')
      `).run()
    ).toThrow(/UNIQUE/i);
  });
});

describe('repricing', () => {
  it('does not change the value of tokens already minted', async () => {
    liveCoupon('REPRICE', 2);
    const cheap = svc.mintFromCoupon('REPRICE');

    svc.addCoupon('REPRICE', 20); // reprice the live coupon
    const dear = svc.mintFromCoupon('REPRICE');

    expect((await svc.redeemToken(cheap.token, ADDRESS)).credits).toBe(2);
    expect((await svc.redeemToken(dear.token, OTHER_ADDRESS)).credits).toBe(20);
  });
});

describe('duration parsing', () => {
  it('reads the supported suffixes', () => {
    expect(svc.parseDuration('30s')).toBe(30);
    expect(svc.parseDuration('5m')).toBe(300);
    expect(svc.parseDuration('2h')).toBe(7200);
    expect(svc.parseDuration('7d')).toBe(604800);
    expect(svc.parseDuration('1w')).toBe(604800);
  });

  it('rejects anything else', () => {
    expect(svc.parseDuration('1:34pm')).toBeNull();
    expect(svc.parseDuration('soon')).toBeNull();
    expect(svc.parseDuration('5')).toBeNull();
  });
});

describe('stats range parsing', () => {
  const asDate = (iso: string | null) => new Date(iso!);

  it('treats no arguments as all time', () => {
    expect(svc.parseStatsRange([])).toMatchObject({ from: null, to: null, label: 'all time' });
  });

  it('reads a single duration as "since then"', () => {
    const range = svc.parseStatsRange(['5m']);
    expect(range.to).toBeNull();
    expect(Date.now() - asDate(range.from).getTime()).toBeGreaterThanOrEqual(299_000);
    expect(Date.now() - asDate(range.from).getTime()).toBeLessThan(310_000);
    expect(range.label).toBe('last 5m');
  });

  it('reads two durations as a window between them', () => {
    const range = svc.parseStatsRange(['2h', '5m']);
    const from = asDate(range.from);
    const to = asDate(range.to);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
    expect(Date.now() - from.getTime()).toBeGreaterThan(7_100_000);
    expect(Date.now() - to.getTime()).toBeLessThan(310_000);
  });

  it('accepts the bounds in either order', () => {
    const a = svc.parseStatsRange(['2h', '5m']);
    const b = svc.parseStatsRange(['5m', '2h']);
    // Within a second — the two calls resolve "now" independently.
    expect(Math.abs(asDate(a.from).getTime() - asDate(b.from).getTime())).toBeLessThan(1000);
    expect(Math.abs(asDate(a.to!).getTime() - asDate(b.to!).getTime())).toBeLessThan(1000);
  });

  it('reads a 12-hour clock time as the most recent occurrence', () => {
    const range = svc.parseStatsRange(['1:34pm']);
    const from = asDate(range.from);
    expect(from.getHours()).toBe(13);
    expect(from.getMinutes()).toBe(34);
    expect(from.getSeconds()).toBe(0);
    // Never in the future.
    expect(from.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('backdates a clock time that has not happened yet today', () => {
    const now = new Date();
    // A time one hour ahead of now must resolve to yesterday.
    const ahead = new Date(now.getTime() + 3600_000);
    const token = `${String(ahead.getHours()).padStart(2, '0')}:${String(ahead.getMinutes()).padStart(2, '0')}`;
    const from = asDate(svc.parseStatsRange([token]).from);

    expect(from.getTime()).toBeLessThan(now.getTime());
    expect(from.getDate()).toBe(new Date(now.getTime() - 86400_000).getDate());
  });

  it('reads bare am/pm hours and 24-hour times', () => {
    expect(asDate(svc.parseStatsRange(['9am']).from).getHours()).toBe(9);
    expect(asDate(svc.parseStatsRange(['12am']).from).getHours()).toBe(0);
    expect(asDate(svc.parseStatsRange(['12pm']).from).getHours()).toBe(12);
    expect(asDate(svc.parseStatsRange(['00:30']).from).getHours()).toBe(0);
  });

  it('reads ISO and slash dates as start of that day', () => {
    const iso = asDate(svc.parseStatsRange(['2026-08-01']).from);
    expect([iso.getFullYear(), iso.getMonth(), iso.getDate()]).toEqual([2026, 7, 1]);
    expect([iso.getHours(), iso.getMinutes()]).toEqual([0, 0]);

    const slash = asDate(svc.parseStatsRange(['8/1/2026']).from);
    expect([slash.getFullYear(), slash.getMonth(), slash.getDate()]).toEqual([2026, 7, 1]);
  });

  it('reads a date and time together as one bound spanning two tokens', () => {
    const range = svc.parseStatsRange(['2026-08-01', '1:34pm', '5m']);
    const from = asDate(range.from);
    expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([2026, 7, 1]);
    expect([from.getHours(), from.getMinutes()]).toEqual([13, 34]);
    // The trailing 5m is the second bound, not a third.
    expect(range.to).not.toBeNull();
    expect(Date.now() - asDate(range.to).getTime()).toBeLessThan(310_000);
  });

  it('handles the example from the spec: 1:34pm until 5 minutes ago', () => {
    const range = svc.parseStatsRange(['1:34pm', '5m']);
    const from = asDate(range.from);
    expect([from.getHours(), from.getMinutes()]).toEqual([13, 34]);
    expect(asDate(range.to).getTime()).toBeGreaterThan(from.getTime());
  });

  it('resolves absolute bounds in local time, not UTC', () => {
    const from = asDate(svc.parseStatsRange(['2026-08-01', '13:34']).from);
    // Constructed as local 13:34, so the stored UTC hour differs by the offset.
    const expectedUtcHour = new Date(2026, 7, 1, 13, 34).getUTCHours();
    expect(from.getUTCHours()).toBe(expectedUtcHour);
    expect(from.getHours()).toBe(13);
  });

  it('rejects unparseable and impossible values', () => {
    expect(() => svc.parseStatsRange(['soon'])).toThrow(/Can't read/);
    expect(() => svc.parseStatsRange(['25:00'])).toThrow(/Can't read/);
    expect(() => svc.parseStatsRange(['13pm'])).toThrow(/Can't read/);
    expect(() => svc.parseStatsRange(['2026-02-31'])).toThrow(/Can't read/);
    expect(() => svc.parseStatsRange(['5m', '2h', '7d'])).toThrow(/at most two bounds/);
  });

  it('filters stats to the requested window', () => {
    liveCoupon('WINDOW', 1, 100, null);
    const old = svc.mintFromCoupon('WINDOW');
    const recent = svc.mintFromCoupon('WINDOW');
    backdateToken(old.tokenId, 7200); // two hours ago

    expect(svc.tokenStats(svc.parseStatsRange([])).minted).toBe(2);
    expect(svc.tokenStats(svc.parseStatsRange(['5m'])).minted).toBe(1);
    expect(svc.tokenStats(svc.parseStatsRange(['3h'])).minted).toBe(2);
    // A window that ends before the recent mint sees only the old one.
    expect(svc.tokenStats(svc.parseStatsRange(['3h', '1h'])).minted).toBe(1);
    expect(recent.tokenId).toBeGreaterThan(old.tokenId);
  });
});
