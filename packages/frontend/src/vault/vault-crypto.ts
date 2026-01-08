import CryptoJS from 'crypto-js';

/**
 * Hash password for vault operations.
 * Uses only password + suffix, no config involved.
 */
export function hashForVault(password: string[], suffix: string): string {
  const combined = password.join(':') + ':' + suffix;
  return CryptoJS.SHA256(combined).toString();
}

/**
 * Get the address hash for a password.
 * This is what the server uses to identify your storage slot.
 */
export function getAddressHash(password: string[]): string {
  return hashForVault(password, 'address');
}

/**
 * Get the encryption key for a password.
 * This never leaves the client.
 */
export function getEncryptionKey(password: string[]): string {
  return hashForVault(password, 'encryption');
}

/**
 * Encrypt data with the password-derived key.
 */
export function encrypt(data: string, password: string[]): string {
  const key = getEncryptionKey(password);
  return CryptoJS.AES.encrypt(data, key).toString();
}

/**
 * Decrypt data with the password-derived key.
 */
export function decrypt(encryptedData: string, password: string[]): string {
  const key = getEncryptionKey(password);
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

