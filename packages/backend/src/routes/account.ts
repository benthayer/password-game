import { Router } from 'express';
import { getAccount, getCurrentCredits } from '../storage/db.js';

export const accountRoutes = Router();

// GET /account/:addressHash
// Returns account info: credits, file size, verification message
accountRoutes.get('/:addressHash', async (req, res) => {
  const { addressHash } = req.params;
  
  const account = await getAccount(addressHash);
  const currentCredits = await getCurrentCredits(addressHash);
  
  if (!account) {
    return res.json({
      credits: 0,
      fileSize: null,
      exists: false,
      verificationMessage: `payment:${addressHash}`,
    });
  }
  
  res.json({
    credits: currentCredits,
    fileSize: account.fileSize,
    exists: account.fileSize !== null,
    verificationMessage: `payment:${addressHash}`,
  });
});

