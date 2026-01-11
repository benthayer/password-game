import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { setFileSize } from '../storage/db.js';
import { getBlobStream, setBlobStream, deleteBlob, blobExists } from '../storage/b2.js';
import { SecureTempFile } from './secure-temp-file.js';
import { StreamingStats } from './streaming-stats.js';
import { 
  verifyKeyRandomness, 
  checkInputStats, 
  checkDecryptedStats,
  createEncryptionStream,
  buildValidationResult,
  type EncryptionValidationResult 
} from './encryption-validation.js';

// =============================================================================
// SIZE CALCULATION
// =============================================================================

/**
 * Calculate the encrypted output size for AES-256-CBC.
 * Output = IV (16 bytes) + padded ciphertext
 * PKCS7 padding always adds at least 1 byte, up to 16.
 */
function calculateEncryptedSize(inputSize: number): number {
  const paddedSize = (Math.floor(inputSize / 16) + 1) * 16;
  return paddedSize + 16; // +16 for IV prefix
}

// =============================================================================
// BLOB SERVICE
// =============================================================================

export class BlobService {
  async exists(addressHash: string): Promise<boolean> {
    return blobExists(addressHash);
  }

  async getStream(addressHash: string): Promise<Readable | null> {
    return getBlobStream(addressHash);
  }

  /**
   * Upload and validate encrypted blob (streaming - no full file in memory).
   * 
   * Flow:
   * 1. Stream incoming data to disk with ephemeral encryption, collecting stats
   * 2. Validate input stats (entropy, patterns, compression)
   * 3. Stream-decrypt with secondary key, collect output stats
   * 4. Validate decryption didn't produce plaintext
   * 5. Stream from temp → encrypt with secondary key → B2
   * 6. Cleanup temp file
   */
  async upload(
    addressHash: string, 
    stream: Readable, 
    size: number,
    secondaryKeyHex: string
  ): Promise<EncryptionValidationResult> {
    const secondaryKey = Buffer.from(secondaryKeyHex, 'hex');
    const tempFile = new SecureTempFile(addressHash);
    
    try {
      // 1. Validate secondary key (small buffer, okay to hold in memory)
      const keyCheck = verifyKeyRandomness(secondaryKey);
      if (!keyCheck.valid) {
        const result = buildValidationResult(keyCheck, 
          { valid: false, entropy: 0, uniformity: 0, compressionDetected: null },
          false, undefined, null);
        throw new Error(`VALIDATION_FAILED: ${result.rejectionReason}`);
      }
      
      // 2. Write to temp file with ephemeral encryption, collecting input stats
      const inputStats = new StreamingStats();
      await tempFile.writeEncryptedWithStats(stream, inputStats);
      
      // 3. Validate input looks encrypted
      const inputCheck = checkInputStats(inputStats);
      if (!inputCheck.valid) {
        const result = buildValidationResult(keyCheck, inputCheck, false, undefined, null);
        throw new Error(`VALIDATION_FAILED: ${result.rejectionReason}`);
      }
      
      // 4. Try decryption with secondary key, collect output stats
      const decryptResult = await tempFile.tryDecryptWithStats(secondaryKey);
      
      let decryptedOutputCheck = null;
      if (decryptResult.succeeded && decryptResult.outputStats) {
        decryptedOutputCheck = checkDecryptedStats(decryptResult.outputStats);
        
        // If decryption succeeded and output is plaintext, reject
        if (!decryptedOutputCheck.looksEncrypted) {
          const result = buildValidationResult(
            keyCheck, inputCheck, true, decryptResult.format, decryptedOutputCheck
          );
          throw new Error(`VALIDATION_FAILED: ${result.rejectionReason}`);
        }
      }
      
      // 5. Build validation result (all checks passed)
      const validation = buildValidationResult(
        keyCheck, inputCheck, 
        decryptResult.succeeded, decryptResult.format, 
        decryptedOutputCheck
      );
      
      // 6. Stream from temp → encrypt with secondary key → B2
      const encryptedSize = calculateEncryptedSize(size);
      const { stream: encryptionStream } = createEncryptionStream(secondaryKey);
      const sourceStream = tempFile.createDecryptedReadStream();
      
      // Create a passthrough that pipes through encryption
      const encryptedStream = sourceStream.pipe(encryptionStream);
      
      await setBlobStream(addressHash, encryptedStream, encryptedSize);
      await setFileSize(addressHash, encryptedSize);
      
      return validation;
    } finally {
      await tempFile.cleanup();
    }
  }

  async delete(addressHash: string): Promise<void> {
    await deleteBlob(addressHash);
    await setFileSize(addressHash, null);
  }

  async deleteIfExists(addressHash: string): Promise<void> {
    if (await this.exists(addressHash)) {
      await this.delete(addressHash);
    }
  }
}
