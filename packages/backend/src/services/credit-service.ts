import { getCurrentCredits, spendCredits } from '../storage/db.js';

const DOWNLOAD_COST = 1;
const CREDIT_CHECK_DISABLED = process.env.DISABLE_CREDIT_CHECK === 'true';

export class CreditService {
  async canDownload(addressHash: string): Promise<boolean> {
    if (CREDIT_CHECK_DISABLED) return true;
    const credits = await getCurrentCredits(addressHash);
    return credits > 0;
  }

  async canUpload(addressHash: string): Promise<boolean> {
    if (CREDIT_CHECK_DISABLED) return true;
    const credits = await getCurrentCredits(addressHash);
    return credits > 0;
  }

  async chargeDownload(addressHash: string): Promise<void> {
    if (CREDIT_CHECK_DISABLED) return;
    await spendCredits(addressHash, DOWNLOAD_COST);
  }
}

