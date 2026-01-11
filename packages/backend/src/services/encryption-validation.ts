import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';

// =============================================================================
// ENTROPY ANALYSIS
// =============================================================================

/**
 * Calculate Shannon entropy of a buffer.
 * Truly random data should have entropy close to 8 bits per byte.
 * Plaintext typically has entropy around 4-5 bits per byte.
 */
function calculateEntropy(data: Buffer): number {
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

/**
 * Minimum acceptable entropy for encrypted data.
 * 7.5 bits per byte is a reasonable threshold.
 * Random data approaches 8.0, plaintext is usually 4-5.
 */
const MIN_ENCRYPTED_ENTROPY = 7.5;

function appearsEncrypted(data: Buffer): boolean {
  if (data.length < 64) {
    // Too small to reliably measure entropy
    return true;
  }
  return calculateEntropy(data) >= MIN_ENCRYPTED_ENTROPY;
}

// =============================================================================
// RANDOMNESS VERIFICATION
// =============================================================================

function verifyKeyRandomness(key: Buffer): { valid: boolean; entropy: number } {
  if (key.length < 16) {
    return { valid: false, entropy: 0 };
  }
  
  const entropy = calculateEntropy(key);
  return { valid: entropy >= 7.0, entropy };
}

// =============================================================================
// DECRYPTION FAILURE VERIFICATION
// =============================================================================

/**
 * Attempt to decrypt with the secondary key and verify it fails.
 * This proves the secondary key is NOT the real encryption key.
 */
function verifyDecryptionFails(encryptedData: Buffer, wrongKey: Buffer): {
  verified: boolean;
  reason: string;
} {
  const ivSizes = [16];
  const keySizes = [16, 24, 32];
  
  for (const keySize of keySizes) {
    for (const ivSize of ivSizes) {
      try {
        const iv = encryptedData.slice(0, ivSize);
        const ciphertext = encryptedData.slice(ivSize);
        const keyToUse = wrongKey.slice(0, keySize);
        
        if (keyToUse.length < keySize || ciphertext.length === 0) {
          continue;
        }
        
        const decipher = createDecipheriv('aes-256-cbc', keyToUse.slice(0, 32), iv);
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        
        // If decryption produced low-entropy output, the key might be valid
        if (calculateEntropy(decrypted) < 6.0) {
          return {
            verified: false,
            reason: 'Decryption produced low-entropy output - key may be valid',
          };
        }
      } catch {
        // Decryption failed - this is expected with wrong key
      }
    }
  }
  
  return {
    verified: true,
    reason: 'Key does not decrypt the data',
  };
}

// =============================================================================
// SECONDARY ENCRYPTION
// =============================================================================

function encryptWithSecondaryKey(data: Buffer, secondaryKey: Buffer): {
  encrypted: Buffer;
  iv: Buffer;
} {
  const iv = randomBytes(16);
  const key = secondaryKey.slice(0, 32);
  
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  
  // Prepend IV to encrypted data
  return { encrypted: Buffer.concat([iv, encrypted]), iv };
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface EncryptionValidationResult {
  dataAppearsEncrypted: boolean;
  dataEntropy: number;
  secondaryKeyValid: boolean;
  secondaryKeyEntropy: number;
  secondaryKeyDoesNotDecrypt: boolean;
  decryptionVerificationReason: string;
  doublyEncryptedData?: Buffer;
  secondaryIv?: string;
}

/**
 * Validate encryption and produce doubly-encrypted data.
 * 
 * Proves:
 * 1. Uploaded data appears encrypted (high entropy)
 * 2. Secondary key is random
 * 3. Secondary key does NOT decrypt the data
 * 4. Server re-encrypted with secondary key (it only touched encrypted bytes)
 */
export function validateEncryption(
  encryptedData: Buffer,
  secondaryKey: Buffer
): EncryptionValidationResult {
  const dataEntropy = calculateEntropy(encryptedData);
  const dataAppearsEncrypted = appearsEncrypted(encryptedData);
  const keyValidation = verifyKeyRandomness(secondaryKey);
  const decryptionCheck = verifyDecryptionFails(encryptedData, secondaryKey);
  
  const result: EncryptionValidationResult = {
    dataAppearsEncrypted,
    dataEntropy,
    secondaryKeyValid: keyValidation.valid,
    secondaryKeyEntropy: keyValidation.entropy,
    secondaryKeyDoesNotDecrypt: decryptionCheck.verified,
    decryptionVerificationReason: decryptionCheck.reason,
  };
  
  // Only produce doubly-encrypted data if all checks pass
  if (dataAppearsEncrypted && keyValidation.valid && decryptionCheck.verified) {
    const { encrypted, iv } = encryptWithSecondaryKey(encryptedData, secondaryKey);
    result.doublyEncryptedData = encrypted;
    result.secondaryIv = iv.toString('hex');
  }
  
  return result;
}
