import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');

export interface AuditEntry {
  timestamp: string;
  action: string;
  adminKey: string; // last 8 chars only
  details: Record<string, unknown>;
}

export async function logAudit(
  action: string,
  adminKey: string,
  details: Record<string, unknown>
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    action,
    adminKey: adminKey.slice(-8),
    details,
  };
  
  const line = JSON.stringify(entry) + '\n';
  await fs.appendFile(AUDIT_FILE, line);
}

export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  try {
    const content = await fs.readFile(AUDIT_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((line) => JSON.parse(line)).reverse();
  } catch {
    return [];
  }
}

