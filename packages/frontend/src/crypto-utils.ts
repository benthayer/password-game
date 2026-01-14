import CryptoJS from 'crypto-js';
import * as corpus from '../corpus.json';
import type { GenerationConfig } from './generation-config';

const wordList: string[] = corpus.words;

/**
 * Generate a 256-bit random salt encoded as base64
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(32); // 256 bits = 32 bytes
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Secure hash function using SHA-256
 */
export function hash(input: string): string {
  return CryptoJS.SHA256(input).toString();
}

/**
 * Deterministic JSON serialization with sorted keys.
 * Ensures identical objects produce identical strings regardless of property order.
 */
export function canonicalStringify(obj: unknown): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(k => `"${k}":${canonicalStringify((obj as Record<string, unknown>)[k])}`);
    return '{' + pairs.join(',') + '}';
  }
  return String(obj);
}

/**
 * Hash the config to produce a config identity.
 * This captures "what game/rules are we using".
 */
export function hashConfig(config: GenerationConfig): string {
  return hash(canonicalStringify(config));
}

/**
 * Hash the subpassword (words selected so far).
 * This captures "what words have been selected".
 */
export function hashWords(words: string[]): string {
  return hash(words.join(':'));
}

/**
 * Combine config hash and subpassword hash to get the identity hash.
 * This represents "where we are in this specific game".
 */
export function getIdentityHash(config: GenerationConfig, subpassword: string[]): string {
  return hash(hashConfig(config) + hashWords(subpassword));
}

export function hashModN(hash: string, n: number): number {
  const hashBigInt = BigInt('0x' + hash);
  return Number(hashBigInt % BigInt(n));
}

export function getWordFromHash(hash: string): string {
  const index = hashModN(hash, wordList.length);
  return wordList[index] as string;
}

/**
 * Derive the word at a specific grid position.
 * Uses +row,col notation for deterministic derivation.
 */
export function getWordAtPosition(identityHash: string, row: number, col: number): string {
  const positionHash = hash(identityHash + `+${row},${col}`);
  return getWordFromHash(positionHash);
}

/**
 * Get all words for the grid as a 2D array.
 * words[row][col] corresponds to derivation +row,col
 */
export function getNextWords(subpassword: string[], config: GenerationConfig): string[][] {
  const identityHash = getIdentityHash(config, subpassword);
  const grid: string[][] = [];
  
  for (let row = 0; row < config.gridRows; row++) {
    const rowWords: string[] = [];
    for (let col = 0; col < config.gridCols; col++) {
      rowWords.push(getWordAtPosition(identityHash, row, col));
    }
    grid.push(rowWords);
  }
  
  return grid;
}

/**
 * Flatten a 2D word grid to a 1D array (row-major order).
 */
export function flattenGrid(grid: string[][]): string[] {
  return grid.flat();
}

/**
 * Get all words for the grid as a flat array.
 * Convenience wrapper for consumers that don't need 2D structure.
 */
export function getNextWordsFlat(subpassword: string[], config: GenerationConfig): string[] {
  return flattenGrid(getNextWords(subpassword, config));
}

export function selectRandomNextWord(subpassword: string[], config: GenerationConfig): string[] {
  const nextWords = getNextWordsFlat(subpassword, config);
  const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)] as string;
  return [...subpassword, nextWord];
}

export function generatePassword(numWords: number, config: GenerationConfig): string[] {
  let subpassword: string[] = [];
  for (let i = 0; i < numWords; i++) {
    subpassword = selectRandomNextWord(subpassword, config);
  }
  return subpassword;
}
