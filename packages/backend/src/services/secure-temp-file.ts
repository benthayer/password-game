import { createWriteStream, createReadStream } from 'fs';
import { unlink, mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { Readable, Transform, TransformCallback } from 'stream';
import path from 'path';
import { StreamingStats } from './streaming-stats.js';

const TEMP_DIR = process.env.TEMP_DIR || './data/temp';

// =============================================================================
// STATS COLLECTOR TRANSFORM
// =============================================================================

/**
 * Transform stream that passes data through while collecting stats.
 */
class StatsCollectorTransform extends Transform {
  constructor(private stats: StreamingStats) {
    super();
  }
  
  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.stats.pushBuffer(chunk);
    callback(null, chunk);
  }
}

// =============================================================================
// EVP_BytesToKey (for CryptoJS format)
// =============================================================================

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

// =============================================================================
// DECRYPTION ATTEMPT RESULT
// =============================================================================

export interface DecryptAttemptResult {
  succeeded: boolean;
  format?: string;
  outputStats?: StreamingStats;
}

// =============================================================================
// SECURE TEMP FILE
// =============================================================================

export class SecureTempFile {
  private path: string;
  private key: Buffer;
  private iv: Buffer;

  constructor(identifier: string) {
    this.path = path.join(TEMP_DIR, `${identifier}-${Date.now()}.tmp`);
    this.key = randomBytes(32);
    this.iv = randomBytes(16);
  }

  /**
   * Write stream to temp file with ephemeral encryption, collecting stats.
   */
  async writeEncryptedWithStats(stream: Readable, stats: StreamingStats): Promise<void> {
    await mkdir(TEMP_DIR, { recursive: true });
    const cipher = createCipheriv('aes-256-cbc', this.key, this.iv);
    const statsCollector = new StatsCollectorTransform(stats);
    await pipeline(stream, statsCollector, cipher, createWriteStream(this.path));
  }

  /**
   * Create a read stream that decrypts the ephemeral encryption.
   */
  createDecryptedReadStream(): Readable {
    const decipher = createDecipheriv('aes-256-cbc', this.key, this.iv);
    return createReadStream(this.path).pipe(decipher);
  }

  /**
   * Attempt to decrypt with a secondary key, collecting output stats.
   * Tries multiple formats (raw AES-CBC, CryptoJS/OpenSSL).
   * Returns whether decryption succeeded and the output stats if so.
   */
  async tryDecryptWithStats(secondaryKey: Buffer): Promise<DecryptAttemptResult> {
    // Try raw AES-CBC format first (IV || ciphertext)
    const rawResult = await this.tryDecryptRawAES(secondaryKey);
    if (rawResult.succeeded) {
      return rawResult;
    }
    
    // Try CryptoJS/OpenSSL format with key as raw bytes
    const cryptoJsRawResult = await this.tryDecryptCryptoJS(secondaryKey);
    if (cryptoJsRawResult.succeeded) {
      return cryptoJsRawResult;
    }
    
    // Try CryptoJS/OpenSSL format with key as hex string (passphrase)
    const keyAsHex = secondaryKey.toString('hex');
    const cryptoJsHexResult = await this.tryDecryptCryptoJS(Buffer.from(keyAsHex, 'utf8'));
    if (cryptoJsHexResult.succeeded) {
      return { ...cryptoJsHexResult, format: 'cryptojs-hex-passphrase' };
    }
    
    // All decryption attempts failed - this is the expected/good case
    return { succeeded: false };
  }

  /**
   * Try to decrypt as raw AES-CBC (IV || ciphertext format).
   */
  private async tryDecryptRawAES(key: Buffer): Promise<DecryptAttemptResult> {
    const outputStats = new StreamingStats();
    
    try {
      const decryptedStream = this.createDecryptedReadStream();
      
      // Read first 16 bytes for IV
      const header = await this.readBytes(decryptedStream, 16);
      if (header.length < 16) {
        decryptedStream.destroy();
        return { succeeded: false };
      }
      
      const iv = header;
      const aesKey = key.length >= 32 
        ? key.slice(0, 32) 
        : Buffer.concat([key, Buffer.alloc(32 - key.length)]);
      
      const decipher = createDecipheriv('aes-256-cbc', aesKey, iv);
      const statsCollector = new StatsCollectorTransform(outputStats);
      
      // Stream the rest through decryption + stats collection
      await pipeline(decryptedStream, decipher, statsCollector);
      
      return { succeeded: true, format: 'raw-aes-cbc', outputStats };
    } catch {
      // Decryption failed (likely padding error) - this is expected
      return { succeeded: false };
    }
  }

  /**
   * Try to decrypt as CryptoJS/OpenSSL format.
   * Format: "Salted__" (8 bytes) + salt (8 bytes) + ciphertext
   */
  private async tryDecryptCryptoJS(passphrase: Buffer): Promise<DecryptAttemptResult> {
    const outputStats = new StreamingStats();
    
    try {
      const decryptedStream = this.createDecryptedReadStream();
      
      // Read first 16 bytes for magic + salt
      const header = await this.readBytes(decryptedStream, 16);
      if (header.length < 16) {
        decryptedStream.destroy();
        return { succeeded: false };
      }
      
      // Check for "Salted__" magic header
      const magic = header.slice(0, 8).toString('utf8');
      if (magic !== 'Salted__') {
        decryptedStream.destroy();
        return { succeeded: false };
      }
      
      const salt = header.slice(8, 16);
      const { key, iv } = evpBytesToKey(passphrase, salt, 32, 16);
      
      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      const statsCollector = new StatsCollectorTransform(outputStats);
      
      await pipeline(decryptedStream, decipher, statsCollector);
      
      return { succeeded: true, format: 'cryptojs-raw', outputStats };
    } catch {
      return { succeeded: false };
    }
  }

  /**
   * Read exactly n bytes from a stream.
   */
  private readBytes(stream: Readable, n: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytesRead = 0;
      
      const onReadable = () => {
        let chunk: Buffer | null;
        while (bytesRead < n && (chunk = stream.read(Math.min(n - bytesRead, 16384))) !== null) {
          chunks.push(chunk);
          bytesRead += chunk.length;
        }
        
        if (bytesRead >= n) {
          cleanup();
          resolve(Buffer.concat(chunks).slice(0, n));
        }
      };
      
      const onEnd = () => {
        cleanup();
        resolve(Buffer.concat(chunks));
      };
      
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      
      const cleanup = () => {
        stream.removeListener('readable', onReadable);
        stream.removeListener('end', onEnd);
        stream.removeListener('error', onError);
      };
      
      stream.on('readable', onReadable);
      stream.on('end', onEnd);
      stream.on('error', onError);
      
      // Trigger initial read
      onReadable();
    });
  }

  /**
   * Clean up the temp file.
   */
  async cleanup(): Promise<void> {
    try {
      await unlink(this.path);
    } catch {
      // File might not exist
    }
  }
}
