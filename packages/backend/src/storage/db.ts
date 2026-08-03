import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_FILE = path.join(DATA_DIR, 'accounts.db');

// =============================================================================
// TYPES
// =============================================================================

export interface Account {
  addressHash: string;
  gbYearsRemaining: number;   // Storage: 1 GB-year per $1
  egressGbRemaining: number;  // Egress: 50 GB per $1
  fileSize: number | null;
  lastBilledAt: string | null;  // When storage was last billed (for idempotent billing)
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  chargeId: string;
  chargeCode: string | null;
  amountUsdc: number;
  chain: string;
  txHash: string | null;
  senderAddress: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  accountAddressHash: string | null;
  creditsGranted: number;
  rawWebhookPayload: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

import fs from 'fs';
fs.mkdirSync(DATA_DIR, { recursive: true });

const db: Database.Database = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    address_hash TEXT PRIMARY KEY,
    gb_years_remaining REAL DEFAULT 0,
    egress_gb_remaining REAL DEFAULT 0,
    file_size INTEGER,
    last_billed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// Migration: add last_billed_at column if missing
const hasLastBilledAt = db.prepare(`PRAGMA table_info(accounts)`).all()
  .some((col: any) => col.name === 'last_billed_at');
if (!hasLastBilledAt) {
  db.exec(`ALTER TABLE accounts ADD COLUMN last_billed_at TEXT`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    charge_id TEXT UNIQUE NOT NULL,
    charge_code TEXT,
    amount_usdc REAL NOT NULL,
    chain TEXT NOT NULL,
    tx_hash TEXT,
    sender_address TEXT,
    status TEXT DEFAULT 'pending',
    account_address_hash TEXT,
    credits_granted INTEGER DEFAULT 0,
    raw_webhook_payload TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_address_hash)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);

// Pending charges: maps random tokens to addressHash (for privacy - Coinbase only sees token)
db.exec(`
  CREATE TABLE IF NOT EXISTS pending_charges (
    token TEXT PRIMARY KEY,
    address_hash TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    charge_id TEXT,
    created_at TEXT NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_pending_charges_charge_id ON pending_charges(charge_id)`);

// -----------------------------------------------------------------------------
// COUPONS / TOKENS
//
// A coupon's identity is its `id`, not its `code`: removing a coupon retires the
// row (keeping tokens' foreign key valid) so the same code can be re-added as a
// genuinely new coupon. Uniqueness therefore applies only among live rows.
//
// A coupon with no mint_limits rows cannot be minted from. That is derived from
// the row count, not stored — there is no enabled/disabled column anywhere.
// `kind='inherit_global'` is how a coupon says "no caps of my own, just the
// global ones" while still having a row, which is what keeps it distinguishable
// from a never-configured coupon.
// -----------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    value_credits REAL NOT NULL,
    retired_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_live_code
  ON coupons(code) WHERE retired_at IS NULL
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT UNIQUE NOT NULL,
    coupon_id INTEGER REFERENCES coupons(id),
    source TEXT NOT NULL,
    value_credits REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    minted_at TEXT NOT NULL,
    redeemed_at TEXT,
    redeemed_address_hash TEXT
  )
`);

// Every cap count filters on exactly these three columns.
db.exec(`CREATE INDEX IF NOT EXISTS idx_tokens_caps ON tokens(coupon_id, source, minted_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS mint_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id INTEGER REFERENCES coupons(id),
    kind TEXT NOT NULL,
    max_count INTEGER,
    window_seconds INTEGER,
    created_at TEXT NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_mint_limits_coupon ON mint_limits(coupon_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS gates (
    name TEXT PRIMARY KEY,
    is_open INTEGER NOT NULL DEFAULT 1
  )
`);

// Both gates start open; /stop closes them.
db.prepare(`INSERT OR IGNORE INTO gates (name, is_open) VALUES ('coupon', 1)`).run();
db.prepare(`INSERT OR IGNORE INTO gates (name, is_open) VALUES ('redemption', 1)`).run();

// Telegram long-poll offset, so a restart doesn't replay commands.
db.exec(`
  CREATE TABLE IF NOT EXISTS bot_state (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

/**
 * Raw handle for modules that own their own tables (coupon-service). Exported
 * rather than wrapping every coupon query here so that this module stays about
 * accounts and payments, while the schema above remains the single place any
 * table is declared.
 */
export { db };

// =============================================================================
// HELPERS
// =============================================================================

function rowToAccount(row: any): Account {
  return {
    addressHash: row.address_hash,
    gbYearsRemaining: row.gb_years_remaining,
    egressGbRemaining: row.egress_gb_remaining,
    fileSize: row.file_size,
    lastBilledAt: row.last_billed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// ACCOUNT OPERATIONS
// =============================================================================

export async function getAccount(addressHash: string): Promise<Account | null> {
  const row = db.prepare('SELECT * FROM accounts WHERE address_hash = ?').get(addressHash);
  return row ? rowToAccount(row) : null;
}

export async function getAllAccounts(): Promise<Account[]> {
  const rows = db.prepare('SELECT * FROM accounts').all();
  return rows.map(rowToAccount);
}

// Billing: $1 = 1 GB-year storage + 50 GB egress
const GB_YEARS_PER_DOLLAR = 1;
const EGRESS_GB_PER_DOLLAR = 50;
const MIN_BILLABLE_GB = 1; // Small files treated as 1 GB for pricing
const DAYS_PER_YEAR = 365;

// =============================================================================
// BILLING HELPERS
// =============================================================================

function bytesToGb(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

/**
 * Calculate days elapsed since a timestamp.
 */
function daysSince(isoTimestamp: string): number {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  return (now - then) / msPerDay;
}

/**
 * Calculate storage cost for a given number of days.
 * Small files are treated as 1 GB minimum for pricing.
 */
export function calculateStorageCost(fileSizeBytes: number, days: number): number {
  const fileSizeGb = bytesToGb(fileSizeBytes);
  const billableGb = Math.max(MIN_BILLABLE_GB, fileSizeGb);
  return (billableGb * days) / DAYS_PER_YEAR;
}

/**
 * Bill storage for unbilled period since last_billed_at and update timestamp.
 * Idempotent: running multiple times only charges for new elapsed time.
 * Returns the number of days charged (0 if already up to date).
 */
export async function billStorageSinceLastBilled(addressHash: string): Promise<number> {
  const account = await getAccount(addressHash);
  if (!account || !account.fileSize || account.fileSize <= 0) {
    return 0;
  }
  
  if (!account.lastBilledAt) {
    // No last_billed_at means file was just uploaded - set it to now, no charge
    await updateLastBilledAt(addressHash);
    return 0;
  }
  
  const daysElapsed = daysSince(account.lastBilledAt);
  if (daysElapsed < 0.001) {
    // Less than ~1.5 minutes, skip (prevents micro-charges on rapid calls)
    return 0;
  }
  
  const cost = calculateStorageCost(account.fileSize, daysElapsed);
  await spendStorage(addressHash, cost);
  await updateLastBilledAt(addressHash);
  
  return daysElapsed;
}

/**
 * Update last_billed_at to current time.
 */
async function updateLastBilledAt(addressHash: string): Promise<void> {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE accounts SET last_billed_at = ?, updated_at = ? WHERE address_hash = ?
  `).run(now, now, addressHash);
}

/**
 * Get all accounts with active files (for nightly billing).
 */
export async function getAccountsWithFiles(): Promise<Account[]> {
  const rows = db.prepare('SELECT * FROM accounts WHERE file_size IS NOT NULL AND file_size > 0').all();
  return rows.map(rowToAccount);
}

// Credits are the unit coupons are denominated in. One credit currently buys
// exactly what $1 buys, but that is a pricing coincidence rather than an
// identity — keeping the conversion here means the two can diverge later without
// touching any caller, and the coupon path never has to name a currency.
const CREDITS_PER_DOLLAR = 1;
const GB_YEARS_PER_CREDIT = GB_YEARS_PER_DOLLAR / CREDITS_PER_DOLLAR;
const EGRESS_GB_PER_CREDIT = EGRESS_GB_PER_DOLLAR / CREDITS_PER_DOLLAR;

/** Grant credits directly. The coupon path uses only this. */
export async function grantCredits(addressHash: string, credits: number): Promise<Account> {
  const now = new Date().toISOString();
  const gbYearsToAdd = credits * GB_YEARS_PER_CREDIT;
  const egressGbToAdd = credits * EGRESS_GB_PER_CREDIT;

  const existing = db.prepare('SELECT * FROM accounts WHERE address_hash = ?').get(addressHash);
  
  if (existing) {
    db.prepare(`
      UPDATE accounts 
      SET gb_years_remaining = gb_years_remaining + ?,
          egress_gb_remaining = egress_gb_remaining + ?,
          updated_at = ?
      WHERE address_hash = ?
    `).run(gbYearsToAdd, egressGbToAdd, now, addressHash);
  } else {
    db.prepare(`
      INSERT INTO accounts (address_hash, gb_years_remaining, egress_gb_remaining, file_size, last_billed_at, created_at, updated_at)
      VALUES (?, ?, ?, NULL, NULL, ?, ?)
    `).run(addressHash, gbYearsToAdd, egressGbToAdd, now, now);
  }
  
  return (await getAccount(addressHash))!;
}

/** Payment path: dollars in, converted to credits at the current rate. */
export async function grantStorageAndEgressFromPayment(addressHash: string, amountUsd: number): Promise<Account> {
  return grantCredits(addressHash, amountUsd * CREDITS_PER_DOLLAR);
}

export async function spendEgress(addressHash: string, gbAmount: number): Promise<boolean> {
  const result = db.prepare(`
    UPDATE accounts 
    SET egress_gb_remaining = egress_gb_remaining - ?, updated_at = ?
    WHERE address_hash = ?
  `).run(gbAmount, new Date().toISOString(), addressHash);
  
  return result.changes > 0;
}

export async function spendStorage(addressHash: string, gbYearAmount: number): Promise<boolean> {
  const result = db.prepare(`
    UPDATE accounts 
    SET gb_years_remaining = gb_years_remaining - ?, updated_at = ?
    WHERE address_hash = ?
  `).run(gbYearAmount, new Date().toISOString(), addressHash);
  
  return result.changes > 0;
}

export async function setFileSize(addressHash: string, size: number | null): Promise<void> {
  const now = new Date().toISOString();
  
  const existing = db.prepare('SELECT * FROM accounts WHERE address_hash = ?').get(addressHash);
  
  // When setting a file size (upload), set last_billed_at to now to start billing period
  // When clearing file size (delete), clear last_billed_at
  const lastBilledAt = size !== null ? now : null;
  
  if (existing) {
    db.prepare(`
      UPDATE accounts SET file_size = ?, last_billed_at = ?, updated_at = ? WHERE address_hash = ?
    `).run(size, lastBilledAt, now, addressHash);
  } else {
    db.prepare(`
      INSERT INTO accounts (address_hash, gb_years_remaining, egress_gb_remaining, file_size, last_billed_at, created_at, updated_at)
      VALUES (?, 0, 0, ?, ?, ?, ?)
    `).run(addressHash, size, lastBilledAt, now, now);
  }
}

export async function getGbYearsRemaining(addressHash: string): Promise<number> {
  const account = await getAccount(addressHash);
  if (!account) return 0;
  return account.gbYearsRemaining;
}

export async function getEgressGbRemaining(addressHash: string): Promise<number> {
  const account = await getAccount(addressHash);
  if (!account) return 0;
  return account.egressGbRemaining;
}

// =============================================================================
// PAYMENT OPERATIONS
// =============================================================================

function rowToPayment(row: any): Payment {
  return {
    id: row.id,
    chargeId: row.charge_id,
    chargeCode: row.charge_code,
    amountUsdc: row.amount_usdc,
    chain: row.chain,
    txHash: row.tx_hash,
    senderAddress: row.sender_address,
    status: row.status,
    accountAddressHash: row.account_address_hash,
    creditsGranted: row.credits_granted,
    rawWebhookPayload: row.raw_webhook_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPaymentByChargeId(chargeId: string): Promise<Payment | null> {
  const row = db.prepare('SELECT * FROM payments WHERE charge_id = ?').get(chargeId);
  return row ? rowToPayment(row) : null;
}

export async function recordPayment(payment: {
  chargeId: string;
  chargeCode?: string;
  amountUsdc: number;
  chain: string;
  txHash?: string;
  senderAddress?: string;
  status: 'pending' | 'confirmed' | 'failed';
  accountAddressHash?: string;
  creditsGranted?: number;
  rawWebhookPayload?: string;
}): Promise<Payment> {
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO payments (
      charge_id, charge_code, amount_usdc, chain, tx_hash, sender_address,
      status, account_address_hash, credits_granted, raw_webhook_payload,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payment.chargeId,
    payment.chargeCode ?? null,
    payment.amountUsdc,
    payment.chain,
    payment.txHash ?? null,
    payment.senderAddress ?? null,
    payment.status,
    payment.accountAddressHash ?? null,
    payment.creditsGranted ?? 0,
    payment.rawWebhookPayload ?? null,
    now,
    now
  );
  
  return (await getPaymentByChargeId(payment.chargeId))!;
}

export async function updatePaymentStatus(
  chargeId: string, 
  status: 'pending' | 'confirmed' | 'failed'
): Promise<void> {
  db.prepare(`
    UPDATE payments SET status = ?, updated_at = ? WHERE charge_id = ?
  `).run(status, new Date().toISOString(), chargeId);
}

export async function updatePaymentCreditsGranted(
  chargeId: string,
  creditsGranted: number
): Promise<void> {
  db.prepare(`
    UPDATE payments SET credits_granted = ?, updated_at = ? WHERE charge_id = ?
  `).run(creditsGranted, new Date().toISOString(), chargeId);
}

// =============================================================================
// PENDING CHARGE OPERATIONS (token → addressHash mapping for privacy)
// =============================================================================

export interface PendingCharge {
  token: string;
  addressHash: string;
  amountUsd: number;
  chargeId: string | null;
  createdAt: string;
}

export async function createPendingCharge(
  token: string,
  addressHash: string,
  amountUsd: number
): Promise<void> {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO pending_charges (token, address_hash, amount_usd, charge_id, created_at)
    VALUES (?, ?, ?, NULL, ?)
  `).run(token, addressHash, amountUsd, now);
}

export async function setPendingChargeId(token: string, chargeId: string): Promise<void> {
  db.prepare(`UPDATE pending_charges SET charge_id = ? WHERE token = ?`).run(chargeId, token);
}

export async function getPendingChargeByToken(token: string): Promise<PendingCharge | null> {
  const row = db.prepare('SELECT * FROM pending_charges WHERE token = ?').get(token) as any;
  if (!row) return null;
  return {
    token: row.token,
    addressHash: row.address_hash,
    amountUsd: row.amount_usd,
    chargeId: row.charge_id,
    createdAt: row.created_at,
  };
}

export async function getPendingChargeByChargeId(chargeId: string): Promise<PendingCharge | null> {
  const row = db.prepare('SELECT * FROM pending_charges WHERE charge_id = ?').get(chargeId) as any;
  if (!row) return null;
  return {
    token: row.token,
    addressHash: row.address_hash,
    amountUsd: row.amount_usd,
    chargeId: row.charge_id,
    createdAt: row.created_at,
  };
}

export async function deletePendingCharge(token: string): Promise<void> {
  db.prepare('DELETE FROM pending_charges WHERE token = ?').run(token);
}
