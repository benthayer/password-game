import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_FILE = path.join(DATA_DIR, 'accounts.json');

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

interface Database {
  accounts: Record<string, Account>;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadDb(): Promise<Database> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { accounts: {} };
  }
}

async function saveDb(db: Database): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

// =============================================================================
// ACCOUNT OPERATIONS
// =============================================================================

export async function getAccount(addressHash: string): Promise<Account | null> {
  const db = await loadDb();
  return db.accounts[addressHash] || null;
}

export async function getAllAccounts(): Promise<Account[]> {
  const db = await loadDb();
  return Object.values(db.accounts);
}

export async function addCredits(addressHash: string, amount: number): Promise<Account> {
  const db = await loadDb();
  let account = db.accounts[addressHash];
  const now = new Date().toISOString();
  
  if (!account) {
    account = {
      addressHash,
      initialCredits: 0,
      spentCredits: 0,
      fileSize: null,
      createdAt: now,
      updatedAt: now,
    };
  }
  
  account.initialCredits += amount;
  account.updatedAt = now;
  db.accounts[addressHash] = account;
  await saveDb(db);
  return account;
}

export async function spendCredits(addressHash: string, amount: number): Promise<boolean> {
  const db = await loadDb();
  const account = db.accounts[addressHash];
  
  if (!account) return false;
  
  account.spentCredits += amount;
  account.updatedAt = new Date().toISOString();
  db.accounts[addressHash] = account;
  await saveDb(db);
  return true;
}

export async function setFileSize(addressHash: string, size: number | null): Promise<void> {
  const db = await loadDb();
  let account = db.accounts[addressHash];
  const now = new Date().toISOString();
  
  if (!account) {
    account = {
      addressHash,
      initialCredits: 0,
      spentCredits: 0,
      fileSize: null,
      createdAt: now,
      updatedAt: now,
    };
  }
  
  account.fileSize = size;
  account.updatedAt = now;
  db.accounts[addressHash] = account;
  await saveDb(db);
}

export async function getCurrentCredits(addressHash: string): Promise<number> {
  const account = await getAccount(addressHash);
  if (!account) return 0;
  return account.initialCredits - account.spentCredits;
}
