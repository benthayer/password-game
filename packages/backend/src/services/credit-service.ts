import { getCurrentCredits, spendCredits } from '../storage/db.js';

const DOWNLOAD_COST = 1;

export class CreditService {
  async canUpload(addressHash: string): Promise<boolean> {
    const credits = await getCurrentCredits(addressHash);
    return credits > 0;
  }

  async canDownload(addressHash: string): Promise<boolean> {
    const credits = await getCurrentCredits(addressHash);
    return credits > 0;
  }

  async chargeDownload(addressHash: string): Promise<void> {
    await spendCredits(addressHash, DOWNLOAD_COST);
  }
}

