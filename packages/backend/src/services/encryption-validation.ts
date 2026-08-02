import { createHash, randomBytes } from 'crypto';
import { Transform, TransformCallback } from 'stream';
import sodium from 'libsodium-wrappers';
import { StreamingStats } from './streaming-stats.js';

// =============================================================================
// CONSTANTS
// =============================================================================

// libsodium crypto_secretstream constants
const STREAM_HEADER_SIZE = 24; // crypto_secretstream_xchacha20poly1305_HEADERBYTES
const ABYTES = 17;             // crypto_secretstream_xchacha20poly1305_ABYTES
const CHUNK_SIZE = 64 * 1024;  // 64KB plaintext per chunk (matches frontend)

// =============================================================================
// KEY RANDOMNESS STATISTICS (JS port of Fourmilab ent)
// =============================================================================

/**
 * Thresholds calibrated against the Fourmilab ent tool. computeEntStats() is
 * an exact port of ent's formulas (verified byte-for-byte against the binary),
 * so the calibration carries over.
 *
 * Test results for 32-byte samples:
 * - All zeros:        entropy=0.00, chi-sq=8160, corr=-100000 (undefined)
 * - ABAB pattern:     entropy=1.00, chi-sq=4064, corr=-1.0
 * - Sequential:       entropy=5.00, chi-sq=224,  corr=0.82
 * - 8-byte repeat:    entropy=3.00, chi-sq=992,  corr=0.33
 * - Random samples:   entropy=4.8-5.0, chi-sq=224-256, corr=-0.3 to 0.1
 */
const ENT_THRESHOLDS = {
  // Entropy below 3.0 catches obvious low-entropy (zeros, simple patterns)
  MIN_ENTROPY: 3.0,
  // Chi-squared above 500 catches patterns and repetition
  MAX_CHI_SQUARED: 500,
  // Serial correlation magnitude above 0.7 catches sequential patterns
  // (random 32-byte samples can hit ~0.53, sequential pattern is 0.82)
  MAX_SERIAL_CORRELATION: 0.7,
};

interface EntResult {
  entropy: number;
  chiSquared: number;
  mean: number;
  serialCorrelation: number;
}

/**
 * Compute ent's statistics over a buffer: Shannon entropy (bits/byte),
 * chi-squared against a uniform byte distribution, mean, and serial
 * correlation. Matches randtest.c: serial correlation is circular (last
 * byte pairs with first) and returns ent's -100000 sentinel when the
 * denominator is zero (e.g. all bytes identical).
 */
export function computeEntStats(data: Buffer): EntResult {
  const n = data.length;
  const freq = new Uint32Array(256);
  let sum = 0;
  let scct1 = 0, scct2 = 0, scct3 = 0;

  for (let i = 0; i < n; i++) {
    const byte = data[i];
    freq[byte]++;
    sum += byte;
    scct1 += byte * data[(i + 1) % n];
    scct2 += byte;
    scct3 += byte * byte;
  }

  let entropy = 0;
  const expected = n / 256;
  let chiSquared = 0;
  for (let i = 0; i < 256; i++) {
    const count = freq[i];
    if (count > 0) {
      const p = count / n;
      entropy -= p * Math.log2(p);
    }
    const diff = count - expected;
    chiSquared += (diff * diff) / expected;
  }

  const sccDenominator = n * scct3 - scct2 * scct2;
  const serialCorrelation = sccDenominator === 0
    ? -100000
    : (n * scct1 - scct2 * scct2) / sccDenominator;

  return {
    entropy,
    chiSquared,
    mean: sum / n,
    serialCorrelation,
  };
}

// =============================================================================
// SAMPLE-SIZE AWARE THRESHOLDS (for encrypted data validation)
// =============================================================================

/**
 * Entropy threshold for encrypted data validation.
 *
 * Byte-histogram entropy on N bytes is capped at log2(N) bits/byte, so fixed
 * thresholds falsely reject genuine ciphertext at small sizes (a 122-byte
 * ciphertext of random data averages 6.50 and fails a 6.5 bar half the time;
 * anything under 91 bytes could never pass at all).
 *
 * This uses the method-of-types bound, which is exact (non-asymptotic):
 *   P(H_emp <= t) <= C(N+255, 255) * 2^(-N * (8 - t))
 * Solving for a false-reject probability of 2^-128 gives
 *   t(N) = 8 - (128 + log2 C(N+255, 255)) / N
 * so uniform random data (i.e. real ciphertext) fails with probability
 * <= 2^-128 at every size. The bound is conservative: measured entropy of
 * random 122-byte buffers never dropped below 6.1 across 3M trials vs a
 * threshold of 4.18 here.
 *
 * Trade-off (information-theoretic, not fixable by tuning): below ~512 bytes
 * the threshold sits inside the plaintext range, so small non-encrypted
 * payloads (base64, CJK text, at 122B even some English) are accepted. The
 * check only discriminates plaintext from ciphertext for larger payloads.
 */
function getMinEncryptedEntropyThreshold(sampleSize: number): number {
  if (sampleSize <= 0) return 0;
  // log2 C(sampleSize + 255, 255) = sum_{i=1..255} log2((sampleSize + i) / i)
  let logTypes = 0;
  for (let i = 1; i <= 255; i++) {
    logTypes += Math.log2((sampleSize + i) / i);
  }
  return Math.max(0, 8 - (128 + logTypes) / sampleSize);
}

/**
 * Uniformity threshold for encrypted data validation.
 * Chi-squared test requires larger samples for meaningful results.
 */
function getMinUniformityThreshold(sampleSize: number): number {
  // Chi-squared needs at least 256 bytes for meaningful results
  if (sampleSize < 256) return 0; // Skip uniformity check for small samples
  // 0.1 normalized = raw chi-squared <= 705, ~2^-140 false-reject rate for
  // uniform random data (the old 0.5 at >=4096 was ~2^-56). Real plaintext
  // scores in the thousands, so nothing meaningful is lost.
  return 0.1;
}

// =============================================================================
// KEY VALIDATION (ent statistics - proper entropy testing)
// =============================================================================

interface RandomnessCheckResult {
  looksRandom: boolean;
  entropy: number;
  chiSquared: number;
  serialCorrelation: number;
  mean: number;
  patternDetected: string | null;
  reason?: string;
}

/**
 * Verify key looks like valid cryptographic output.
 *
 * Uses multiple complementary metrics that together reliably
 * distinguish random from non-random data even on small samples:
 * - Entropy: catches obvious low-entropy data
 * - Chi-squared: catches patterns and repetition
 * - Serial correlation: catches sequential/structured data
 */
export function verifyKeyRandomness(key: Buffer): RandomnessCheckResult & { valid: boolean } {
  if (key.length < 32) {
    return {
      valid: false,
      looksRandom: false,
      entropy: 0,
      chiSquared: 0,
      serialCorrelation: 0,
      mean: 0,
      patternDetected: null,
      reason: 'Key must be at least 32 bytes',
    };
  }

  const entResult = computeEntStats(key);

  const result: RandomnessCheckResult = {
    looksRandom: false,
    entropy: entResult.entropy,
    chiSquared: entResult.chiSquared,
    serialCorrelation: entResult.serialCorrelation,
    mean: entResult.mean,
    patternDetected: null,
  };
  
  // Check entropy (catches zeros, simple patterns)
  if (entResult.entropy < ENT_THRESHOLDS.MIN_ENTROPY) {
    result.patternDetected = 'low entropy';
    result.reason = `Entropy too low: ${entResult.entropy.toFixed(2)} bits/byte (need >= ${ENT_THRESHOLDS.MIN_ENTROPY})`;
    return { ...result, valid: false };
  }
  
  // Check chi-squared (catches repetition, byte frequency anomalies)
  if (entResult.chiSquared > ENT_THRESHOLDS.MAX_CHI_SQUARED) {
    result.patternDetected = 'chi-squared anomaly';
    result.reason = `Chi-squared too high: ${entResult.chiSquared.toFixed(2)} (need <= ${ENT_THRESHOLDS.MAX_CHI_SQUARED})`;
    return { ...result, valid: false };
  }
  
  // Check serial correlation (catches sequential patterns)
  const absCorrelation = Math.abs(entResult.serialCorrelation);
  if (absCorrelation > ENT_THRESHOLDS.MAX_SERIAL_CORRELATION) {
    result.patternDetected = 'serial correlation';
    result.reason = `Serial correlation too high: ${entResult.serialCorrelation.toFixed(4)} (need |corr| <= ${ENT_THRESHOLDS.MAX_SERIAL_CORRELATION})`;
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
  
  // Check entropy (sample-size aware)
  const totalBytes = stats.getTotalBytes();
  const minEntropy = getMinEncryptedEntropyThreshold(totalBytes);
  if (result.entropy < minEntropy) {
    result.reason = `Entropy too low: ${result.entropy.toFixed(2)} (need >= ${minEntropy} for ${totalBytes} bytes)`;
    return result;
  }
  
  // Check byte distribution (sample-size aware)
  const minUniformity = getMinUniformityThreshold(totalBytes);
  if (minUniformity > 0 && result.uniformity < minUniformity) {
    result.reason = `Byte distribution not uniform: ${result.uniformity.toFixed(2)} (need >= ${minUniformity} for ${totalBytes} bytes)`;
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
  
  // Check entropy (sample-size aware)
  const totalBytes = stats.getTotalBytes();
  const minEntropy = getMinEncryptedEntropyThreshold(totalBytes);
  if (result.entropy < minEntropy) {
    result.reason = `Entropy too low: ${result.entropy.toFixed(2)} (need >= ${minEntropy} for ${totalBytes} bytes)`;
    return result;
  }
  
  // Check byte distribution (sample-size aware)
  const minUniformity = getMinUniformityThreshold(totalBytes);
  if (minUniformity > 0 && result.uniformity < minUniformity) {
    result.reason = `Byte distribution not uniform: ${result.uniformity.toFixed(2)} (need >= ${minUniformity} for ${totalBytes} bytes)`;
    return result;
  }
  
  result.looksEncrypted = true;
  return result;
}

// =============================================================================
// ENCRYPTION STREAM (for server-side encryption layer)
// =============================================================================

/**
 * Ensure libsodium is ready before use.
 */
let sodiumReady = false;
async function ensureSodiumReady(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

/**
 * Create a Transform stream that encrypts data with libsodium crypto_secretstream.
 * Uses chunked streaming for memory efficiency.
 * 
 * Output format: [24-byte header][encrypted chunks...]
 * Each chunk: ciphertext + 17 bytes (ABYTES)
 */
export async function createEncryptionStream(secondaryKey: Buffer): Promise<{ stream: Transform; header: Buffer }> {
  await ensureSodiumReady();
  
  const key = secondaryKey.length >= 32 
    ? new Uint8Array(secondaryKey.slice(0, 32))
    : new Uint8Array(Buffer.concat([secondaryKey, Buffer.alloc(32 - secondaryKey.length)]));
  
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  
  let headerWritten = false;
  let buffer = Buffer.alloc(0);
  
  const encryptionStream = new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      try {
        // Write header first
        if (!headerWritten) {
          this.push(Buffer.from(header));
          headerWritten = true;
        }
        
        // Accumulate data
        buffer = Buffer.concat([buffer, chunk]);
        
        // Encrypt full chunks
        while (buffer.length >= CHUNK_SIZE) {
          const plaintext = new Uint8Array(buffer.slice(0, CHUNK_SIZE));
          buffer = buffer.slice(CHUNK_SIZE);
          
          const encrypted = sodium.crypto_secretstream_xchacha20poly1305_push(
            state,
            plaintext,
            null,
            sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
          );
          this.push(Buffer.from(encrypted));
        }
        
        callback();
      } catch (err) {
        callback(err as Error);
      }
    },
    flush(callback: TransformCallback) {
      try {
        // Write header if no data was received
        if (!headerWritten) {
          this.push(Buffer.from(header));
        }
        
        // Encrypt remaining data with FINAL tag
        const plaintext = new Uint8Array(buffer);
        const encrypted = sodium.crypto_secretstream_xchacha20poly1305_push(
          state,
          plaintext,
          null,
          sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
        );
        this.push(Buffer.from(encrypted));
        
        callback();
      } catch (err) {
        callback(err as Error);
      }
    }
  });
  
  return { stream: encryptionStream, header: Buffer.from(header) };
}

/**
 * Calculate encrypted output size for crypto_secretstream.
 * Output = header (24) + ceil(input / CHUNK_SIZE) * (CHUNK_SIZE + ABYTES) 
 *        + (input % CHUNK_SIZE + ABYTES) for last chunk
 * Simplified: header + input + ABYTES * num_chunks
 */
export function calculateSecretstreamSize(inputSize: number): number {
  const numChunks = Math.ceil(inputSize / CHUNK_SIZE) || 1; // At least 1 chunk for empty input
  return STREAM_HEADER_SIZE + inputSize + (numChunks * ABYTES);
}

// =============================================================================
// VALIDATION RESULT TYPE (updated - no dataToStore buffer)
// =============================================================================

export interface EncryptionValidationResult {
  // Secondary key randomness checks (ent statistics)
  secondaryKeyValid: boolean;
  secondaryKeyRandomness: {
    entropy: number;
    chiSquared: number;
    serialCorrelation: number;
    mean: number;
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
      chiSquared: keyCheck.chiSquared,
      serialCorrelation: keyCheck.serialCorrelation,
      mean: keyCheck.mean,
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
