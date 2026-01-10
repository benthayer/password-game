import CryptoJS from 'crypto-js';
import { createHashFunction, type HashFunction } from '../hash-function';
import type { FullHashConfig } from '../hash-config';
import { DEFAULT_FULL_HASH_CONFIG } from '../hash-config';

// ============================================================
// Legacy SHA256 Functions (for grid expansion, backwards compat)
// ============================================================

/**
 * SHA256 hash for vault operations (legacy).
 * Uses only password + suffix, no config involved.
 */
export function hashForVaultLegacy(password: string[], suffix: string): string {
  const combined = password.join(':') + ':' + suffix;
  return CryptoJS.SHA256(combined).toString();
}

// ============================================================
// Configurable Hash Functions
// ============================================================

/**
 * Format password for hashing.
 * Canonical format: password words joined with colons.
 */
function formatPasswordForHash(password: string[], suffix: string): string {
  return password.join(':') + ':' + suffix;
}

/**
 * Get the address hash for a password.
 * This is what the server uses to identify your storage slot.
 */
export async function getAddressHash(
  password: string[], 
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, 'address');
  return await hashFn(input);
}

/**
 * Get the encryption key for a password.
 * This never leaves the client.
 */
export async function getEncryptionKey(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, 'encryption');
  return await hashFn(input);
}

/**
 * Encrypt data with the password-derived key.
 */
export async function encrypt(
  data: string, 
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const key = await getEncryptionKey(password, config);
  return CryptoJS.AES.encrypt(data, key).toString();
}

/**
 * Decrypt data with the password-derived key.
 */
export async function decrypt(
  encryptedData: string, 
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const key = await getEncryptionKey(password, config);
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// ============================================================
// Vault Crypto Context (for use throughout the app)
// ============================================================

/**
 * Create a vault crypto instance with a specific config.
 * This makes it easy to use the same config throughout the app.
 */
export function createVaultCrypto(config: FullHashConfig) {
  return {
    getAddressHash: (password: string[]) => getAddressHash(password, config),
    getEncryptionKey: (password: string[]) => getEncryptionKey(password, config),
    encrypt: (data: string, password: string[]) => encrypt(data, password, config),
    decrypt: (encryptedData: string, password: string[]) => decrypt(encryptedData, password, config),
    config,
  };
}

export type VaultCrypto = ReturnType<typeof createVaultCrypto>;
