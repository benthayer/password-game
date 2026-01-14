/**
 * Streaming Encrypted Vault Format v1
 * 
 * Uses chunked AES-256-GCM for memory-bounded encryption of arbitrary files.
 * Metadata (filename, mimetype) is encrypted alongside content.
 * 
 * Format:
 * [1 byte]   Version (0x01)
 * [12 bytes] Base nonce
 * [4 bytes]  Chunk size (uint32 BE)
 * [4 bytes]  Total chunks (uint32 BE)
 * [4 bytes]  Metadata chunk length
 * [chunks...]
 * 
 * Each chunk: [ciphertext][16-byte auth tag]
 * Chunk 0 = encrypted metadata JSON
 * Chunk 1+ = encrypted file content
 */

import { createHashFunction } from '../hash-function';
import type { FullHashConfig } from '../hash-config';
import { DEFAULT_FULL_HASH_CONFIG } from '../hash-config';

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = 0x01;
const CHUNK_SIZE = 64 * 1024; // 64KB plaintext per chunk
const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const HEADER_SIZE = 25; // 1 + 12 + 4 + 4 + 4

// Key derivation suffixes (must match vault-crypto.ts)
const SUFFIX_ADDRESS = ':+address';
const SUFFIX_PRIMARY_KEY = ':+primary-encryption-key';
const SUFFIX_SECONDARY_KEY = ':+secondary-encryption-key';

// =============================================================================
// TYPES
// =============================================================================

export interface FileMetadata {
  filename: string;
  mimetype: string;
  size: number;
}

export interface DecryptedFile {
  metadata: FileMetadata;
  content: Uint8Array;
}

// =============================================================================
// KEY DERIVATION
// =============================================================================

function formatPasswordForHash(password: string[], suffix: string): string {
  return password.join(':') + suffix;
}

/**
 * Get the address hash for a password.
 * This is what the server uses to identify your storage slot.
 */
export async function getAddressHash(
  password: string[], 
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_ADDRESS);
  return await hashFn(input);
}

/**
 * Get the secondary encryption key for a password.
 * Sent to server for outer encryption layer.
 */
export async function getSecondaryKey(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_SECONDARY_KEY);
  return await hashFn(input);
}

/**
 * Derive the primary encryption key (CryptoKey) from password.
 * This is the main key used for AES-GCM encryption of vault contents.
 */
export async function getPrimaryKey(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<CryptoKey> {
  return deriveKey(password, config);
}

/**
 * Derive the primary encryption key material as hex.
 * Used by Web Workers since CryptoKey can't be transferred between threads.
 */
export async function getPrimaryKeyHex(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_PRIMARY_KEY);
  const keyHex = await hashFn(input);
  // Return first 64 hex chars (32 bytes for AES-256)
  return keyHex.slice(0, 64);
}

/**
 * Import a primary key from hex (for use after receiving from Worker).
 */
export async function importPrimaryKeyFromHex(keyHex: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(keyHex);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a CryptoKey from password for AES-GCM encryption.
 * Uses the configurable hash function to derive key material.
 */
async function deriveKey(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<CryptoKey> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_PRIMARY_KEY);
  const keyHex = await hashFn(input);
  
  // Convert hex to bytes (first 32 bytes for AES-256)
  const keyBytes = hexToBytes(keyHex).slice(0, 32);
  
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function writeUint32BE(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = (value >> 24) & 0xff;
  buffer[1] = (value >> 16) & 0xff;
  buffer[2] = (value >> 8) & 0xff;
  buffer[3] = value & 0xff;
  return buffer;
}

function readUint32BE(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset] ?? 0) << 24) |
    ((buffer[offset + 1] ?? 0) << 16) |
    ((buffer[offset + 2] ?? 0) << 8) |
    (buffer[offset + 3] ?? 0)
  ) >>> 0;
}

/**
 * Derive per-chunk nonce by XORing base nonce with chunk index.
 */
function deriveChunkNonce(baseNonce: Uint8Array, chunkIndex: number): Uint8Array {
  const nonce = new Uint8Array(baseNonce);
  // XOR last 4 bytes with chunk index (big-endian)
  const indexBytes = writeUint32BE(chunkIndex);
  nonce[8] = (nonce[8] ?? 0) ^ (indexBytes[0] ?? 0);
  nonce[9] = (nonce[9] ?? 0) ^ (indexBytes[1] ?? 0);
  nonce[10] = (nonce[10] ?? 0) ^ (indexBytes[2] ?? 0);
  nonce[11] = (nonce[11] ?? 0) ^ (indexBytes[3] ?? 0);
  return nonce;
}

/**
 * Create AAD (Additional Authenticated Data) for a chunk.
 * Includes chunk index and is_final flag to prevent reordering/truncation.
 */
function createAAD(chunkIndex: number, isFinal: boolean): Uint8Array {
  const aad = new Uint8Array(5);
  const indexBytes = writeUint32BE(chunkIndex);
  aad.set(indexBytes, 0);
  aad[4] = isFinal ? 0x01 : 0x00;
  return aad;
}

/**
 * Concatenate multiple Uint8Arrays.
 */
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

/**
 * Ensure Uint8Array has a proper ArrayBuffer (not SharedArrayBuffer).
 * Required for Web Crypto API compatibility.
 */
function toBuffer(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(arr.length);
  const result = new Uint8Array(buffer);
  result.set(arr);
  return result;
}

// =============================================================================
// ENCRYPTION
// =============================================================================

/**
 * Encrypt a chunk with AES-256-GCM.
 */
async function encryptChunk(
  key: CryptoKey,
  baseNonce: Uint8Array,
  chunkIndex: number,
  plaintext: Uint8Array,
  totalChunks: number
): Promise<Uint8Array> {
  const nonce = toBuffer(deriveChunkNonce(baseNonce, chunkIndex));
  const isFinal = chunkIndex === totalChunks - 1;
  const aad = toBuffer(createAAD(chunkIndex, isFinal));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad },
    key,
    toBuffer(plaintext)
  );
  
  return new Uint8Array(ciphertext);
}

/**
 * Encrypt a file with streaming chunked AES-256-GCM.
 * Returns the complete encrypted blob.
 * 
 * Memory usage: O(CHUNK_SIZE), not O(file.size)
 */
export async function encryptFile(
  file: File, 
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<Uint8Array> {
  const key = await deriveKey(password, config);
  const baseNonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
  
  // Calculate total chunks: 1 for metadata + ceil(file.size / CHUNK_SIZE) for content
  const contentChunks = Math.ceil(file.size / CHUNK_SIZE) || 1; // At least 1 for empty files
  const totalChunks = 1 + contentChunks;
  
  const chunks: Uint8Array[] = [];
  
  // Chunk 0: encrypted metadata (need to encrypt first to know length)
  const metadata: FileMetadata = {
    filename: file.name,
    mimetype: file.type || 'application/octet-stream',
    size: file.size,
  };
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
  const encryptedMetadata = await encryptChunk(key, baseNonce, 0, metadataBytes, totalChunks);
  
  // File header (unencrypted)
  const header = new Uint8Array(HEADER_SIZE);
  header[0] = VERSION;
  header.set(baseNonce, 1);
  header.set(writeUint32BE(CHUNK_SIZE), 13);
  header.set(writeUint32BE(totalChunks), 17);
  header.set(writeUint32BE(encryptedMetadata.length), 21);
  chunks.push(header);
  
  // Add encrypted metadata
  chunks.push(encryptedMetadata);
  
  // Chunks 1+: encrypted file content
  let offset = 0;
  let chunkIndex = 1;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const slice = file.slice(offset, end);
    const plaintext = new Uint8Array(await slice.arrayBuffer());
    
    const encryptedChunk = await encryptChunk(key, baseNonce, chunkIndex, plaintext, totalChunks);
    chunks.push(encryptedChunk);
    
    offset = end;
    chunkIndex++;
  }
  
  // Handle empty files (still need one content chunk)
  if (file.size === 0) {
    const encryptedChunk = await encryptChunk(key, baseNonce, 1, new Uint8Array(0), totalChunks);
    chunks.push(encryptedChunk);
  }
  
  return concat(...chunks);
}

// =============================================================================
// DECRYPTION
// =============================================================================

/**
 * Decrypt a chunk with AES-256-GCM.
 */
async function decryptChunk(
  key: CryptoKey,
  baseNonce: Uint8Array,
  chunkIndex: number,
  ciphertext: Uint8Array,
  totalChunks: number
): Promise<Uint8Array> {
  const nonce = toBuffer(deriveChunkNonce(baseNonce, chunkIndex));
  const isFinal = chunkIndex === totalChunks - 1;
  const aad = toBuffer(createAAD(chunkIndex, isFinal));
  
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad },
    key,
    toBuffer(ciphertext)
  );
  
  return new Uint8Array(plaintext);
}

/**
 * Decrypt outer layer with secondary key (server-side encryption).
 * Input: doubly-encrypted binary data (IV prepended, AES-CBC)
 * Output: singly-encrypted data (our chunked format)
 */
async function decryptOuterLayer(
  doublyEncrypted: Uint8Array,
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<Uint8Array> {
  const secondaryKeyHex = await getSecondaryKey(password, config);
  const secondaryKey = hexToBytes(secondaryKeyHex);
  
  // Extract IV (first 16 bytes) and ciphertext
  const iv = doublyEncrypted.slice(0, 16);
  const ciphertext = doublyEncrypted.slice(16);
  
  // Import key for Web Crypto (AES-256-CBC)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secondaryKey.slice(0, 32),
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    ciphertext
  );
  
  return new Uint8Array(decrypted);
}

/**
 * Decrypt an encrypted vault file.
 * Handles both the outer layer (server encryption) and inner chunked format.
 * Returns metadata and content separately.
 */
export async function decryptFile(
  doublyEncrypted: Uint8Array,
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<DecryptedFile> {
  // First strip the outer encryption layer
  const encryptedData = await decryptOuterLayer(doublyEncrypted, password, config);
  
  const key = await deriveKey(password, config);
  
  // Parse header
  if (encryptedData.length < HEADER_SIZE) {
    throw new Error('Invalid encrypted file: too short');
  }
  
  const version = encryptedData[0];
  if (version !== VERSION) {
    throw new Error(`Unsupported vault format version: ${version}`);
  }
  
  const baseNonce = encryptedData.slice(1, 13);
  const chunkSize = readUint32BE(encryptedData, 13);
  const totalChunks = readUint32BE(encryptedData, 17);
  const metadataLength = readUint32BE(encryptedData, 21);
  
  let offset = HEADER_SIZE;
  
  // Decrypt chunk 0: metadata
  const encryptedMetadata = encryptedData.slice(offset, offset + metadataLength);
  offset += metadataLength;
  
  const metadataBytes = await decryptChunk(key, baseNonce, 0, encryptedMetadata, totalChunks);
  const metadata: FileMetadata = JSON.parse(new TextDecoder().decode(metadataBytes));
  
  // Decrypt content chunks
  const contentChunks: Uint8Array[] = [];
  const encryptedChunkSize = chunkSize + TAG_SIZE;
  
  for (let chunkIndex = 1; chunkIndex < totalChunks; chunkIndex++) {
    const isFinal = chunkIndex === totalChunks - 1;
    
    // Last chunk may be smaller
    let thisChunkSize: number;
    if (isFinal) {
      thisChunkSize = encryptedData.length - offset;
    } else {
      thisChunkSize = encryptedChunkSize;
    }
    
    const encryptedChunk = encryptedData.slice(offset, offset + thisChunkSize);
    offset += thisChunkSize;
    
    const decryptedChunk = await decryptChunk(key, baseNonce, chunkIndex, encryptedChunk, totalChunks);
    contentChunks.push(decryptedChunk);
  }
  
  const content = concat(...contentChunks);
  
  return { metadata, content };
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Decrypt and trigger download.
 */
export async function decryptAndDownload(
  encryptedData: ArrayBuffer,
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<void> {
  const { metadata, content } = await decryptFile(
    new Uint8Array(encryptedData), 
    password,
    config
  );
  
  const blob = new Blob([toBuffer(content)], { type: metadata.mimetype });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = metadata.filename;
  a.click();
  URL.revokeObjectURL(url);
}
