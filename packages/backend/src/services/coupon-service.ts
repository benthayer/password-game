/**
 * Coupons and redeem tokens.
 *
 * A coupon is a reusable public code carrying a value in credits. Entering it on
 * /coupons mints a token: a single-use bearer credential, stored only as a hash,
 * shown to the user exactly once. Redeeming a token grants credit to an account
 * the same way a payment does.
 *
 * Two things are load-bearing and easy to break:
 *
 *  - A coupon with no mint_limits rows cannot be minted from. This is derived
 *    from the row count, never stored, so removing the last limit disables the
 *    coupon with no state transition to get wrong.
 *  - Every applicable cap must pass. The check is conjunctive across scopes and
 *    within a scope; adding a rule can only ever make minting harder.
 */

import { randomBytes, createHash } from 'crypto';
import { db, grantCredits, getAccount } from '../storage/db.js';

// =============================================================================
// ERRORS
// =============================================================================

export type CouponErrorCode =
  | 'coupon_gate_closed'
  | 'redemption_gate_closed'
  | 'invalid_code'        // unknown OR inert — deliberately indistinguishable
  | 'limit_exceeded'
  | 'invalid_token'
  | 'token_already_used'
  | 'token_revoked'
  | 'bad_request';

export class CouponError extends Error {
  constructor(public code: CouponErrorCode, message: string, public detail?: string) {
    super(message);
    this.name = 'CouponError';
  }
}

// =============================================================================
// TOKEN FORMAT
// =============================================================================

// Crockford base32: no I, L, O or U, so nothing reads ambiguously when a token
// is copied off a QR by hand.
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TOKEN_BYTES = 16; // 128 bits

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function generateToken(): string {
  const body = encodeBase32(randomBytes(TOKEN_BYTES));
  const groups = body.match(/.{1,5}/g) ?? [];
  // 128 bits is 26 base32 chars, which leaves a 1-char remainder. Fold it into
  // the previous group rather than showing a dangling single character.
  if (groups.length > 1 && groups[groups.length - 1].length < 5) {
    groups[groups.length - 2] += groups.pop();
  }
  return groups.join('-');
}

/**
 * Reduce a token to the form that gets hashed. Applied identically at mint and
 * redeem, so formatting is cosmetic: hyphens, spaces and case never matter, and
 * the letters Crockford excludes are folded to the digits they resemble.
 */
export function canonicalizeToken(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

function hashToken(input: string): string {
  return createHash('sha256').update(canonicalizeToken(input)).digest('hex');
}

// =============================================================================
// DURATIONS
// =============================================================================

const DURATION_RE = /^(\d+)(s|m|h|d|w)$/i;
const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

/** Parse `30s` / `5m` / `2h` / `7d` / `1w` into seconds. Null if unparseable. */
export function parseDuration(input: string): number | null {
  const m = DURATION_RE.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * DURATION_UNITS[m[2].toLowerCase()];
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'all-time';
  for (const [unit, size] of [['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]] as const) {
    if (seconds % size === 0 && seconds >= size) return `${seconds / size}${unit}`;
  }
  return `${seconds}s`;
}

// =============================================================================
// TYPES
// =============================================================================

export interface Coupon {
  id: number;
  code: string;
  valueCredits: number;
  retiredAt: string | null;
  createdAt: string;
}

export interface MintLimit {
  id: number;
  couponId: number | null;
  kind: 'cap' | 'inherit_global';
  maxCount: number | null;
  windowSeconds: number | null;
}

export interface LimitStatusRow {
  id: number;
  scope: string;            // 'GLOBAL' or the coupon code
  couponId: number | null;
  kind: 'cap' | 'inherit_global';
  maxCount: number | null;
  windowSeconds: number | null;
  used: number;
  remaining: number | null;
  freesAt: string | null;   // when a full window next frees a slot
}

export interface MintedToken {
  token: string;
  credits: number;
  tokenId: number;
}

// =============================================================================
// ROW MAPPERS
// =============================================================================

function rowToCoupon(row: any): Coupon {
  return {
    id: row.id,
    code: row.code,
    valueCredits: row.value_credits,
    retiredAt: row.retired_at,
    createdAt: row.created_at,
  };
}

function rowToLimit(row: any): MintLimit {
  return {
    id: row.id,
    couponId: row.coupon_id,
    kind: row.kind,
    maxCount: row.max_count,
    windowSeconds: row.window_seconds,
  };
}

// =============================================================================
// GATES
// =============================================================================

export type GateName = 'coupon' | 'redemption';

export function isGateOpen(name: GateName): boolean {
  const row = db.prepare('SELECT is_open FROM gates WHERE name = ?').get(name) as any;
  return row ? row.is_open === 1 : true;
}

export function setGate(name: GateName, open: boolean): void {
  db.prepare('INSERT INTO gates (name, is_open) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET is_open = ?')
    .run(name, open ? 1 : 0, open ? 1 : 0);
}

export function allGates(): Record<GateName, boolean> {
  return { coupon: isGateOpen('coupon'), redemption: isGateOpen('redemption') };
}

// =============================================================================
// COUPONS
// =============================================================================

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * The only path from a code to a coupon row. Always filters retired rows, so a
 * retired code is uniformly unreachable and no caller can accidentally act on
 * a predecessor that merely shares a label.
 */
export function resolveLiveCoupon(code: string): Coupon | null {
  const row = db.prepare('SELECT * FROM coupons WHERE code = ? AND retired_at IS NULL')
    .get(normalizeCode(code));
  return row ? rowToCoupon(row) : null;
}

export function getCouponById(id: number): Coupon | null {
  const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  return row ? rowToCoupon(row) : null;
}

export function listLiveCoupons(): Coupon[] {
  const rows = db.prepare('SELECT * FROM coupons WHERE retired_at IS NULL ORDER BY code').all();
  return rows.map(rowToCoupon);
}

/**
 * Add a coupon, or reprice an existing live one. Repricing never touches tokens
 * already minted — they carry their own value_credits snapshot.
 */
export function addCoupon(code: string, credits: number): { coupon: Coupon; repriced: boolean } {
  const normalized = normalizeCode(code);
  if (!/^[0-9A-Z_-]{2,32}$/.test(normalized)) {
    throw new CouponError('bad_request', 'Code must be 2-32 chars of A-Z, 0-9, - or _');
  }
  if (!(credits > 0)) {
    throw new CouponError('bad_request', 'Credits must be greater than 0');
  }

  const now = new Date().toISOString();
  const existing = resolveLiveCoupon(normalized);

  if (existing) {
    db.prepare('UPDATE coupons SET value_credits = ?, updated_at = ? WHERE id = ?')
      .run(credits, now, existing.id);
    return { coupon: getCouponById(existing.id)!, repriced: true };
  }

  const result = db.prepare(`
    INSERT INTO coupons (code, value_credits, retired_at, created_at, updated_at)
    VALUES (?, ?, NULL, ?, ?)
  `).run(normalized, credits, now, now);

  return { coupon: getCouponById(Number(result.lastInsertRowid))!, repriced: false };
}

/**
 * Retire a coupon: stop future minting and free the code for reuse, while
 * keeping the row so tokens minted from it retain a valid foreign key.
 *
 * Deliberately does NOT revoke outstanding tokens — those are bearer instruments
 * someone is holding, and voiding them as a side effect of cleaning up a
 * finished campaign would strand real credit. /revoke is the tool for that.
 */
export function retireCoupon(code: string): { coupon: Coupon; limitsRemoved: number; activeTokens: number } {
  const coupon = resolveLiveCoupon(code);
  if (!coupon) throw new CouponError('bad_request', `No live coupon "${normalizeCode(code)}"`);

  const run = db.transaction(() => {
    const removed = db.prepare('DELETE FROM mint_limits WHERE coupon_id = ?').run(coupon.id);
    db.prepare('UPDATE coupons SET retired_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), coupon.id);
    return removed.changes;
  });

  const limitsRemoved = run();
  const activeTokens = (db.prepare(
    `SELECT COUNT(*) AS n FROM tokens WHERE coupon_id = ? AND status = 'active'`
  ).get(coupon.id) as any).n;

  return { coupon, limitsRemoved, activeTokens };
}

export function clearCoupons(): number {
  const live = listLiveCoupons();
  const run = db.transaction(() => {
    for (const c of live) {
      db.prepare('DELETE FROM mint_limits WHERE coupon_id = ?').run(c.id);
      db.prepare('UPDATE coupons SET retired_at = ?, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), new Date().toISOString(), c.id);
    }
    return live.length;
  });
  return run();
}

// =============================================================================
// LIMITS
// =============================================================================

export function listLimits(couponId: number | null): MintLimit[] {
  const rows = couponId === null
    ? db.prepare('SELECT * FROM mint_limits WHERE coupon_id IS NULL ORDER BY id').all()
    : db.prepare('SELECT * FROM mint_limits WHERE coupon_id = ? ORDER BY id').all(couponId);
  return rows.map(rowToLimit);
}

export function addCap(couponId: number | null, maxCount: number, windowSeconds: number | null): MintLimit {
  if (!Number.isInteger(maxCount) || maxCount < 0) {
    throw new CouponError('bad_request', 'Limit must be a non-negative whole number');
  }
  const result = db.prepare(`
    INSERT INTO mint_limits (coupon_id, kind, max_count, window_seconds, created_at)
    VALUES (?, 'cap', ?, ?, ?)
  `).run(couponId, maxCount, windowSeconds, new Date().toISOString());
  return rowToLimit(db.prepare('SELECT * FROM mint_limits WHERE id = ?').get(Number(result.lastInsertRowid)));
}

/**
 * Point a coupon at the global caps only. Represented as a row rather than a
 * mode flag, which is what keeps "configured to use global" distinguishable from
 * "never configured" while leaving usability derived from a single row count.
 */
export function setCouponGlobal(couponId: number): { removed: number } {
  const run = db.transaction(() => {
    const removed = db.prepare('DELETE FROM mint_limits WHERE coupon_id = ?').run(couponId).changes;
    db.prepare(`
      INSERT INTO mint_limits (coupon_id, kind, max_count, window_seconds, created_at)
      VALUES (?, 'inherit_global', NULL, NULL, ?)
    `).run(couponId, new Date().toISOString());
    return removed;
  });
  return { removed: run() };
}

/**
 * Remove a rule by id, refusing ids from another scope so a mistyped id can't
 * silently delete a rule somewhere else.
 */
export function removeLimit(couponId: number | null, id: number): { nowInert: boolean } {
  const row = db.prepare('SELECT * FROM mint_limits WHERE id = ?').get(id) as any;
  if (!row) throw new CouponError('bad_request', `No limit #${id}`);

  const rowScope: number | null = row.coupon_id;
  if (rowScope !== couponId) {
    const where = rowScope === null ? 'the global scope' : `coupon ${getCouponById(rowScope)?.code ?? rowScope}`;
    throw new CouponError('bad_request', `Limit #${id} belongs to ${where}, not this scope`);
  }

  db.prepare('DELETE FROM mint_limits WHERE id = ?').run(id);

  // A coupon with no rows left is unusable. Reported so the caller can say so
  // rather than leaving a silently dead coupon behind.
  const nowInert = couponId !== null && listLimits(couponId).length === 0;
  return { nowInert };
}

// =============================================================================
// CAP COUNTING
//
// Shared by enforcement and /limit status. If these used separate queries the
// status report would eventually disagree with the reason a mint was refused.
// =============================================================================

function windowCutoff(windowSeconds: number | null, now: Date): string | null {
  if (windowSeconds === null) return null;
  return new Date(now.getTime() - windowSeconds * 1000).toISOString();
}

/**
 * Count web mints a cap applies to. Global caps (couponId null) count all web
 * mints; scoped caps count only that coupon's. Admin mints are excluded
 * everywhere by the source filter, so /mint neither consumes nor is consumed by
 * the public budget.
 */
function countMints(
  couponId: number | null,
  windowSeconds: number | null,
  now: Date
): { used: number; oldestAt: string | null } {
  const cutoff = windowCutoff(windowSeconds, now);
  const clauses = [`source = 'web'`];
  const params: any[] = [];

  if (couponId !== null) {
    clauses.push('coupon_id = ?');
    params.push(couponId);
  }
  if (cutoff !== null) {
    clauses.push('minted_at > ?');
    params.push(cutoff);
  }

  const row = db.prepare(
    `SELECT COUNT(*) AS used, MIN(minted_at) AS oldest FROM tokens WHERE ${clauses.join(' AND ')}`
  ).get(...params) as any;

  return { used: row.used, oldestAt: row.oldest ?? null };
}

/** Every cap binding a mint from this coupon: all global caps plus its own. */
function applicableCaps(couponId: number): MintLimit[] {
  return [
    ...listLimits(null).filter(l => l.kind === 'cap'),
    ...listLimits(couponId).filter(l => l.kind === 'cap'),
  ];
}

function capScopeId(cap: MintLimit): number | null {
  return cap.couponId;
}

/** First cap with no headroom, or null if every cap passes. */
function findBlockingCap(couponId: number, now: Date): { cap: MintLimit; used: number } | null {
  for (const cap of applicableCaps(couponId)) {
    const { used } = countMints(capScopeId(cap), cap.windowSeconds, now);
    if (cap.maxCount !== null && used >= cap.maxCount) return { cap, used };
  }
  return null;
}

export function limitStatus(couponId?: number | null): { rows: LimitStatusRow[]; inertCoupons: string[] } {
  const now = new Date();
  const rows: LimitStatusRow[] = [];

  const describe = (limit: MintLimit, scope: string): LimitStatusRow => {
    const { used, oldestAt } = countMints(capScopeId(limit), limit.windowSeconds, now);
    const exhausted = limit.maxCount !== null && used >= limit.maxCount;
    return {
      id: limit.id,
      scope,
      couponId: limit.couponId,
      kind: limit.kind,
      maxCount: limit.maxCount,
      windowSeconds: limit.windowSeconds,
      used: limit.kind === 'cap' ? used : 0,
      remaining: limit.maxCount === null ? null : Math.max(0, limit.maxCount - used),
      // Capacity returns when the oldest counted mint falls out of the window.
      // All-time caps never free up, so they report nothing.
      freesAt: exhausted && limit.windowSeconds !== null && oldestAt
        ? new Date(new Date(oldestAt).getTime() + limit.windowSeconds * 1000).toISOString()
        : null,
    };
  };

  for (const limit of listLimits(null)) rows.push(describe(limit, 'GLOBAL'));

  const coupons = couponId === undefined || couponId === null
    ? listLiveCoupons()
    : [getCouponById(couponId)].filter((c): c is Coupon => c !== null);

  const inertCoupons: string[] = [];
  for (const coupon of coupons) {
    const limits = listLimits(coupon.id);
    if (limits.length === 0) {
      inertCoupons.push(coupon.code);
      continue;
    }
    for (const limit of limits) rows.push(describe(limit, coupon.code));
  }

  return { rows, inertCoupons };
}

// =============================================================================
// MINTING
// =============================================================================

function insertToken(
  couponId: number | null,
  source: 'admin' | 'web',
  credits: number
): MintedToken {
  const token = generateToken();
  const result = db.prepare(`
    INSERT INTO tokens (token_hash, coupon_id, source, value_credits, status, minted_at)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).run(hashToken(token), couponId, source, credits, new Date().toISOString());

  return { token, credits, tokenId: Number(result.lastInsertRowid) };
}

/**
 * Public mint. Throws `invalid_code` for both unknown and inert coupons — the
 * two must be indistinguishable or the endpoint becomes an oracle confirming
 * which codes exist, which matters because codes are short and guessable.
 */
export function mintFromCoupon(code: string): MintedToken {
  if (!isGateOpen('coupon')) {
    throw new CouponError('coupon_gate_closed', 'Coupon minting is closed');
  }

  const coupon = resolveLiveCoupon(code);
  if (!coupon) throw new CouponError('invalid_code', 'That code is not valid');

  if (listLimits(coupon.id).length === 0) {
    throw new CouponError('invalid_code', 'That code is not valid', `coupon ${coupon.code} is inert (no limits configured)`);
  }

  const blocked = findBlockingCap(coupon.id, new Date());
  if (blocked) {
    const scope = blocked.cap.couponId === null ? 'global' : coupon.code;
    throw new CouponError(
      'limit_exceeded',
      'This coupon has reached its limit. Try again later.',
      `${scope} limit #${blocked.cap.id} (${blocked.cap.maxCount}/${formatDuration(blocked.cap.windowSeconds)}) at ${blocked.used}`
    );
  }

  return insertToken(coupon.id, 'web', coupon.valueCredits);
}

/**
 * Admin mint from the bot. Bypasses gates and caps entirely and is excluded from
 * every count, so a drained public budget can never lock you out of your own
 * tool, and comping someone doesn't eat a coupon's allowance.
 */
export function mintManual(credits: number): MintedToken {
  if (!(credits > 0)) throw new CouponError('bad_request', 'Credits must be greater than 0');
  return insertToken(null, 'admin', credits);
}

// =============================================================================
// REDEEMING
// =============================================================================

export interface RedeemResult {
  credits: number;
  tokenId: number;
  gbYearsRemaining: number;
  egressGbRemaining: number;
}

/**
 * Redeem a token into an account.
 *
 * The conditional UPDATE is what makes double-redeem impossible: it only matches
 * a token that is still active, and better-sqlite3 is synchronous, so wrapping it
 * with the grant in one transaction closes the race without extra locking. Two
 * concurrent redeems of the same token cannot both see changes === 1.
 */
export async function redeemToken(tokenInput: string, addressHash: string): Promise<RedeemResult> {
  if (!isGateOpen('redemption')) {
    throw new CouponError('redemption_gate_closed', 'Redemption is closed');
  }

  const hash = hashToken(tokenInput);

  const claim = db.transaction(() => {
    const row = db.prepare('SELECT * FROM tokens WHERE token_hash = ?').get(hash) as any;
    if (!row) throw new CouponError('invalid_token', 'That token is not valid');
    if (row.status === 'redeemed') throw new CouponError('token_already_used', 'That token has already been used');
    if (row.status === 'revoked') throw new CouponError('token_revoked', 'That token has been revoked');

    const now = new Date().toISOString();
    const updated = db.prepare(`
      UPDATE tokens
      SET status = 'redeemed', redeemed_at = ?, redeemed_address_hash = ?
      WHERE token_hash = ? AND status = 'active'
    `).run(now, addressHash, hash);

    if (updated.changes !== 1) {
      throw new CouponError('token_already_used', 'That token has already been used');
    }
    return { id: row.id as number, credits: row.value_credits as number };
  });

  const { id, credits } = claim();

  const account = await grantCredits(addressHash, credits);
  return {
    credits,
    tokenId: id,
    gbYearsRemaining: account.gbYearsRemaining,
    egressGbRemaining: account.egressGbRemaining,
  };
}

// =============================================================================
// REVOKING
// =============================================================================

/**
 * Revoke unredeemed tokens. Never touches already-redeemed ones: that credit is
 * spent and clawing it back here would silently contradict a balance the account
 * has already seen.
 */
export function revokeTokens(selector: string): { revoked: number; description: string } {
  const trimmed = selector.trim();

  if (trimmed.toLowerCase() === 'all') {
    const n = db.prepare(`UPDATE tokens SET status = 'revoked' WHERE status = 'active'`).run().changes;
    return { revoked: n, description: 'all active tokens' };
  }

  if (/^#?\d+$/.test(trimmed)) {
    const id = Number(trimmed.replace('#', ''));
    const n = db.prepare(`UPDATE tokens SET status = 'revoked' WHERE id = ? AND status = 'active'`).run(id).changes;
    return { revoked: n, description: `token #${id}` };
  }

  const duration = parseDuration(trimmed);
  if (duration !== null) {
    const cutoff = new Date(Date.now() - duration * 1000).toISOString();
    const n = db.prepare(
      `UPDATE tokens SET status = 'revoked' WHERE status = 'active' AND minted_at > ?`
    ).run(cutoff).changes;
    return { revoked: n, description: `tokens minted in the last ${formatDuration(duration)}` };
  }

  // Otherwise treat it as a token value.
  const n = db.prepare(
    `UPDATE tokens SET status = 'revoked' WHERE token_hash = ? AND status = 'active'`
  ).run(hashToken(trimmed)).changes;
  return { revoked: n, description: 'that token' };
}

// =============================================================================
// STATS
// =============================================================================

// =============================================================================
// INSTANTS
//
// A range bound may be relative (`5m` = five minutes ago) or absolute — a clock
// time (`1:34pm`, `13:34`), a date (`2026-08-01`, `8/1`), or a date followed by a
// time, which spans two whitespace-separated tokens.
//
// Absolute forms are resolved in the process's local timezone, so TZ must be set
// to the operator's zone or `1:34pm` silently means 1:34pm UTC. docker-compose
// pins it for the backend; formatInstant echoes the zone so output is never
// ambiguous about which reading it used.
// =============================================================================

const TIME_12_RE = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;
const TIME_24_RE = /^(\d{1,2}):(\d{2})$/;
const DATE_ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DATE_SLASH_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;

interface TimeOfDay { hours: number; minutes: number }

function parseTimeOfDay(input: string): TimeOfDay | null {
  const twelve = TIME_12_RE.exec(input);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minutes = twelve[2] === undefined ? 0 : Number(twelve[2]);
    if (hour < 1 || hour > 12 || minutes > 59) return null;
    const pm = twelve[3].toLowerCase() === 'pm';
    return { hours: (hour % 12) + (pm ? 12 : 0), minutes };
  }

  const twentyFour = TIME_24_RE.exec(input);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

interface DateParts { year: number; month: number; day: number }

function parseDateParts(input: string, now: Date): DateParts | null {
  const iso = DATE_ISO_RE.exec(input);
  if (iso) {
    const parts = { year: Number(iso[1]), month: Number(iso[2]) - 1, day: Number(iso[3]) };
    return isRealDate(parts) ? parts : null;
  }

  const slash = DATE_SLASH_RE.exec(input);
  if (slash) {
    let year = now.getFullYear();
    if (slash[3] !== undefined) {
      const raw = Number(slash[3]);
      year = raw < 100 ? 2000 + raw : raw;
    }
    const parts = { year, month: Number(slash[1]) - 1, day: Number(slash[2]) };
    return isRealDate(parts) ? parts : null;
  }

  return null;
}

/** Rejects 2026-02-31 and friends, which Date would silently roll over. */
function isRealDate({ year, month, day }: DateParts): boolean {
  if (month < 0 || month > 11 || day < 1 || day > 31) return false;
  const d = new Date(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

interface ParsedInstant { at: Date; consumed: number; relative: boolean; text: string }

/**
 * Read one bound starting at `index`. Returns how many tokens it consumed, since
 * a date followed by a time is a single instant spelled with two tokens.
 */
function parseInstantAt(tokens: string[], index: number, now: Date): ParsedInstant | null {
  const token = tokens[index];

  const duration = parseDuration(token);
  if (duration !== null) {
    return {
      at: new Date(now.getTime() - duration * 1000),
      consumed: 1,
      relative: true,
      text: token,
    };
  }

  const date = parseDateParts(token, now);
  if (date) {
    const next = tokens[index + 1] !== undefined ? parseTimeOfDay(tokens[index + 1]) : null;
    if (next) {
      return {
        at: new Date(date.year, date.month, date.day, next.hours, next.minutes, 0, 0),
        consumed: 2,
        relative: false,
        text: `${token} ${tokens[index + 1]}`,
      };
    }
    return {
      at: new Date(date.year, date.month, date.day, 0, 0, 0, 0),
      consumed: 1,
      relative: false,
      text: token,
    };
  }

  const time = parseTimeOfDay(token);
  if (time) {
    const at = new Date(now);
    at.setHours(time.hours, time.minutes, 0, 0);
    // A clock time with no date means the most recent occurrence: "1:34pm" asked
    // at noon means yesterday, not four hours from now.
    if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
    return { at, consumed: 1, relative: false, text: token };
  }

  return null;
}

export function formatInstant(date: Date): string {
  return date.toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  });
}

export interface StatsRange {
  from: string | null;
  to: string | null;
  label: string;
}

/**
 * `<bound>` = from then until now. `<bound> <bound>` = between the two, in either
 * order. Each bound is relative or absolute, independently — `1:34pm 5m` means
 * 1:34pm until five minutes ago.
 */
export function parseStatsRange(args: string[]): StatsRange {
  const tokens = args.filter(a => a.trim() !== '');
  if (tokens.length === 0) return { from: null, to: null, label: 'all time' };

  const now = new Date();
  const bounds: ParsedInstant[] = [];
  let i = 0;

  while (i < tokens.length) {
    const parsed = parseInstantAt(tokens, i, now);
    if (!parsed) {
      throw new CouponError(
        'bad_request',
        `Can't read "${tokens[i]}" as a time. Use a duration (5m, 2h, 7d), ` +
        `a clock time (1:34pm, 13:34), a date (2026-08-01, 8/1), or a date and time.`
      );
    }
    bounds.push(parsed);
    i += parsed.consumed;

    if (bounds.length > 2) {
      throw new CouponError('bad_request', 'A range takes at most two bounds');
    }
  }

  if (bounds.length === 1) {
    const only = bounds[0];
    return {
      from: only.at.toISOString(),
      to: null,
      label: only.relative
        ? `last ${only.text}`
        : `since ${formatInstant(only.at)}`,
    };
  }

  // Accept either order rather than erroring on a swapped range.
  const [start, end] = bounds[0].at <= bounds[1].at ? bounds : [bounds[1], bounds[0]];
  return {
    from: start.at.toISOString(),
    to: end.at.toISOString(),
    label: `${formatInstant(start.at)} → ${formatInstant(end.at)}`,
  };
}

function rangeClause(range: StatsRange, column: string, params: any[]): string {
  const parts: string[] = [];
  if (range.from) { parts.push(`${column} > ?`); params.push(range.from); }
  if (range.to) { parts.push(`${column} <= ?`); params.push(range.to); }
  return parts.length ? ` AND ${parts.join(' AND ')}` : '';
}

export interface TokenStats {
  minted: number;
  redeemed: number;
  active: number;
  revoked: number;
  web: number;
  admin: number;
  creditsGranted: number;
}

export function tokenStats(range: StatsRange): TokenStats {
  const params: any[] = [];
  const where = `WHERE 1=1${rangeClause(range, 'minted_at', params)}`;
  const row = db.prepare(`
    SELECT
      COUNT(*) AS minted,
      SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked,
      SUM(CASE WHEN source = 'web' THEN 1 ELSE 0 END) AS web,
      SUM(CASE WHEN source = 'admin' THEN 1 ELSE 0 END) AS admin,
      COALESCE(SUM(CASE WHEN status = 'redeemed' THEN value_credits ELSE 0 END), 0) AS credits
    FROM tokens ${where}
  `).get(...params) as any;

  return {
    minted: row.minted ?? 0,
    redeemed: row.redeemed ?? 0,
    active: row.active ?? 0,
    revoked: row.revoked ?? 0,
    web: row.web ?? 0,
    admin: row.admin ?? 0,
    creditsGranted: row.credits ?? 0,
  };
}

export interface CouponStatsRow {
  couponId: number;
  code: string;
  createdAt: string;
  retired: boolean;
  minted: number;
  redeemed: number;
  creditsGranted: number;
}

/**
 * Keyed on coupon_id, never on code: a reused code produces two distinct coupons
 * that merely share a label, and summing them would misreport both campaigns.
 */
export function couponStats(range: StatsRange): CouponStatsRow[] {
  const params: any[] = [];
  const clause = rangeClause(range, 't.minted_at', params);
  const rows = db.prepare(`
    SELECT c.id, c.code, c.created_at, c.retired_at,
           COUNT(t.id) AS minted,
           SUM(CASE WHEN t.status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed,
           COALESCE(SUM(CASE WHEN t.status = 'redeemed' THEN t.value_credits ELSE 0 END), 0) AS credits
    FROM coupons c
    LEFT JOIN tokens t ON t.coupon_id = c.id${clause}
    GROUP BY c.id
    ORDER BY c.code, c.created_at
  `).all(...params) as any[];

  return rows.map(r => ({
    couponId: r.id,
    code: r.code,
    createdAt: r.created_at,
    retired: r.retired_at !== null,
    minted: r.minted ?? 0,
    redeemed: r.redeemed ?? 0,
    creditsGranted: r.credits ?? 0,
  }));
}

export interface AccountStats {
  accountsCredited: number;
  creditsGranted: number;
}

export function accountStats(range: StatsRange): AccountStats {
  const params: any[] = [];
  const clause = rangeClause(range, 'redeemed_at', params);
  const row = db.prepare(`
    SELECT COUNT(DISTINCT redeemed_address_hash) AS accounts,
           COALESCE(SUM(value_credits), 0) AS credits
    FROM tokens
    WHERE status = 'redeemed'${clause}
  `).get(...params) as any;

  return { accountsCredited: row.accounts ?? 0, creditsGranted: row.credits ?? 0 };
}

export { getAccount };
