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

  async upload(
    addressHash: string, 
    stream: Readable, 
    size: number,
    secondaryKeyHex: string
  ): Promise<EncryptionValidationResult> {
    const secondaryKey = Buffer.from(secondaryKeyHex, 'hex');
    const tempFile = new SecureTempFile(addressHash);
    
    try {
      // Write incoming stream to encrypted temp file
      await tempFile.writeEncrypted(stream);
      
      // Read back to validate
      const encryptedData = await tempFile.readDecrypted();
      
      // Validate encryption
      const validation = validateEncryption(encryptedData, secondaryKey);
      
      if (!validation.dataAppearsEncrypted) {
        throw new Error(`VALIDATION_FAILED: Data does not appear encrypted (entropy: ${validation.dataEntropy.toFixed(2)})`);
      }
      
      if (!validation.secondaryKeyValid) {
        throw new Error(`VALIDATION_FAILED: Secondary key is not random (entropy: ${validation.secondaryKeyEntropy.toFixed(2)})`);
      }
      
      if (!validation.secondaryKeyDoesNotDecrypt) {
        throw new Error(`VALIDATION_FAILED: Secondary key may decrypt the data - ${validation.decryptionVerificationReason}`);
      }
      
      // Store the original encrypted data (validation proves we can't read it)
      await setBlobStream(addressHash, Readable.from(encryptedData), encryptedData.length);
      await setFileSize(addressHash, size);
      
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
