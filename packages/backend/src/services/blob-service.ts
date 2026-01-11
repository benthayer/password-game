import { Readable } from 'stream';
import { setFileSize } from '../storage/db.js';
import { getBlobStream, setBlobStream, deleteBlob, blobExists } from '../storage/b2.js';
import { SecureTempFile } from './secure-temp-file.js';
import { validateEncryption, type EncryptionValidationResult } from './encryption-validation.js';

export class BlobService {
  async exists(addressHash: string): Promise<boolean> {
    return blobExists(addressHash);
  }

  async getStream(addressHash: string): Promise<Readable | null> {
    return getBlobStream(addressHash);
  }

  /**
   * Upload a doubly-encrypted blob.
   * 
   * Flow:
   * 1. Store incoming stream to disk with ephemeral encryption
   * 2. Read back and decrypt with secondary key (strips outer layer)
   * 3. Validate inner layer is still encrypted
   * 4. Store inner layer (single-encrypted with user's primary key)
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
      // 1. Write to disk with ephemeral encryption
      await tempFile.writeEncrypted(stream);
      
      // 2. Read back (decrypts ephemeral layer)
      const doublyEncrypted = await tempFile.readDecrypted();
      
      // 3. Validate and strip outer encryption
      const validation = validateEncryption(doublyEncrypted, secondaryKey);
      
      if (!validation.valid) {
        throw new Error(`VALIDATION_FAILED: ${validation.rejectionReason}`);
      }
      
      // 4. Store the inner layer (encrypted with user's primary key only)
      const innerLayer = validation.dataToStore!;
      await setBlobStream(addressHash, Readable.from(innerLayer), innerLayer.length);
      await setFileSize(addressHash, innerLayer.length);
      
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
