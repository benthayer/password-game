import { Router } from 'express';
import { getAccount } from '../storage/db.js';
import { requireSignature } from '../auth.js';

export const accountRoutes = Router();

// GET /account/:address
// Returns account info: storage, egress, file size.
// Signed like everything else — balances are not public.
accountRoutes.get('/:address', requireSignature, async (req, res) => {
  const addressHash = req.params.address;
  
  const account = await getAccount(addressHash);
  
  if (!account) {
    return res.json({
      gbYearsRemaining: 0,
      egressGbRemaining: 0,
      fileSize: null,
      exists: false,
      verificationMessage: `payment:${addressHash}`,
    });
  }
  
  res.json({
    gbYearsRemaining: account.gbYearsRemaining,
    egressGbRemaining: account.egressGbRemaining,
    fileSize: account.fileSize,
    exists: account.fileSize !== null,
    verificationMessage: `payment:${addressHash}`,
  });
});

