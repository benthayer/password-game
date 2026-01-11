/**
 * Centralized configuration for the word game grid and hash settings
 */

import type { HashAlgorithmConfig } from './hash-config';
import { DEFAULT_ARGON2ID_CONFIG } from './hash-config';

// Re-export hash config types for convenience
export type { HashAlgorithmConfig } from './hash-config';
export { 
  AVAILABLE_ALGORITHMS, 
  ALGORITHM_META, 
  getDefaultConfigForAlgorithm,
  DEFAULT_ARGON2ID_CONFIG,
  DEFAULT_SCRYPT_CONFIG,
  DEFAULT_BCRYPT_CONFIG,
  DEFAULT_PBKDF2_CONFIG,
  DEFAULT_SHA256_CONFIG,
} from './hash-config';
export type { HashAlgorithm } from './hash-config';

export interface GenerationConfig {
  // Grid settings
  seedPhrase: string;
  gridRows: number;
  gridCols: number;
  
  // Hash settings (for final key derivation)
  hashAlgorithm: HashAlgorithmConfig;
  includeSalt: boolean;
  salt: string;
}

export const DEFAULT_CONFIG: GenerationConfig = {
  seedPhrase: '',
  gridRows: 4,
  gridCols: 4,
  hashAlgorithm: DEFAULT_ARGON2ID_CONFIG,
  includeSalt: true,
  salt: '',
};

export function getGridSize(config: GenerationConfig): number {
  return config.gridRows * config.gridCols;
}

export function calculateEntropyPerWord(config: GenerationConfig): number {
  const numOptions = getGridSize(config);
  return Math.log2(numOptions);
}

export function calculateWordsFor80Bits(config: GenerationConfig): number {
  const entropyPerWord = calculateEntropyPerWord(config);
  return 80 / entropyPerWord;
}

/**
 * Extract hash config in the format vault-crypto expects
 */
export function getHashConfig(config: GenerationConfig) {
  return {
    algorithmConfig: config.hashAlgorithm,
    includeSalt: config.includeSalt,
    salt: config.salt,
  };
}

/**
 * Configuration for practice mode display options
 */
export interface PracticeDisplayConfig {
  displayMode: 'none' | 'previous' | 'all';
  highlightCurrentWord: boolean; // Highlight current word in the display
  hint: boolean; // Highlight correct word in the selector
}

export const DEFAULT_PRACTICE_DISPLAY_CONFIG: PracticeDisplayConfig = {
  displayMode: 'all',
  highlightCurrentWord: true,
  hint: true,
};

// Legacy exports for backwards compatibility
export const GRID_COLUMNS = DEFAULT_CONFIG.gridCols;
export const GRID_ROWS = DEFAULT_CONFIG.gridRows;
export const GRID_SIZE = getGridSize(DEFAULT_CONFIG);
