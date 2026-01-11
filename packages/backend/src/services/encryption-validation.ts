import { createDecipheriv } from 'crypto';

// =============================================================================
// ENTROPY ANALYSIS
// =============================================================================

/**
 * Calculate Shannon entropy of a buffer.
 * Truly random/encrypted data: ~7.9-8.0 bits/byte
 * Compressed data: ~7.0-7.5 bits/byte (still high but lower)
 * Plaintext: ~4.0-5.0 bits/byte
 */
function calculateEntropy(data: Buffer): number {
  if (data.length === 0) return 0;
  
  const frequencies = new Map<number, number>();
  for (const byte of data) {
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }
  
  let entropy = 0;
  const length = data.length;
  for (const count of frequencies.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

// =============================================================================
// COMPRESSION DETECTION
// =============================================================================

const COMPRESSION_SIGNATURES = [
  { name: 'gzip', magic: [0x1f, 0x8b] },
  { name: 'zlib', magic: [0x78, 0x9c] },
  { name: 'zlib-low', magic: [0x78, 0x01] },
  { name: 'zlib-high', magic: [0x78, 0xda] },
  { name: 'bzip2', magic: [0x42, 0x5a, 0x68] },
  { name: 'xz', magic: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
  { name: 'lz4', magic: [0x04, 0x22, 0x4d, 0x18] },
  { name: 'zstd', magic: [0x28, 0xb5, 0x2f, 0xfd] },
  { name: 'zip', magic: [0x50, 0x4b, 0x03, 0x04] },
];

function detectCompression(data: Buffer): string | null {
  for (const sig of COMPRESSION_SIGNATURES) {
    if (data.length >= sig.magic.length) {
      const matches = sig.magic.every((byte, i) => data[i] === byte);
      if (matches) return sig.name;
    }
  }
  return null;
}

// =============================================================================
// BYTE DISTRIBUTION ANALYSIS
// =============================================================================

/**
 * Chi-squared test for uniform distribution.
 * Encrypted data should have very uniform byte distribution.
 * Returns p-value approximation (higher = more uniform = more likely encrypted)
 */
function chiSquaredUniformity(data: Buffer): number {
  if (data.length < 256) return 0;
  
  const observed = new Array(256).fill(0);
  for (const byte of data) {
    observed[byte]++;
  }
  
  const expected = data.length / 256;
  let chiSquared = 0;
  for (let i = 0; i < 256; i++) {
    const diff = observed[i] - expected;
    chiSquared += (diff * diff) / expected;
  }
  
  // For 255 degrees of freedom, chi-squared ~255 is "normal"
  // Very high values suggest non-uniform distribution
  // Return a normalized score (1.0 = perfectly uniform, 0.0 = very non-uniform)
  const normalized = Math.max(0, 1 - (chiSquared - 255) / 500);
  return normalized;
}

// =============================================================================
// SECONDARY KEY DECRYPTION
// =============================================================================

/**
 * Attempt to decrypt with secondary key.
 * The secondary key SHOULD decrypt successfully, revealing the inner encrypted layer.
 */
function decryptWithSecondaryKey(
  doublyEncrypted: Buffer, 
  secondaryKey: Buffer
): { success: boolean; decrypted?: Buffer; error?: string } {
  // CryptoJS AES with passphrase uses OpenSSL format:
  // "Salted__" (8 bytes) + salt (8 bytes) + ciphertext
  // But we're receiving raw bytes, not base64
  
  // Try standard AES-256-CBC with IV prepended
  try {
    if (doublyEncrypted.length < 16) {
      return { success: false, error: 'Data too short for AES' };
    }
    
    const iv = doublyEncrypted.slice(0, 16);
    const ciphertext = doublyEncrypted.slice(16);
    
    // Ensure key is 32 bytes for AES-256
    const key = secondaryKey.length >= 32 
      ? secondaryKey.slice(0, 32) 
      : Buffer.concat([secondaryKey, Buffer.alloc(32 - secondaryKey.length)]);
    
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return { success: true, decrypted };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Decryption failed' 
    };
  }
}

// =============================================================================
// KEY RANDOMNESS
// =============================================================================

function verifyKeyRandomness(key: Buffer): { valid: boolean; entropy: number; reason?: string } {
  if (key.length < 32) {
    return { valid: false, entropy: 0, reason: 'Key must be at least 32 bytes' };
  }
  
  const entropy = calculateEntropy(key);
  if (entropy < 7.0) {
    return { valid: false, entropy, reason: `Key entropy too low: ${entropy.toFixed(2)} bits/byte` };
  }
  
  // Check for obvious patterns
  const uniformity = chiSquaredUniformity(key);
  if (uniformity < 0.3) {
    return { valid: false, entropy, reason: 'Key has non-uniform byte distribution' };
  }
  
  return { valid: true, entropy };
}

// =============================================================================
// VALIDATION RESULT
// =============================================================================

export interface EncryptionValidationResult {
  // Secondary key checks
  secondaryKeyValid: boolean;
  secondaryKeyEntropy: number;
  secondaryKeyReason?: string;
  
  // Outer layer decryption
  outerDecryptionSucceeded: boolean;
  outerDecryptionError?: string;
  
  // Inner layer (after stripping outer encryption)
  innerLayerEntropy: number;
  innerLayerAppearsEncrypted: boolean;
  innerLayerCompressionDetected: string | null;
  innerLayerUniformity: number;
  
  // Final verdict
  valid: boolean;
  rejectionReason?: string;
  
  // The data to store (inner layer, if valid)
  dataToStore?: Buffer;
}

const MIN_ENCRYPTED_ENTROPY = 7.8;
const MIN_UNIFORMITY = 0.5;

/**
 * Validate doubly-encrypted upload.
 * 
 * 1. Verify secondary key is random
 * 2. Decrypt outer layer with secondary key
 * 3. Verify inner layer still appears encrypted
 * 4. Return inner layer for storage
 */
export function validateEncryption(
  doublyEncrypted: Buffer,
  secondaryKey: Buffer
): EncryptionValidationResult {
  const result: EncryptionValidationResult = {
    secondaryKeyValid: false,
    secondaryKeyEntropy: 0,
    outerDecryptionSucceeded: false,
    innerLayerEntropy: 0,
    innerLayerAppearsEncrypted: false,
    innerLayerCompressionDetected: null,
    innerLayerUniformity: 0,
    valid: false,
  };
  
  // 1. Verify secondary key randomness
  const keyCheck = verifyKeyRandomness(secondaryKey);
  result.secondaryKeyValid = keyCheck.valid;
  result.secondaryKeyEntropy = keyCheck.entropy;
  result.secondaryKeyReason = keyCheck.reason;
  
  if (!keyCheck.valid) {
    result.rejectionReason = `Secondary key invalid: ${keyCheck.reason}`;
    return result;
  }
  
  // 2. Decrypt outer layer
  const decryption = decryptWithSecondaryKey(doublyEncrypted, secondaryKey);
  result.outerDecryptionSucceeded = decryption.success;
  result.outerDecryptionError = decryption.error;
  
  if (!decryption.success || !decryption.decrypted) {
    result.rejectionReason = `Cannot decrypt outer layer: ${decryption.error}`;
    return result;
  }
  
  const innerLayer = decryption.decrypted;
  
  // 3. Check inner layer is not just compressed
  const compression = detectCompression(innerLayer);
  result.innerLayerCompressionDetected = compression;
  
  if (compression) {
    result.rejectionReason = `Inner layer appears to be ${compression} compressed, not encrypted`;
    return result;
  }
  
  // 4. Check inner layer entropy
  const innerEntropy = calculateEntropy(innerLayer);
  result.innerLayerEntropy = innerEntropy;
  
  if (innerEntropy < MIN_ENCRYPTED_ENTROPY) {
    result.rejectionReason = `Inner layer entropy too low: ${innerEntropy.toFixed(2)} (need >= ${MIN_ENCRYPTED_ENTROPY})`;
    return result;
  }
  
  // 5. Check inner layer byte distribution
  const uniformity = chiSquaredUniformity(innerLayer);
  result.innerLayerUniformity = uniformity;
  
  if (uniformity < MIN_UNIFORMITY) {
    result.rejectionReason = `Inner layer byte distribution not uniform enough: ${uniformity.toFixed(2)}`;
    return result;
  }
  
  // All checks passed
  result.innerLayerAppearsEncrypted = true;
  result.valid = true;
  result.dataToStore = innerLayer;
  
  return result;
}
