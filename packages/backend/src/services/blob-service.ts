import { Readable } from 'stream';
import { setFileSize } from '../storage/db.js';
import { getBlobStream, setBlobStream, deleteBlob, blobExists } from '../storage/b2.js';
import { SecureTempFile } from './secure-temp-file.js';

export class BlobService {
  async exists(addressHash: string): Promise<boolean> {
    return blobExists(addressHash);
  }

  async getStream(addressHash: string): Promise<Readable | null> {
    return getBlobStream(addressHash);
  }

  async upload(addressHash: string, stream: Readable, size: number): Promise<void> {
    const tempFile = new SecureTempFile(addressHash);
    
    try {
      await tempFile.writeEncrypted(stream);
      const decryptedStream = tempFile.createDecryptedReadStream();
      await setBlobStream(addressHash, decryptedStream, size);
      await setFileSize(addressHash, size);
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

