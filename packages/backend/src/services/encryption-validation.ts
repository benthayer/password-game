import { createDecipheriv, createCipheriv, createHash, randomBytes } from 'crypto';

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
// RANDOMNESS TESTS (NIST SP 800-22 inspired)
// =============================================================================

/**
 * Chi-squared test for uniform byte distribution.
 * Random data should have very uniform byte distribution.
 * Returns a normalized score (1.0 = perfectly uniform, 0.0 = very non-uniform)
 */
function chiSquaredUniformity(data: Buffer): number {
  if (data.length < 256) return 1; // Can't meaningfully test small data
  
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
  const normalized = Math.max(0, 1 - (chiSquared - 255) / 500);
  return normalized;
}

/**
 * Monobit/Frequency test (NIST SP 800-22).
 * Count of 1 bits should be approximately n/2.
 * Returns p-value approximation (higher = more random).
 */
function monobitTest(data: Buffer): number {
  let ones = 0;
  for (const byte of data) {
    // Count bits in each byte
    let b = byte;
    while (b) {
      ones += b & 1;
      b >>= 1;
    }
  }
  
  const totalBits = data.length * 8;
  const expected = totalBits / 2;
  const deviation = Math.abs(ones - expected);
  
  // Normalize: 0 deviation = 1.0, large deviation = 0.0
  // For random data, deviation should be within ~sqrt(n)/2
  const expectedDeviation = Math.sqrt(totalBits) / 2;
  const normalized = Math.max(0, 1 - (deviation / (3 * expectedDeviation)));
  
  return normalized;
}

/**
 * Runs test - check for runs of consecutive identical bits.
 * Too few or too many runs indicates non-randomness.
 */
function runsTest(data: Buffer): number {
  if (data.length < 4) return 1; // Can't meaningfully test
  
  // Convert to bit array
  const bits: number[] = [];
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  
  // Count runs
  let runs = 1;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] !== bits[i - 1]) runs++;
  }
  
  // Expected runs for random data: (2 * n * p * q) + 1 where p = q = 0.5
  // So expected = n/2 + 1
  const n = bits.length;
  const expectedRuns = n / 2 + 1;
  const variance = (n - 1) / 4; // Approximate variance
  
  const deviation = Math.abs(runs - expectedRuns);
  const stdDev = Math.sqrt(variance);
  
  // Normalize: within 2 std devs = good
  const normalized = Math.max(0, 1 - (deviation / (3 * stdDev)));
  
  return normalized;
}

/**
 * Serial correlation test - check if consecutive bytes are correlated.
 * For random data, correlation should be near 0.
 */
function serialCorrelation(data: Buffer): number {
  if (data.length < 10) return 1; // Can't meaningfully test
  
  const n = data.length;
  let sumXY = 0;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  
  for (let i = 0; i < n - 1; i++) {
    const x = data[i];
    const y = data[i + 1];
    sumXY += x * y;
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
  }
  
  const pairs = n - 1;
  const numerator = pairs * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (pairs * sumX2 - sumX * sumX) * (pairs * sumY2 - sumY * sumY)
  );
  
  if (denominator === 0) return 1;
  
  const correlation = Math.abs(numerator / denominator);
  
  // For random data, correlation should be near 0
  // Normalize: 0 correlation = 1.0, high correlation = 0.0
  return Math.max(0, 1 - correlation * 3);
}

/**
 * Check for repeating patterns.
 * Detects if the data has obvious repeating sequences.
 */
function patternTest(data: Buffer): { pass: boolean; pattern?: string } {
  if (data.length < 8) return { pass: true };
  
  // Check for all same byte
  const firstByte = data[0];
  if (data.every(b => b === firstByte)) {
    return { pass: false, pattern: `all-same-byte-0x${firstByte.toString(16)}` };
  }
  
  // Check for incrementing/decrementing
  let incrementing = true;
  let decrementing = true;
  for (let i = 1; i < data.length && (incrementing || decrementing); i++) {
    if (data[i] !== (data[i - 1] + 1) % 256) incrementing = false;
    if (data[i] !== (data[i - 1] - 1 + 256) % 256) decrementing = false;
  }
  if (incrementing) return { pass: false, pattern: 'incrementing' };
  if (decrementing) return { pass: false, pattern: 'decrementing' };
  
  // Check for short repeating patterns (1-4 bytes)
  for (let patternLen = 1; patternLen <= 4; patternLen++) {
    if (data.length < patternLen * 3) continue; // Need at least 3 repetitions
    
    const pattern = data.slice(0, patternLen);
    let matches = true;
    for (let i = patternLen; i < data.length && matches; i++) {
      if (data[i] !== pattern[i % patternLen]) matches = false;
    }
    if (matches) {
      return { pass: false, pattern: `repeating-${patternLen}-bytes` };
    }
  }
  
  return { pass: true };
}

/**
 * Longest run test - check for unusually long runs of 0 or 1 bits.
 */
function longestRunTest(data: Buffer): number {
  if (data.length < 4) return 1;
  
  let maxRun = 0;
  let currentRun = 0;
  let lastBit = -1;
  
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) {
      const bit = (byte >> i) & 1;
      if (bit === lastBit) {
        currentRun++;
        maxRun = Math.max(maxRun, currentRun);
      } else {
        currentRun = 1;
        lastBit = bit;
      }
    }
  }
  
  // For n random bits, expected longest run is approximately log2(n)
  const totalBits = data.length * 8;
  const expectedLongestRun = Math.log2(totalBits);
  
  // Allow up to 2x expected (with some buffer)
  const threshold = expectedLongestRun * 2.5;
  
  if (maxRun > threshold) {
    return Math.max(0, 1 - (maxRun - threshold) / threshold);
  }
  
  return 1;
}

// =============================================================================
// COMPREHENSIVE RANDOMNESS CHECK
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

const MIN_TEST_SCORE = 0.3; // Minimum score for individual tests

/**
 * Calculate expected max entropy for a given sample size.
 * For small samples, the theoretical max is lower because you can't observe
 * all 256 byte values with meaningful frequency.
 * 
 * For n bytes with all unique values: entropy = log2(n)
 * We use 90% of theoretical max as a reasonable threshold.
 */
function getMinEntropyThreshold(sampleSize: number): number {
  if (sampleSize >= 1024) return 7.5;   // Large samples should be near 8 bits
  if (sampleSize >= 256) return 7.0;    // Medium samples
  if (sampleSize >= 64) return 5.5;     // Small samples
  if (sampleSize >= 32) return 4.5;     // Key-sized samples (32 bytes = log2(32) = 5 max)
  return 3.5;                           // Very small samples
}

/**
 * Comprehensive randomness check - runs multiple statistical tests.
 * Used for validating cryptographic key material.
 */
function checkLooksRandom(data: Buffer): RandomnessCheckResult {
  const result: RandomnessCheckResult = {
    looksRandom: false,
    entropy: 0,
    monobit: 0,
    runs: 0,
    correlation: 0,
    uniformity: 0,
    longestRun: 0,
    patternDetected: null,
  };
  
  // 1. Pattern detection (fast fail)
  const patternCheck = patternTest(data);
  if (!patternCheck.pass) {
    result.patternDetected = patternCheck.pattern!;
    result.reason = `Obvious pattern detected: ${patternCheck.pattern}`;
    return result;
  }
  
  // 2. Entropy check (threshold depends on sample size)
  result.entropy = calculateEntropy(data);
  const minEntropy = getMinEntropyThreshold(data.length);
  if (result.entropy < minEntropy) {
    result.reason = `Entropy too low: ${result.entropy.toFixed(2)} bits/byte (need >= ${minEntropy} for ${data.length} byte sample)`;
    return result;
  }
  
  // 3. Monobit test
  result.monobit = monobitTest(data);
  if (result.monobit < MIN_TEST_SCORE) {
    result.reason = `Monobit test failed: ${result.monobit.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return result;
  }
  
  // 4. Runs test
  result.runs = runsTest(data);
  if (result.runs < MIN_TEST_SCORE) {
    result.reason = `Runs test failed: ${result.runs.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return result;
  }
  
  // 5. Serial correlation test
  result.correlation = serialCorrelation(data);
  if (result.correlation < MIN_TEST_SCORE) {
    result.reason = `Serial correlation too high: ${result.correlation.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return result;
  }
  
  // 6. Chi-squared uniformity (for larger data)
  if (data.length >= 256) {
    result.uniformity = chiSquaredUniformity(data);
    if (result.uniformity < MIN_TEST_SCORE) {
      result.reason = `Byte distribution not uniform: ${result.uniformity.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
      return result;
    }
  } else {
    result.uniformity = 1; // Skip for small data
  }
  
  // 7. Longest run test
  result.longestRun = longestRunTest(data);
  if (result.longestRun < MIN_TEST_SCORE) {
    result.reason = `Longest run test failed: ${result.longestRun.toFixed(2)} (need >= ${MIN_TEST_SCORE})`;
    return result;
  }
  
  result.looksRandom = true;
  return result;
}

// =============================================================================
// ENCRYPTION APPEARANCE CHECK
// =============================================================================

// Note: CryptoJS outputs base64, which has max ~6 bits/byte (log2(64) = 6)
// Actual encrypted base64 typically shows ~5.8-5.95 bits/byte
const MIN_ENCRYPTED_ENTROPY = 5.0;
const MIN_UNIFORMITY = 0.4;

interface EncryptionCheckResult {
  looksEncrypted: boolean;
  entropy: number;
  uniformity: number;
  compressionDetected: string | null;
  reason?: string;
}

/**
 * Check if data appears to be encrypted.
 * Returns detailed results about why or why not.
 */
function checkLooksEncrypted(data: Buffer): EncryptionCheckResult {
  const result: EncryptionCheckResult = {
    looksEncrypted: false,
    entropy: 0,
    uniformity: 0,
    compressionDetected: null,
  };
  
  // Check for compression signatures
  result.compressionDetected = detectCompression(data);
  if (result.compressionDetected) {
    result.reason = `Appears to be ${result.compressionDetected} compressed`;
    return result;
  }
  
  // Check entropy
  result.entropy = calculateEntropy(data);
  if (result.entropy < MIN_ENCRYPTED_ENTROPY) {
    result.reason = `Entropy too low: ${result.entropy.toFixed(2)} (need >= ${MIN_ENCRYPTED_ENTROPY})`;
    return result;
  }
  
  // Check byte distribution (skip for small data)
  if (data.length >= 256) {
    result.uniformity = chiSquaredUniformity(data);
    if (result.uniformity < MIN_UNIFORMITY) {
      result.reason = `Byte distribution not uniform: ${result.uniformity.toFixed(2)}`;
      return result;
    }
  } else {
    result.uniformity = 1; // Skip check for small data
  }
  
  result.looksEncrypted = true;
  return result;
}

// =============================================================================
// KEY VALIDATION
// =============================================================================

/**
 * Verify key looks like valid cryptographic output.
 * Runs comprehensive randomness tests.
 */
function verifyKeyRandomness(key: Buffer): RandomnessCheckResult & { valid: boolean } {
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
  
  const randomnessCheck = checkLooksRandom(key);
  return {
    ...randomnessCheck,
    valid: randomnessCheck.looksRandom,
  };
}

// =============================================================================
// DECRYPTION ATTEMPTS
// =============================================================================

/**
 * EVP_BytesToKey - OpenSSL's key derivation function used by CryptoJS.
 * Derives key and IV from password + salt using MD5 iterations.
 */
function evpBytesToKey(
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

/**
 * Attempt to decrypt as raw AES-CBC (IV || ciphertext format).
 * Returns decrypted data if successful, null otherwise.
 */
function attemptDecryptRawAES(encrypted: Buffer, key: Buffer): Buffer | null {
  try {
    if (encrypted.length < 32) return null; // Need at least IV + 1 block
    
    const iv = encrypted.slice(0, 16);
    const ciphertext = encrypted.slice(16);
    
    const aesKey = key.length >= 32 
      ? key.slice(0, 32) 
      : Buffer.concat([key, Buffer.alloc(32 - key.length)]);
    
    const decipher = createDecipheriv('aes-256-cbc', aesKey, iv);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Attempt to decrypt as CryptoJS/OpenSSL format.
 * Format: "Salted__" (8 bytes) + salt (8 bytes) + ciphertext
 * Returns decrypted data if successful, null otherwise.
 */
function attemptDecryptCryptoJS(encrypted: Buffer, passphrase: Buffer): Buffer | null {
  try {
    // Check for "Salted__" magic header
    const magic = encrypted.slice(0, 8).toString('utf8');
    if (magic !== 'Salted__') return null;
    
    if (encrypted.length < 32) return null; // Need header + salt + at least 1 block
    
    const salt = encrypted.slice(8, 16);
    const ciphertext = encrypted.slice(16);
    
    // Derive key and IV using EVP_BytesToKey (AES-256-CBC: 32-byte key, 16-byte IV)
    const { key, iv } = evpBytesToKey(passphrase, salt, 32, 16);
    
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted;
  } catch {
    return null;
  }
}

interface DecryptAttemptResult {
  succeeded: boolean;
  format?: string;
  decrypted?: Buffer;
}

/**
 * Attempt to decrypt with secondary key using multiple formats.
 * Returns the decrypted data if any format succeeds.
 */
function attemptDecrypt(encrypted: Buffer, secondaryKey: Buffer): DecryptAttemptResult {
  // Try raw AES-CBC (IV || ciphertext)
  let decrypted = attemptDecryptRawAES(encrypted, secondaryKey);
  if (decrypted) {
    return { succeeded: true, format: 'raw-aes-cbc', decrypted };
  }
  
  // Try CryptoJS/OpenSSL format with key as raw bytes
  decrypted = attemptDecryptCryptoJS(encrypted, secondaryKey);
  if (decrypted) {
    return { succeeded: true, format: 'cryptojs-raw', decrypted };
  }
  
  // Try CryptoJS/OpenSSL format with key as hex string (passphrase)
  const keyAsHex = secondaryKey.toString('hex');
  decrypted = attemptDecryptCryptoJS(encrypted, Buffer.from(keyAsHex, 'utf8'));
  if (decrypted) {
    return { succeeded: true, format: 'cryptojs-hex-passphrase', decrypted };
  }
  
  // All decryption attempts failed
  return { succeeded: false };
}

// =============================================================================
// ENCRYPTION (server adds outer layer)
// =============================================================================

/**
 * Encrypt data with secondary key.
 * Format: IV (16 bytes) || ciphertext
 */
function encryptWithSecondaryKey(data: Buffer, secondaryKey: Buffer): Buffer {
  const iv = randomBytes(16);
  const key = secondaryKey.length >= 32 
    ? secondaryKey.slice(0, 32) 
    : Buffer.concat([secondaryKey, Buffer.alloc(32 - secondaryKey.length)]);
  
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  // Prepend IV
  return Buffer.concat([iv, encrypted]);
}

// =============================================================================
// VALIDATION RESULT
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
  
  // The doubly-encrypted data to store
  dataToStore?: Buffer;
}

/**
 * Validate and process upload.
 * 
 * Flow:
 * 1. Verify secondary key has high entropy
 * 2. Verify input data appears encrypted
 * 3. Attempt decrypt with secondary key
 *    - If fails → good, secondary key can't decrypt
 *    - If succeeds → check if output still looks encrypted
 *      - If output looks encrypted → probably padding collision, allow
 *      - If output doesn't look encrypted → actual decryption to plaintext, reject
 * 4. Encrypt with secondary key → return for storage
 */
export function validateAndEncrypt(
  clientEncrypted: Buffer,
  secondaryKey: Buffer
): EncryptionValidationResult {
  const result: EncryptionValidationResult = {
    secondaryKeyValid: false,
    secondaryKeyRandomness: {
      entropy: 0,
      monobit: 0,
      runs: 0,
      correlation: 0,
      uniformity: 0,
      longestRun: 0,
      patternDetected: null,
    },
    inputDataEntropy: 0,
    inputDataAppearsEncrypted: false,
    inputDataCompressionDetected: null,
    inputDataUniformity: 0,
    secondaryKeyDecryptionFailed: false,
    valid: false,
  };
  
  // 1. Verify secondary key looks like valid cryptographic output
  const keyCheck = verifyKeyRandomness(secondaryKey);
  result.secondaryKeyValid = keyCheck.valid;
  result.secondaryKeyRandomness = {
    entropy: keyCheck.entropy,
    monobit: keyCheck.monobit,
    runs: keyCheck.runs,
    correlation: keyCheck.correlation,
    uniformity: keyCheck.uniformity,
    longestRun: keyCheck.longestRun,
    patternDetected: keyCheck.patternDetected,
  };
  result.secondaryKeyReason = keyCheck.reason;
  
  if (!keyCheck.valid) {
    result.rejectionReason = `Secondary key failed randomness check: ${keyCheck.reason}`;
    return result;
  }
  
  // 2. Check input data looks encrypted
  const inputCheck = checkLooksEncrypted(clientEncrypted);
  result.inputDataEntropy = inputCheck.entropy;
  result.inputDataUniformity = inputCheck.uniformity;
  result.inputDataCompressionDetected = inputCheck.compressionDetected;
  result.inputDataAppearsEncrypted = inputCheck.looksEncrypted;
  
  if (!inputCheck.looksEncrypted) {
    result.rejectionReason = `Input data doesn't appear encrypted: ${inputCheck.reason}`;
    return result;
  }
  
  // 3. Attempt decrypt with secondary key
  const decryptAttempt = attemptDecrypt(clientEncrypted, secondaryKey);
  result.secondaryKeyDecryptionFormat = decryptAttempt.format;
  
  if (decryptAttempt.succeeded && decryptAttempt.decrypted) {
    // Decryption succeeded - check if output still looks encrypted
    const outputCheck = checkLooksEncrypted(decryptAttempt.decrypted);
    
    if (outputCheck.looksEncrypted) {
      // Output still looks encrypted - probably padding collision or 
      // user encrypting already-encrypted data. This is fine.
      result.secondaryKeyDecryptionFailed = true; // Treat as "didn't really decrypt"
    } else {
      // Output is plaintext - secondary key actually decrypted the data
      result.secondaryKeyDecryptionFailed = false;
      result.rejectionReason = `Secondary key decrypted the data to plaintext (format: ${decryptAttempt.format}, output: ${outputCheck.reason}) - client must use different key for primary encryption`;
      return result;
    }
  } else {
    // Decryption failed - good
    result.secondaryKeyDecryptionFailed = true;
  }
  
  // 4. All checks passed - encrypt with secondary key
  const doublyEncrypted = encryptWithSecondaryKey(clientEncrypted, secondaryKey);
  
  result.valid = true;
  result.dataToStore = doublyEncrypted;
  
  return result;
}

// Keep old export name for compatibility during transition
export const validateEncryption = validateAndEncrypt;
