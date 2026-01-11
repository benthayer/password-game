import { createCipheriv, createHash, randomBytes } from 'crypto';
import { Transform, TransformCallback } from 'stream';
import { StreamingStats } from './streaming-stats.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_TEST_SCORE = 0.3;
const MIN_ENCRYPTED_ENTROPY = 5.0;
const MIN_UNIFORMITY = 0.4;

// =============================================================================
// ENTROPY THRESHOLD (for key validation - small buffers)
// =============================================================================

function getMinEntropyThreshold(sampleSize: number): number {
  if (sampleSize >= 1024) return 7.5;
  if (sampleSize >= 256) return 7.0;
  if (sampleSize >= 64) return 5.5;
  if (sampleSize >= 32) return 4.5;
  return 3.5;
}

// =============================================================================
// KEY VALIDATION (still uses buffer - keys are small)
// =============================================================================

interface RandomnessCheckResult {
  looksRandom: boolean;
  entropy: number;
  monobit: number;
  runs: number;
  correlation: number;
  uniformity: number;
  longestRun: number;
  patternDetected: string | null;
  reason?: string;
}

/**
 * Verify key looks like valid cryptographic output.
 * Uses StreamingStats internally but operates on small buffer.
 */
export function verifyKeyRandomness(key: Buffer): RandomnessCheckResult & { valid: boolean } {
  if (key.length < 32) {
    return {
      valid: false,
      looksRandom: false,
      entropy: 0,
      monobit: 0,
      runs: 0,
      correlation: 0,
      uniformity: 0,
      longestRun: 0,
      patternDetected: null,
      reason: 'Key must be at least 32 bytes',
    };
  }
  
  const stats = new StreamingStats();
  stats.pushBuffer(key);
  
  const result: RandomnessCheckResult = {
    looksRandom: false,
    entropy: stats.getEntropy(),
    monobit: stats.getMonobit(),
    runs: stats.getRuns(),
    correlation: stats.getCorrelation(),
    uniformity: stats.getChiSquared(),
    longestRun: stats.getLongestRun(),
    patternDetected: null,
  };
  
  // Pattern detection
  const patternCheck = stats.getPatternResult();
  if (!patternCheck.pass) {
    result.patternDetected = patternCheck.pattern!;
    result.reason = `Obvious pattern detected: ${patternCheck.pattern}`;
    return { ...result, valid: false };
  }
  
  // Entropy check
  const minEntropy = getMinEntropyThreshold(key.length);
  if (result.entropy < minEntropy) {
    result.reason = `Entropy too low: ${result.entropy.toFixed(2)} bits/byte (need >= ${minEntropy})`;
    return { ...result, valid: false };
  }
  
  // Monobit test
  if (result.monobit < MIN_TEST_SCORE) {
    result.reason = `Monobit test failed: ${result.monobit.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return { ...result, valid: false };
  }
  
  // Runs test
  if (result.runs < MIN_TEST_SCORE) {
    result.reason = `Runs test failed: ${result.runs.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return { ...result, valid: false };
  }
  
  // Correlation test
  if (result.correlation < MIN_TEST_SCORE) {
    result.reason = `Serial correlation too high: ${result.correlation.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return { ...result, valid: false };
  }
  
  // Chi-squared uniformity (skip for small data)
  if (key.length >= 256 && result.uniformity < MIN_TEST_SCORE) {
    result.reason = `Byte distribution not uniform: ${result.uniformity.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return { ...result, valid: false };
  }
  
  // Longest run test
  if (result.longestRun < MIN_TEST_SCORE) {
    result.reason = `Longest run test failed: ${result.longestRun.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return { ...result, valid: false };
  }
  
  result.looksRandom = true;
  return { ...result, valid: true };
}

// =============================================================================
// INPUT STATS VALIDATION (streaming)
// =============================================================================

export interface InputValidationResult {
  valid: boolean;
  entropy: number;
  uniformity: number;
  compressionDetected: string | null;
  reason?: string;
}

/**
 * Check if input data appears to be encrypted based on streaming stats.
 */
export function checkInputStats(stats: StreamingStats): InputValidationResult {
  const result: InputValidationResult = {
    valid: false,
    entropy: stats.getEntropy(),
    uniformity: stats.getChiSquared(),
    compressionDetected: stats.getCompressionSignature(),
  };
  
  // Check for compression signatures
  if (result.compressionDetected) {
    result.reason = `Appears to be ${result.compressionDetected} compressed`;
    return result;
  }
  
  // Check entropy
  if (result.entropy < MIN_ENCRYPTED_ENTROPY) {
    result.reason = `Entropy too low: ${result.entropy.toFixed(2)} (need >= ${MIN_ENCRYPTED_ENTROPY})`;
    return result;
  }
  
  // Check byte distribution (skip for small data)
  if (stats.getTotalBytes() >= 256 && result.uniformity < MIN_UNIFORMITY) {
    result.reason = `Byte distribution not uniform: ${result.uniformity.toFixed(2)}`;
    return result;
  }
  
  result.valid = true;
  return result;
}

// =============================================================================
// DECRYPTED OUTPUT VALIDATION (streaming)
// =============================================================================

export interface DecryptedOutputValidationResult {
  looksEncrypted: boolean;
  entropy: number;
  uniformity: number;
  reason?: string;
}

/**
 * Check if decrypted output still looks encrypted (for padding collision detection).
 */
export function checkDecryptedStats(stats: StreamingStats): DecryptedOutputValidationResult {
  const result: DecryptedOutputValidationResult = {
    looksEncrypted: false,
    entropy: stats.getEntropy(),
    uniformity: stats.getChiSquared(),
  };
  
  // Check entropy
  if (result.entropy < MIN_ENCRYPTED_ENTROPY) {
    result.reason = `Entropy too low: ${result.entropy.toFixed(2)} (need >= ${MIN_ENCRYPTED_ENTROPY})`;
    return result;
  }
  
  // Check byte distribution (skip for small data)
  if (stats.getTotalBytes() >= 256 && result.uniformity < MIN_UNIFORMITY) {
    result.reason = `Byte distribution not uniform: ${result.uniformity.toFixed(2)}`;
    return result;
  }
  
  result.looksEncrypted = true;
  return result;
}

// =============================================================================
// ENCRYPTION STREAM (for server-side encryption layer)
// =============================================================================

/**
 * Create a Transform stream that encrypts data with the secondary key.
 * Prepends IV to output.
 */
export function createEncryptionStream(secondaryKey: Buffer): { stream: Transform; iv: Buffer } {
  const iv = randomBytes(16);
  const key = secondaryKey.length >= 32 
    ? secondaryKey.slice(0, 32) 
    : Buffer.concat([secondaryKey, Buffer.alloc(32 - secondaryKey.length)]);
  
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  
  // Create a transform that prepends IV then pipes through cipher
  let ivWritten = false;
  const encryptionStream = new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      if (!ivWritten) {
        this.push(iv);
        ivWritten = true;
      }
      // Pass through cipher
      const encrypted = cipher.update(chunk);
      callback(null, encrypted);
    },
    flush(callback: TransformCallback) {
      try {
        const final = cipher.final();
        callback(null, final);
      } catch (err) {
        callback(err as Error);
      }
    }
  });
  
  return { stream: encryptionStream, iv };
}

// =============================================================================
// VALIDATION RESULT TYPE (updated - no dataToStore buffer)
// =============================================================================

export interface EncryptionValidationResult {
  // Secondary key randomness checks
  secondaryKeyValid: boolean;
  secondaryKeyRandomness: {
    entropy: number;
    monobit: number;
    runs: number;
    correlation: number;
    uniformity: number;
    longestRun: number;
    patternDetected: string | null;
  };
  secondaryKeyReason?: string;
  
  // Input data checks
  inputDataEntropy: number;
  inputDataAppearsEncrypted: boolean;
  inputDataCompressionDetected: string | null;
  inputDataUniformity: number;
  
  // Secondary key decryption attempt
  secondaryKeyDecryptionFailed: boolean;
  secondaryKeyDecryptionFormat?: string;
  
  // Final verdict
  valid: boolean;
  rejectionReason?: string;
}

/**
 * Build validation result from individual check results.
 */
export function buildValidationResult(
  keyCheck: ReturnType<typeof verifyKeyRandomness>,
  inputCheck: InputValidationResult,
  decryptAttemptSucceeded: boolean,
  decryptFormat: string | undefined,
  decryptedOutputCheck: DecryptedOutputValidationResult | null
): EncryptionValidationResult {
  const result: EncryptionValidationResult = {
    secondaryKeyValid: keyCheck.valid,
    secondaryKeyRandomness: {
      entropy: keyCheck.entropy,
      monobit: keyCheck.monobit,
      runs: keyCheck.runs,
      correlation: keyCheck.correlation,
      uniformity: keyCheck.uniformity,
      longestRun: keyCheck.longestRun,
      patternDetected: keyCheck.patternDetected,
    },
    secondaryKeyReason: keyCheck.reason,
    inputDataEntropy: inputCheck.entropy,
    inputDataAppearsEncrypted: inputCheck.valid,
    inputDataCompressionDetected: inputCheck.compressionDetected,
    inputDataUniformity: inputCheck.uniformity,
    secondaryKeyDecryptionFailed: true,
    secondaryKeyDecryptionFormat: decryptFormat,
    valid: false,
  };
  
  // Check secondary key
  if (!keyCheck.valid) {
    result.rejectionReason = `Secondary key failed randomness check: ${keyCheck.reason}`;
    return result;
  }
  
  // Check input data
  if (!inputCheck.valid) {
    result.rejectionReason = `Input data doesn't appear encrypted: ${inputCheck.reason}`;
    return result;
  }
  
  // Check decryption attempt
  if (decryptAttemptSucceeded && decryptedOutputCheck) {
    if (decryptedOutputCheck.looksEncrypted) {
      // Output still looks encrypted - probably padding collision, this is fine
      result.secondaryKeyDecryptionFailed = true;
    } else {
      // Output is plaintext - secondary key actually decrypted the data
      result.secondaryKeyDecryptionFailed = false;
      result.rejectionReason = `Secondary key decrypted the data to plaintext (format: ${decryptFormat}, output: ${decryptedOutputCheck.reason}) - client must use different key for primary encryption`;
      return result;
    }
  }
  
  result.valid = true;
  return result;
}

// =============================================================================
// EVP_BytesToKey (exported for SecureTempFile)
// =============================================================================

export function evpBytesToKey(
  password: Buffer, 
  salt: Buffer, 
  keyLen: number, 
  ivLen: number
): { key: Buffer; iv: Buffer } {
  const totalLen = keyLen + ivLen;
  const result: Buffer[] = [];
  let resultLen = 0;
  let prev = Buffer.alloc(0);
  
  while (resultLen < totalLen) {
    const hash = createHash('md5');
    hash.update(prev);
    hash.update(password);
    hash.update(salt);
    prev = hash.digest();
    result.push(prev);
    resultLen += prev.length;
  }
  
  const derived = Buffer.concat(result);
  return {
    key: derived.slice(0, keyLen),
    iv: derived.slice(keyLen, keyLen + ivLen),
  };
}
