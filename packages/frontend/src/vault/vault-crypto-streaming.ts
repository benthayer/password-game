/**
 * Streaming Encrypted Vault Format v2
 * 
 * Uses libsodium crypto_secretstream_xchacha20poly1305 for streaming encryption.
 * This is a standard, audited format that handles nonce management internally.
 * 
 * Format:
 * [24 bytes]  Stream header (from crypto_secretstream_init_push)
 * [4 bytes]   Metadata ciphertext length (uint32 BE)
 * [N bytes]   Encrypted metadata chunk (MESSAGE tag)
 * [chunks]    Encrypted file content chunks (MESSAGE tag, except last is FINAL)
 * 
 * Each encrypted chunk = plaintext + 17 bytes overhead (1 tag byte + 16 auth bytes)
 * Content chunks are CHUNK_SIZE plaintext (64KB), so CHUNK_SIZE + 17 ciphertext.
 */

import sodium from 'libsodium-wrappers';
import { createHashFunction } from '../hash-function';
import type { FullHashConfig } from '../hash-config';
import { DEFAULT_FULL_HASH_CONFIG } from '../hash-config';

// =============================================================================
// CONSTANTS
// =============================================================================

const CHUNK_SIZE = 64 * 1024; // 64KB plaintext per chunk

// libsodium crypto_secretstream constants (hardcoded to avoid accessing sodium before ready)
// These are fixed values for XChaCha20-Poly1305:
const STREAM_HEADER_SIZE = 24; // crypto_secretstream_xchacha20poly1305_HEADERBYTES
const ABYTES = 17;             // crypto_secretstream_xchacha20poly1305_ABYTES (1 tag + 16 auth)

// Our custom header addition (to store metadata chunk length)
const METADATA_LENGTH_SIZE = 4; // uint32 BE

// Key derivation suffixes
const SUFFIX_SIGNING_KEY = ':+signing-key';
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
// INITIALIZATION
// =============================================================================

let sodiumReady = false;

async function ensureSodiumReady(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

// =============================================================================
// KEY DERIVATION
// =============================================================================

function formatPasswordForHash(password: string[], suffix: string): string {
  return password.join(':') + suffix;
}

export interface SigningKeys {
  /** Hex-encoded Ed25519 public key. This IS the account address. */
  address: string;
  /** Hex-encoded Ed25519 secret key (64 bytes). Never leaves the client. */
  signingSecretKeyHex: string;
}

/**
 * Derive the Ed25519 signing keypair for a password.
 * The public key is the account address; the secret key signs every
 * server operation (ts:nonce), so knowing the address grants nothing.
 *
 * The KDF output format varies by algorithm (hex for most, bcrypt-encoded
 * for bcrypt), so it's normalized to a 32-byte seed with generichash.
 */
export async function getSigningKeys(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<SigningKeys> {
  await ensureSodiumReady();
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_SIGNING_KEY);
  const kdfOutput = await hashFn(input);
  const seed = sodium.crypto_generichash(32, kdfOutput, null);
  const { publicKey, privateKey } = sodium.crypto_sign_seed_keypair(seed);
  return {
    address: sodium.to_hex(publicKey),
    signingSecretKeyHex: sodium.to_hex(privateKey),
  };
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
 * Derive the primary encryption key from password.
 * Returns 32 bytes for XChaCha20-Poly1305.
 */
async function derivePrimaryKey(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<Uint8Array> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_PRIMARY_KEY);
  const keyHex = await hashFn(input);
  return hexToBytes(keyHex.slice(0, 64)); // 32 bytes = 64 hex chars
}

/**
 * Get the primary encryption key as hex.
 * Used by Web Workers since Uint8Array can be transferred but this is cleaner.
 */
export async function getPrimaryKeyHex(
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<string> {
  const hashFn = createHashFunction(config);
  const input = formatPasswordForHash(password, SUFFIX_PRIMARY_KEY);
  const keyHex = await hashFn(input);
  return keyHex.slice(0, 64);
}

/**
 * Import a primary key from hex.
 */
export function importPrimaryKeyFromHex(keyHex: string): Uint8Array {
  return hexToBytes(keyHex);
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

// =============================================================================
// ENCRYPTION
// =============================================================================

/**
 * Encrypt a file with libsodium crypto_secretstream.
 * Returns the complete encrypted blob.
 * 
 * Memory usage: O(CHUNK_SIZE), not O(file.size)
 */
export async function encryptFile(
  file: File, 
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<Uint8Array> {
  await ensureSodiumReady();
  
  const key = await derivePrimaryKey(password, config);
  return encryptFileWithKeyBytes(file, key);
}

/**
 * Encrypt a file using a pre-derived key hex (for worker usage).
 */
export async function encryptFileWithKey(
  file: File,
  keyHex: string
): Promise<Uint8Array> {
  await ensureSodiumReady();
  
  const key = importPrimaryKeyFromHex(keyHex);
  return encryptFileWithKeyBytes(file, key);
}

/**
 * Core encryption logic with raw key bytes.
 */
async function encryptFileWithKeyBytes(
  file: File,
  key: Uint8Array
): Promise<Uint8Array> {
  // Initialize the secretstream
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  
  // Encrypt metadata first (to know its ciphertext length)
  const metadata: FileMetadata = {
    filename: file.name,
    mimetype: file.type || 'application/octet-stream',
    size: file.size,
  };
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
  const encryptedMetadata = sodium.crypto_secretstream_xchacha20poly1305_push(
    state,
    metadataBytes,
    null,
    sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
  );
  
  // Build header: stream header + metadata ciphertext length
  const metadataLengthBytes = writeUint32BE(encryptedMetadata.length);
  
  const chunks: Uint8Array[] = [
    header,
    metadataLengthBytes,
    encryptedMetadata
  ];
  
  // Encrypt file content in chunks
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const isLastChunk = end >= file.size;
    
    const slice = file.slice(offset, end);
    const plaintext = new Uint8Array(await slice.arrayBuffer());
    
    const tag = isLastChunk 
      ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
      : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    
    const encryptedChunk = sodium.crypto_secretstream_xchacha20poly1305_push(
      state,
      plaintext,
      null,
      tag
    );
    chunks.push(encryptedChunk);
    
    offset = end;
  }
  
  // Handle empty files (still need a final chunk)
  if (file.size === 0) {
    const encryptedChunk = sodium.crypto_secretstream_xchacha20poly1305_push(
      state,
      new Uint8Array(0),
      null,
      sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    );
    chunks.push(encryptedChunk);
  }
  
  return concat(...chunks);
}

// =============================================================================
// DECRYPTION
// =============================================================================

/**
 * Decrypt a file encrypted with crypto_secretstream.
 * Returns the decrypted file with metadata.
 */
export async function decryptFile(
  encrypted: Uint8Array,
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<DecryptedFile> {
  await ensureSodiumReady();
  
  const key = await derivePrimaryKey(password, config);
  return decryptFileWithKeyBytes(encrypted, key);
}

/**
 * Decrypt a file using a pre-derived key hex (for worker usage).
 */
export async function decryptFileWithKey(
  encrypted: Uint8Array,
  keyHex: string
): Promise<DecryptedFile> {
  await ensureSodiumReady();
  
  const key = importPrimaryKeyFromHex(keyHex);
  return decryptFileWithKeyBytes(encrypted, key);
}

/**
 * Core decryption logic with raw key bytes.
 */
function decryptFileWithKeyBytes(
  encrypted: Uint8Array,
  key: Uint8Array
): DecryptedFile {
  let offset = 0;
  
  // Read stream header
  const streamHeader = encrypted.slice(offset, offset + STREAM_HEADER_SIZE);
  offset += STREAM_HEADER_SIZE;
  
  // Read metadata ciphertext length
  const metadataLength = readUint32BE(encrypted, offset);
  offset += METADATA_LENGTH_SIZE;
  
  // Initialize decryption state
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(streamHeader, key);
  
  // Decrypt metadata
  const metadataChunk = encrypted.slice(offset, offset + metadataLength);
  offset += metadataLength;
  
  const metadataResult = sodium.crypto_secretstream_xchacha20poly1305_pull(state, metadataChunk, null);
  if (!metadataResult) {
    throw new Error('Failed to decrypt metadata');
  }
  
  const metadata: FileMetadata = JSON.parse(new TextDecoder().decode(metadataResult.message));
  
  // Decrypt content chunks
  const contentChunks: Uint8Array[] = [];
  const expectedChunkSize = CHUNK_SIZE + ABYTES;
  
  while (offset < encrypted.length) {
    const remainingBytes = encrypted.length - offset;
    const chunkSize = Math.min(expectedChunkSize, remainingBytes);
    
    const chunk = encrypted.slice(offset, offset + chunkSize);
    offset += chunkSize;
    
    const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, chunk, null);
    if (!result) {
      throw new Error('Failed to decrypt content chunk');
    }
    
    contentChunks.push(result.message);
    
    // Check if this was the final chunk
    if (result.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
      break;
    }
  }
  
  // Combine content chunks
  const content = concat(...contentChunks);
  
  return { metadata, content };
}

// =============================================================================
// OUTER LAYER DECRYPTION (server-added crypto_secretstream layer)
// =============================================================================

/**
 * Decrypt the outer encryption layer added by the server.
 * Server uses crypto_secretstream_xchacha20poly1305 with chunked streaming.
 * 
 * Input: doubly-encrypted data (header + encrypted chunks)
 * Output: singly-encrypted data (our crypto_secretstream format)
 */
export async function decryptOuterLayer(
  doublyEncrypted: Uint8Array,
  secondaryKeyHex: string
): Promise<Uint8Array> {
  await ensureSodiumReady();
  
  const secondaryKey = hexToBytes(secondaryKeyHex).slice(0, 32);
  
  // Extract stream header
  const streamHeader = doublyEncrypted.slice(0, STREAM_HEADER_SIZE);
  let offset = STREAM_HEADER_SIZE;
  
  // Initialize decryption state
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(streamHeader, secondaryKey);
  
  // Decrypt all chunks
  const decryptedChunks: Uint8Array[] = [];
  const expectedChunkSize = CHUNK_SIZE + ABYTES;
  
  while (offset < doublyEncrypted.length) {
    const remainingBytes = doublyEncrypted.length - offset;
    const chunkSize = Math.min(expectedChunkSize, remainingBytes);
    
    const chunk = doublyEncrypted.slice(offset, offset + chunkSize);
    offset += chunkSize;
    
    const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, chunk, null);
    if (!result) {
      throw new Error('Failed to decrypt outer layer chunk');
    }
    
    decryptedChunks.push(result.message);
    
    // Check if this was the final chunk
    if (result.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
      break;
    }
  }
  
  return concat(...decryptedChunks);
}

/**
 * Full download decryption: strip outer layer, then decrypt inner layer.
 * This is the convenience function for the complete download flow.
 */
export async function decryptDownloadedFile(
  doublyEncrypted: Uint8Array,
  password: string[],
  config: FullHashConfig = DEFAULT_FULL_HASH_CONFIG
): Promise<DecryptedFile> {
  const secondaryKeyHex = await getSecondaryKey(password, config);
  const singlyEncrypted = await decryptOuterLayer(doublyEncrypted, secondaryKeyHex);
  return decryptFile(singlyEncrypted, password, config);
}
