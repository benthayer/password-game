import { getGbYearsRemaining, getEgressGbRemaining, spendEgress } from '../storage/db.js';

function isCreditCheckDisabled(): boolean {
  return process.env.DISABLE_CREDIT_CHECK === 'true';
}

function bytesToGb(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

export class CreditService {
  async canDownload(addressHash: string, fileSizeBytes: number): Promise<boolean> {
    if (isCreditCheckDisabled()) return true;
    const egressRemaining = await getEgressGbRemaining(addressHash);
    const fileSizeGb = bytesToGb(fileSizeBytes);
    return egressRemaining >= fileSizeGb;
  }

  async canUpload(addressHash: string): Promise<boolean> {
    if (isCreditCheckDisabled()) return true;
    const storageRemaining = await getGbYearsRemaining(addressHash);
    return storageRemaining > 0;
  }

  async chargeDownload(addressHash: string, fileSizeBytes: number): Promise<void> {
    if (isCreditCheckDisabled()) return;
    const fileSizeGb = bytesToGb(fileSizeBytes);
    await spendEgress(addressHash, fileSizeGb);
  }
}

