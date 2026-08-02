/**
 * Full-stack round trip: derive keys → signed upload → signed download →
 * decrypt → signed delete, through the real backend and blob storage.
 *
 * Requires a running backend and only executes when VITE_API_URL is set:
 *   (backend) DATA_DIR=/tmp/pwgame-it PORT=3199 npx tsx src/index.ts
 *   (here)    VITE_API_URL=http://localhost:3199 npx vitest run src/vault/vault-roundtrip.integration.test.ts
 *
 * Credits must be granted to the derived address out-of-band (sqlite insert)
 * before the download step; see scripts/grant-test-credits.sh usage in repo docs.
 */

import { describe, it, expect } from 'vitest';
import { getSigningKeys, getSecondaryKey, encryptFile, decryptDownloadedFile } from './vault-crypto-streaming';
import { getAccountInfo, getBlob, setBlob, deleteBlob } from './vault-api';
import type { FullHashConfig } from '../hash-config';
import { execSync } from 'node:child_process';

const PASSWORD = ['round', 'trip', 'integration', 'test'];

const TEST_CONFIG: FullHashConfig = {
  algorithmConfig: { algorithm: 'argon2id', memoryCost: 1024, timeCost: 1, parallelism: 1 },
  includeSalt: false,
  salt: '',
};

const DB_PATH = process.env.PWGAME_TEST_DB;

function grantCredits(address: string): void {
  if (!DB_PATH) throw new Error('PWGAME_TEST_DB not set');
  const now = new Date().toISOString();
  execSync(`sqlite3 ${DB_PATH} "INSERT OR REPLACE INTO accounts
    (address_hash, gb_years_remaining, egress_gb_remaining, file_size, created_at, updated_at)
    VALUES ('${address}', 1, 1, NULL, '${now}', '${now}');"`);
}

describe.runIf(!!import.meta.env.VITE_API_URL)('vault full round trip', () => {
  it('uploads, downloads, decrypts, and deletes through the live backend', async () => {
    const signing = await getSigningKeys(PASSWORD, TEST_CONFIG);
    const secondaryKey = await getSecondaryKey(PASSWORD, TEST_CONFIG);
    const keys = { address: signing.address, signingSecretKeyHex: signing.signingSecretKeyHex };

    grantCredits(keys.address);

    // Fresh account: credits visible, no file
    const before = await getAccountInfo(keys);
    expect(before.exists).toBe(false);
    expect(before.gbYearsRemaining).toBe(1);
    expect(before.verificationMessage).toBe(`payment:${keys.address}`);

    // Encrypt client-side and upload via signed PUT
    const content = `vault round trip ${'x'.repeat(100_000)}`;
    const file = new File([content], 'roundtrip.txt', { type: 'text/plain' });
    const encrypted = await encryptFile(file, PASSWORD, TEST_CONFIG);
    await setBlob(keys, encrypted, secondaryKey);

    const after = await getAccountInfo(keys);
    expect(after.exists).toBe(true);
    expect(after.fileSize).toBeGreaterThan(content.length);

    // Signed download, strip server layer with secondary key, decrypt with primary
    const downloaded = await getBlob(keys);
    expect(downloaded).not.toBeNull();
    const decrypted = await decryptDownloadedFile(new Uint8Array(downloaded!), PASSWORD, TEST_CONFIG);
    expect(decrypted.metadata.filename).toBe('roundtrip.txt');
    expect(new TextDecoder().decode(decrypted.content)).toBe(content);

    // Signed delete, then confirm gone
    await deleteBlob(keys);
    const gone = await getBlob(keys);
    expect(gone).toBeNull();
  }, 120_000);
});
