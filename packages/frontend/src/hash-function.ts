/**
 * Hash function factory.
 * Takes a config, returns a hash function.
 */

import { argon2id, scrypt, bcrypt, pbkdf2 } from 'hash-wasm';
import CryptoJS from 'crypto-js';
import type { 
  HashAlgorithmConfig, 
  FullHashConfig,
  Argon2idConfig,
  ScryptConfig,
  BcryptConfig,
  Pbkdf2Config,
} from './hash-config';

// ============================================================
// Hash Function Type
// ============================================================

export type HashFunction = (input: string) => Promise<string>;

// ============================================================
// Text Encoding Helpers
// ============================================================

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// ============================================================
// Per-Algorithm Hash Functions
// ============================================================

async function hashArgon2id(input: string, salt: string, config: Argon2idConfig): Promise<string> {
  // Argon2 requires a salt of at least 8 bytes
  // If salt is empty, use a fixed minimum-length salt
  const saltBytes = salt 
    ? stringToUint8Array(salt) 
    : new Uint8Array(8); // 8 zero bytes when no salt
  
  return await argon2id({
    password: stringToUint8Array(input),
    salt: saltBytes,
    parallelism: config.parallelism,
    iterations: config.timeCost,
    memorySize: config.memoryCost,
    hashLength: 32,
    outputType: 'hex',
  });
}

async function hashScrypt(input: string, salt: string, config: ScryptConfig): Promise<string> {
  const saltBytes = salt 
    ? stringToUint8Array(salt) 
    : new Uint8Array(8);
  
  return await scrypt({
    password: stringToUint8Array(input),
    salt: saltBytes,
    costFactor: config.N,
    blockSize: config.r,
    parallelism: config.p,
    hashLength: 32,
    outputType: 'hex',
  });
}

async function hashBcrypt(input: string, salt: string, config: BcryptConfig): Promise<string> {
  // bcrypt has its own salt format, we incorporate user salt into input
  const combinedInput = salt ? `${salt}:${input}` : input;
  
  return await bcrypt({
    password: combinedInput,
    costFactor: config.cost,
    outputType: 'encoded', // bcrypt format includes salt
  });
}

async function hashPbkdf2(input: string, salt: string, config: Pbkdf2Config): Promise<string> {
  const saltBytes = salt 
    ? stringToUint8Array(salt) 
    : new Uint8Array(8);
  
  return await pbkdf2({
    password: stringToUint8Array(input),
    salt: saltBytes,
    iterations: config.iterations,
    hashLength: 32,
    hashFunction: config.hash === 'sha512' ? 'SHA-512' : 'SHA-256',
    outputType: 'hex',
  });
}

async function hashSha256(input: string, salt: string): Promise<string> {
  const combinedInput = salt ? `${salt}:${input}` : input;
  return CryptoJS.SHA256(combinedInput).toString();
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Creates a hash function from configuration.
 * This is the main export - config in, function out.
 */
export function createHashFunction(config: FullHashConfig): HashFunction {
  const { algorithmConfig, includeSalt, salt } = config;
  const effectiveSalt = includeSalt ? salt : '';
  
  switch (algorithmConfig.algorithm) {
    case 'argon2id':
      return (input) => hashArgon2id(input, effectiveSalt, algorithmConfig);
    
    case 'scrypt':
      return (input) => hashScrypt(input, effectiveSalt, algorithmConfig);
    
    case 'bcrypt':
      return (input) => hashBcrypt(input, effectiveSalt, algorithmConfig);
    
    case 'pbkdf2':
      return (input) => hashPbkdf2(input, effectiveSalt, algorithmConfig);
    
    case 'sha256':
      return (input) => Promise.resolve(hashSha256(input, effectiveSalt));
  }
}

/**
 * Create a hash function from just the algorithm config (no salt handling).
 * Useful when you want to handle salt separately.
 */
export function createAlgorithmHashFunction(config: HashAlgorithmConfig): (input: string, salt: string) => Promise<string> {
  switch (config.algorithm) {
    case 'argon2id':
      return (input, salt) => hashArgon2id(input, salt, config);
    
    case 'scrypt':
      return (input, salt) => hashScrypt(input, salt, config);
    
    case 'bcrypt':
      return (input, salt) => hashBcrypt(input, salt, config);
    
    case 'pbkdf2':
      return (input, salt) => hashPbkdf2(input, salt, config);
    
    case 'sha256':
      return (input, salt) => Promise.resolve(hashSha256(input, salt));
  }
}

// ============================================================
// Grid Expansion (always SHA256)
// ============================================================

/**
 * SHA256 for grid expansion. Fast, no config needed.
 */
export function gridExpansionHash(input: string): string {
  return CryptoJS.SHA256(input).toString();
}

