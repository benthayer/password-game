import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_FILE = path.join(DATA_DIR, 'accounts.db');

// =============================================================================
// TYPES
// =============================================================================

export interface Account {
  addressHash: string;
  initialCredits: number;
  spentCredits: number;
  fileSize: number | null;
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

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    address_hash TEXT PRIMARY KEY,
    initial_credits INTEGER DEFAULT 0,
    spent_credits INTEGER DEFAULT 0,
    file_size INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

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

// =============================================================================
// HELPERS
// =============================================================================

function rowToAccount(row: any): Account {
  return {
    addressHash: row.address_hash,
    initialCredits: row.initial_credits,
    spentCredits: row.spent_credits,
    fileSize: row.file_size,
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

export async function addCredits(addressHash: string, amount: number): Promise<Account> {
  const now = new Date().toISOString();
  
  const existing = db.prepare('SELECT * FROM accounts WHERE address_hash = ?').get(addressHash);
  
  if (existing) {
    db.prepare(`
      UPDATE accounts 
      SET initial_credits = initial_credits + ?, updated_at = ?
      WHERE address_hash = ?
    `).run(amount, now, addressHash);
  } else {
    db.prepare(`
      INSERT INTO accounts (address_hash, initial_credits, spent_credits, file_size, created_at, updated_at)
      VALUES (?, ?, 0, NULL, ?, ?)
    `).run(addressHash, amount, now, now);
  }
  
  return (await getAccount(addressHash))!;
}

export async function spendCredits(addressHash: string, amount: number): Promise<boolean> {
  const result = db.prepare(`
    UPDATE accounts 
    SET spent_credits = spent_credits + ?, updated_at = ?
    WHERE address_hash = ?
  `).run(amount, new Date().toISOString(), addressHash);
  
  return result.changes > 0;
}

export async function setFileSize(addressHash: string, size: number | null): Promise<void> {
  const now = new Date().toISOString();
  
  const existing = db.prepare('SELECT * FROM accounts WHERE address_hash = ?').get(addressHash);
  
  if (existing) {
    db.prepare(`
      UPDATE accounts SET file_size = ?, updated_at = ? WHERE address_hash = ?
    `).run(size, now, addressHash);
  } else {
    db.prepare(`
      INSERT INTO accounts (address_hash, initial_credits, spent_credits, file_size, created_at, updated_at)
      VALUES (?, 0, 0, ?, ?, ?)
    `).run(addressHash, size, now, now);
  }
}

export async function getCurrentCredits(addressHash: string): Promise<number> {
  const account = await getAccount(addressHash);
  if (!account) return 0;
  return account.initialCredits - account.spentCredits;
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
