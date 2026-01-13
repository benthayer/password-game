import { Router } from 'express';
import { getAccount } from '../storage/db.js';

export const accountRoutes = Router();

// GET /account/:addressHash
// Returns account info: storage, egress, file size
accountRoutes.get('/:addressHash', async (req, res) => {
  const { addressHash } = req.params;
  
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

