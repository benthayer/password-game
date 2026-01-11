import { createWriteStream, createReadStream } from 'fs';
import { unlink, mkdir, readFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Readable } from 'stream';
import path from 'path';

const TEMP_DIR = process.env.TEMP_DIR || './data/temp';

export class SecureTempFile {
  private path: string;
  private key: Buffer;
  private iv: Buffer;

  constructor(identifier: string) {
    this.path = path.join(TEMP_DIR, `${identifier}-${Date.now()}.tmp`);
    this.key = randomBytes(32);
    this.iv = randomBytes(16);
  }

  async writeEncrypted(stream: Readable): Promise<void> {
    await mkdir(TEMP_DIR, { recursive: true });
    const cipher = createCipheriv('aes-256-cbc', this.key, this.iv);
    await pipeline(stream, cipher, createWriteStream(this.path));
  }

  createDecryptedReadStream(): Readable {
    const decipher = createDecipheriv('aes-256-cbc', this.key, this.iv);
    return createReadStream(this.path).pipe(decipher);
  }

  async readDecrypted(): Promise<Buffer> {
    const encrypted = await readFile(this.path);
    const decipher = createDecipheriv('aes-256-cbc', this.key, this.iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async cleanup(): Promise<void> {
    try {
      await unlink(this.path);
    } catch {
      // File might not exist
    }
  }
}
