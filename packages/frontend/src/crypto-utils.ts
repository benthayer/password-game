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
 * @param {string} string - The string to hash
 * @returns {string} - The hexadecimal hash of the input string
 */
export function hash(string: string): string {
  return CryptoJS.SHA256(string).toString();
}

export function hashModN(hash: string, n: number): number {
  const hashBigInt = BigInt('0x' + hash);
  return Number(hashBigInt % BigInt(n));
}

export function getWordFromHash(hash: string): string {
  const index = hashModN(hash, wordList.length);
  return wordList[index] as string;
}

export function hashSubpassword(subpassword: string[], config: GenerationConfig): string {
  // Hash so that we have the conceptual cleanness of delimited strings
  let combined = `${config.gridRows}x${config.gridCols}:${hash(config.seedPhrase)}`;
  for (const word of subpassword) {
    combined += `:${word}`;
  }
  return hash(combined);
}

export function getNextWords(subpassword: string[], config: GenerationConfig): string[] {
  const baseHash = hashSubpassword(subpassword, config);
  let tempHash = baseHash;
  const words: string[] = [];
  const numWords = config.gridRows * config.gridCols
  for (let i = 0; i < numWords; i++) {
    words.push(getWordFromHash(tempHash));
    tempHash = hash(tempHash);
  }
  return words;
}

export function selectRandomNextWord(subpassword: string[], config: GenerationConfig): string[] {
  const nextWords = getNextWords(subpassword, config);
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
