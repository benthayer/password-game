import { Readable } from 'stream';
import { setFileSize } from '../storage/db.js';
import { getBlobStream, setBlobStream, deleteBlob, blobExists } from '../storage/b2.js';
import { SecureTempFile } from './secure-temp-file.js';
import { validateAndEncrypt, type EncryptionValidationResult } from './encryption-validation.js';

export class BlobService {
  async exists(addressHash: string): Promise<boolean> {
    return blobExists(addressHash);
  }

  async getStream(addressHash: string): Promise<Readable | null> {
    return getBlobStream(addressHash);
  }

  /**
   * Upload and validate encrypted blob.
   * 
   * Flow:
   * 1. Store incoming stream to disk with ephemeral encryption
   * 2. Read back (decrypts ephemeral layer)
   * 3. Validate data appears encrypted and secondary key cannot decrypt it
   * 4. Encrypt with secondary key (server-side layer)
   * 5. Store doubly-encrypted result
   * 6. Discard secondary key
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
      const clientEncrypted = await tempFile.readDecrypted();
      
      // 3-4. Validate and encrypt with secondary key
      const validation = validateAndEncrypt(clientEncrypted, secondaryKey);
      
      if (!validation.valid) {
        throw new Error(`VALIDATION_FAILED: ${validation.rejectionReason}`);
      }
      
      // 5. Store the doubly-encrypted result
      const doublyEncrypted = validation.dataToStore!;
      await setBlobStream(addressHash, Readable.from(doublyEncrypted), doublyEncrypted.length);
      await setFileSize(addressHash, doublyEncrypted.length);
      
      // 6. Secondary key discarded when this function returns
      
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
