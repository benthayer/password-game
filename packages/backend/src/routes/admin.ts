import { Router, Request, Response, NextFunction } from 'express';
import { getAccount, getAllAccounts, grantStorageAndEgressFromPayment } from '../storage/db.js';

export const adminRoutes = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-secret';

// =============================================================================
// MIDDLEWARE
// =============================================================================

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// =============================================================================
// ROUTES
// =============================================================================

// GET /admin/accounts - List all accounts
adminRoutes.get('/accounts', requireAdmin, async (req, res) => {
  const accounts = await getAllAccounts();
  res.json({ accounts });
});

// GET /admin/accounts/:addressHash - Get single account
adminRoutes.get('/accounts/:addressHash', requireAdmin, async (req, res) => {
  const { addressHash } = req.params;
  const account = await getAccount(addressHash);
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  res.json(account);
});

// POST /admin/credits - Add credits to account (grants storage + egress)
adminRoutes.post('/credits', requireAdmin, async (req, res) => {
  const { addressHash, amount } = req.body;
  
  if (!addressHash || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Missing addressHash or amount' });
  }
  
  const account = await grantStorageAndEgressFromPayment(addressHash, amount);
  res.json({ success: true, account });
});
