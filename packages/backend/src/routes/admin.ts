import { Router, Request, Response, NextFunction } from 'express';
import { getAccount, getAllAccounts, grantStorageAndEgressFromPayment } from '../storage/db.js';
import { logAudit, getAuditLog } from '../storage/audit.js';

export const adminRoutes = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-secret';

// =============================================================================
// MIDDLEWARE
// =============================================================================

function getAdminKey(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = getAdminKey(req);
  if (key !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// =============================================================================
// ROUTES
// =============================================================================

// GET /admin/accounts - List all accounts
adminRoutes.get('/accounts', requireAdmin, async (req, res) => {
  const key = getAdminKey(req)!;
  
  const accounts = await getAllAccounts();
  
  await logAudit('list_accounts', key, { count: accounts.length });
  
  res.json({ accounts });
});

// GET /admin/accounts/:addressHash - Get single account
adminRoutes.get('/accounts/:addressHash', requireAdmin, async (req, res) => {
  const key = getAdminKey(req)!;
  const { addressHash } = req.params;
  
  const account = await getAccount(addressHash);
  
  await logAudit('get_account', key, { addressHash, found: !!account });
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  res.json(account);
});

// POST /admin/credits - Add credits to account (grants storage + egress)
adminRoutes.post('/credits', requireAdmin, async (req, res) => {
  const key = getAdminKey(req)!;
  const { addressHash, amount } = req.body;
  
  if (!addressHash || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Missing addressHash or amount' });
  }
  
  const account = await grantStorageAndEgressFromPayment(addressHash, amount);
  
  await logAudit('add_credits', key, { addressHash, amount });
  
  res.json({ success: true, account });
});

// GET /admin/audit - Get audit log
adminRoutes.get('/audit', requireAdmin, async (req, res) => {
  const key = getAdminKey(req)!;
  const limit = parseInt(req.query.limit as string) || 100;
  
  const entries = await getAuditLog(limit);
  
  await logAudit('view_audit', key, { limit });
  
  res.json({ entries });
});
