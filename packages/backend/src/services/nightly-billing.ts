import { getAccountsWithFiles, billStorageSinceLastBilled } from '../storage/db.js';

/**
 * Nightly billing: bill all accounts for storage since last billed.
 * 
 * Idempotent: running multiple times only charges for new elapsed time.
 * Billing formula: max(1 GB, file_size) * days_elapsed / 365 GB-years
 * Small files are treated as 1 GB minimum for pricing.
 */
export async function runNightlyBilling(): Promise<{ processed: number; charged: number; totalDays: number }> {
  const accounts = await getAccountsWithFiles();
  let charged = 0;
  let totalDays = 0;

  for (const account of accounts) {
    const daysBilled = await billStorageSinceLastBilled(account.addressHash);
    if (daysBilled > 0) {
      charged++;
      totalDays += daysBilled;
    }
  }

  return { processed: accounts.length, charged, totalDays };
}

// Run directly if executed as script
if (import.meta.url === `file://${process.argv[1]}`) {
  runNightlyBilling()
    .then(result => {
      console.log(`Nightly billing complete: ${result.charged}/${result.processed} accounts charged (${result.totalDays.toFixed(2)} total days)`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Nightly billing failed:', err);
      process.exit(1);
    });
}

