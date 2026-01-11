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
// Key Derivation Suffixes
// ============================================================

const SUFFIX_ADDRESS = ':+address';
const SUFFIX_PRIMARY_KEY = ':+primary-encryption-key';
const SUFFIX_SECONDARY_KEY = ':+secondary-encryption-key';

// ============================================================
// Configurable Hash Functions
// ============================================================

/**
 * Format password for hashing.
 * Canonical format: password words joined with colons, then suffix.
 */
function formatPasswordForHash(password: string[], suffix: string): string {
  return password.join(':') + suffix;
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
  const input = formatPasswordForHash(password, SUFFIX_ADDRESS);
  return await hashFn(input);
}

/**
 * Get the primary encryption key for a password.
 * This never leaves the client - used to encrypt user data.
 */
export async function getEncryptionKey(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_PRIMARY_KEY);
  return await hashFn(input);
}

/**
 * Get the secondary encryption key for a password.
 * Sent to server for validation. Server encrypts with this, then discards.
 * Client uses this on download to strip the outer encryption layer.
 */
export async function getSecondaryKey(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_SECONDARY_KEY);
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
 * Decrypt data with the password-derived primary key.
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
// Secondary Key Operations (for download - stripping outer layer)
// ============================================================

/**
 * Decrypt outer layer with secondary key.
 * Used on download to strip the server-added encryption layer.
 * Input: doubly-encrypted binary data (IV prepended)
 * Output: singly-encrypted data (still encrypted with primary key)
 */
export async function decryptOuterLayer(
  doublyEncrypted: Uint8Array,
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const secondaryKeyHex = await getSecondaryKey(password, config);
  const secondaryKey = hexToBytes(secondaryKeyHex);
  
  // Extract IV (first 16 bytes) and ciphertext
  const iv = doublyEncrypted.slice(0, 16);
  const ciphertext = doublyEncrypted.slice(16);
  
  // Import key for Web Crypto
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secondaryKey.slice(0, 32), // Use first 32 bytes for AES-256
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    ciphertext
  );
  
  // Return as string (this is the CryptoJS-encrypted data)
  return new TextDecoder().decode(decrypted);
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
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
    getSecondaryKey: (password: string[]) => getSecondaryKey(password, config),
    encrypt: (data: string, password: string[]) => encrypt(data, password, config),
    decrypt: (encryptedData: string, password: string[]) => decrypt(encryptedData, password, config),
    decryptOuterLayer: (doublyEncrypted: Uint8Array, password: string[]) => decryptOuterLayer(doublyEncrypted, password, config),
    config,
  };
}

export type VaultCrypto = ReturnType<typeof createVaultCrypto>;
