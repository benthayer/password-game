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
