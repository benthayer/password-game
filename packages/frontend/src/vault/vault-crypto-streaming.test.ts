/**
 * Unit tests for vault-crypto-streaming.ts
 * 
 * Tests the libsodium crypto_secretstream encryption/decryption
 */

import { describe, it, expect, beforeAll } from 'vitest';
import sodium from 'libsodium-wrappers';
import {
  encryptFile,
  decryptFile,
  encryptFileWithKey,
  decryptFileWithKey,
  getPrimaryKeyHex,
  getAddressHash,
  getSecondaryKey,
  decryptOuterLayer,
  decryptDownloadedFile,
} from './vault-crypto-streaming';
import type { FullHashConfig } from '../hash-config';

// Test config with fast hashing for tests
const TEST_CONFIG: FullHashConfig = {
  algorithmConfig: {
    algorithm: 'argon2id',
    memoryCost: 1024, // 1MB - fast for tests
    timeCost: 1,
    parallelism: 1,
  },
  includeSalt: false,
  salt: '',
};

// Helper to create a File from string content
function createTestFile(content: string, filename = 'test.txt', type = 'text/plain'): File {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type });
}

// Helper to create a File from Uint8Array
function createBinaryFile(data: Uint8Array<ArrayBuffer>, filename = 'test.bin', type = 'application/octet-stream'): File {
  const blob = new Blob([data], { type });
  return new File([blob], filename, { type });
}

describe('vault-crypto-streaming', () => {
  beforeAll(async () => {
    // Ensure libsodium is ready before tests
    await sodium.ready;
  });

  describe('key derivation', () => {
    it('should derive consistent address hash', async () => {
      const password = ['hello', 'world'];
      const hash1 = await getAddressHash(password, TEST_CONFIG);
      const hash2 = await getAddressHash(password, TEST_CONFIG);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 32 bytes = 64 hex
    });

    it('should derive different hashes for different passwords', async () => {
      const hash1 = await getAddressHash(['hello', 'world'], TEST_CONFIG);
      const hash2 = await getAddressHash(['hello', 'there'], TEST_CONFIG);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should derive primary key as hex', async () => {
      const password = ['test', 'password'];
      const keyHex = await getPrimaryKeyHex(password, TEST_CONFIG);
      
      expect(keyHex).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(keyHex).toMatch(/^[0-9a-f]+$/i);
    });

    it('should derive consistent secondary key', async () => {
      const password = ['test', 'password'];
      const key1 = await getSecondaryKey(password, TEST_CONFIG);
      const key2 = await getSecondaryKey(password, TEST_CONFIG);
      
      expect(key1).toBe(key2);
    });

    it('should derive different keys with different suffixes', async () => {
      const password = ['test', 'password'];
      const addressHash = await getAddressHash(password, TEST_CONFIG);
      const primaryKey = await getPrimaryKeyHex(password, TEST_CONFIG);
      const secondaryKey = await getSecondaryKey(password, TEST_CONFIG);
      
      // All three should be different
      expect(addressHash).not.toBe(primaryKey);
      expect(addressHash).not.toBe(secondaryKey);
      expect(primaryKey).not.toBe(secondaryKey);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt a simple text file', async () => {
      const originalContent = 'Hello, this is a test!';
      const file = createTestFile(originalContent, 'hello.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      const decrypted = await decryptFile(encrypted, password, TEST_CONFIG);
      
      const decryptedContent = new TextDecoder().decode(decrypted.content);
      
      expect(decryptedContent).toBe(originalContent);
      expect(decrypted.metadata.filename).toBe('hello.txt');
      expect(decrypted.metadata.mimetype).toBe('text/plain');
      expect(decrypted.metadata.size).toBe(originalContent.length);
    });

    it('should encrypt and decrypt an empty file', async () => {
      const file = createTestFile('', 'empty.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      const decrypted = await decryptFile(encrypted, password, TEST_CONFIG);
      
      expect(decrypted.content.length).toBe(0);
      expect(decrypted.metadata.filename).toBe('empty.txt');
      expect(decrypted.metadata.size).toBe(0);
    });

    it('should encrypt and decrypt a file larger than one chunk (>64KB)', async () => {
      // Create a file larger than CHUNK_SIZE (64KB)
      const chunkSize = 64 * 1024;
      const content = 'A'.repeat(chunkSize + 1000); // 64KB + 1000 bytes
      const file = createTestFile(content, 'large.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      const decrypted = await decryptFile(encrypted, password, TEST_CONFIG);
      
      const decryptedContent = new TextDecoder().decode(decrypted.content);
      
      expect(decryptedContent).toBe(content);
      expect(decrypted.metadata.size).toBe(content.length);
    });

    it('should encrypt and decrypt a file exactly at chunk boundary', async () => {
      const chunkSize = 64 * 1024;
      const content = 'B'.repeat(chunkSize); // Exactly 64KB
      const file = createTestFile(content, 'boundary.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      const decrypted = await decryptFile(encrypted, password, TEST_CONFIG);
      
      const decryptedContent = new TextDecoder().decode(decrypted.content);
      
      expect(decryptedContent).toBe(content);
    });

    it('should encrypt and decrypt a file spanning multiple chunks', async () => {
      const chunkSize = 64 * 1024;
      const content = 'C'.repeat(chunkSize * 3 + 500); // 3 full chunks + partial
      const file = createTestFile(content, 'multi-chunk.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      const decrypted = await decryptFile(encrypted, password, TEST_CONFIG);
      
      const decryptedContent = new TextDecoder().decode(decrypted.content);
      
      expect(decryptedContent).toBe(content);
      expect(decrypted.metadata.size).toBe(content.length);
    });

    it('should encrypt and decrypt binary data', async () => {
      // Create random binary data
      const binaryData = new Uint8Array(1000);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = Math.floor(Math.random() * 256);
      }
      
      const file = createBinaryFile(binaryData, 'random.bin');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      const decrypted = await decryptFile(encrypted, password, TEST_CONFIG);
      
      expect(decrypted.content).toEqual(binaryData);
      expect(decrypted.metadata.mimetype).toBe('application/octet-stream');
    });

    it('should preserve special characters in filename', async () => {
      const file = createTestFile('content', 'test file (1).txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      const decrypted = await decryptFile(encrypted, password, TEST_CONFIG);
      
      expect(decrypted.metadata.filename).toBe('test file (1).txt');
    });

    it('should work with key hex directly', async () => {
      const content = 'Test with key hex';
      const file = createTestFile(content, 'keyhex.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const keyHex = await getPrimaryKeyHex(password, TEST_CONFIG);
      
      const encrypted = await encryptFileWithKey(file, keyHex);
      const decrypted = await decryptFileWithKey(encrypted, keyHex);
      
      const decryptedContent = new TextDecoder().decode(decrypted.content);
      expect(decryptedContent).toBe(content);
    });
  });

  describe('encryption format', () => {
    it('should produce different ciphertext for same plaintext (due to random header)', async () => {
      const file1 = createTestFile('Same content', 'test1.txt', 'text/plain');
      const file2 = createTestFile('Same content', 'test2.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted1 = await encryptFile(file1, password, TEST_CONFIG);
      const encrypted2 = await encryptFile(file2, password, TEST_CONFIG);
      
      // Different ciphertext (random nonces)
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should fail decryption with wrong password', async () => {
      const file = createTestFile('Secret content', 'secret.txt', 'text/plain');
      
      const encrypted = await encryptFile(file, ['correct', 'password'], TEST_CONFIG);
      
      await expect(
        decryptFile(encrypted, ['wrong', 'password'], TEST_CONFIG)
      ).rejects.toThrow();
    });

    it('should fail decryption with corrupted data', async () => {
      const file = createTestFile('Secret content', 'secret.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      
      // Corrupt the auth tag (last 16 bytes of the last chunk)
      // This should always trigger authentication failure
      encrypted[encrypted.length - 5]! ^= 0xff;
      
      await expect(
        decryptFile(encrypted, password, TEST_CONFIG)
      ).rejects.toThrow();
    });

    it('should fail decryption with truncated data', async () => {
      const file = createTestFile('Secret content', 'secret.txt', 'text/plain');
      const password = ['test', 'password'];
      
      const encrypted = await encryptFile(file, password, TEST_CONFIG);
      
      // Truncate the ciphertext
      const truncated = encrypted.slice(0, encrypted.length - 10);
      
      await expect(
        decryptFile(truncated, password, TEST_CONFIG)
      ).rejects.toThrow();
    });
  });

  describe('outer layer decryption', () => {
    it('should decrypt outer layer that was encrypted with secondary key', async () => {
      // Simulate what the server does: encrypt with secondary key using crypto_secretstream
      const innerData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const password = ['test', 'password'];
      
      const secondaryKeyHex = await getSecondaryKey(password, TEST_CONFIG);
      const secondaryKey = hexToBytes(secondaryKeyHex).slice(0, 32);
      
      // Encrypt (simulating server)
      const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(secondaryKey);
      const encryptedChunk = sodium.crypto_secretstream_xchacha20poly1305_push(
        state,
        innerData,
        null,
        sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
      );
      
      const outerEncrypted = concat(header, encryptedChunk);
      
      // Decrypt with our function
      const decrypted = await decryptOuterLayer(outerEncrypted, secondaryKeyHex);
      
      expect(decrypted).toEqual(innerData);
    });
  });

  describe('full double-encryption flow', () => {
    it('should decrypt doubly-encrypted file', async () => {
      const originalContent = 'This is doubly encrypted content';
      const file = createTestFile(originalContent, 'double.txt', 'text/plain');
      const password = ['test', 'password'];
      
      // First encryption (client-side, our code)
      const innerEncrypted = await encryptFile(file, password, TEST_CONFIG);
      
      // Second encryption (simulating server with secondary key)
      const secondaryKeyHex = await getSecondaryKey(password, TEST_CONFIG);
      const secondaryKey = hexToBytes(secondaryKeyHex).slice(0, 32);
      
      const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(secondaryKey);
      
      // Server encrypts in chunks of 64KB
      const CHUNK_SIZE = 64 * 1024;
      const chunks: Uint8Array[] = [header];
      let offset = 0;
      
      while (offset < innerEncrypted.length) {
        const end = Math.min(offset + CHUNK_SIZE, innerEncrypted.length);
        const isLast = end >= innerEncrypted.length;
        const chunk = innerEncrypted.slice(offset, end);
        
        const tag = isLast
          ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
          : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
        
        const encrypted = sodium.crypto_secretstream_xchacha20poly1305_push(state, chunk, null, tag);
        chunks.push(encrypted);
        offset = end;
      }
      
      const doublyEncrypted = concat(...chunks);
      
      // Decrypt with our full decryption function
      const decrypted = await decryptDownloadedFile(doublyEncrypted, password, TEST_CONFIG);
      
      const decryptedContent = new TextDecoder().decode(decrypted.content);
      expect(decryptedContent).toBe(originalContent);
      expect(decrypted.metadata.filename).toBe('double.txt');
    });
  });
});

// Helper function for tests
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

