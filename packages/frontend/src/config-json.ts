/**
 * JSON export/import utilities for GenerationConfig.
 * Used for config backup and recovery.
 */

import type { GenerationConfig } from './generation-config';
import type { HashAlgorithmConfig, HashAlgorithm } from './hash-config';
import { 
  AVAILABLE_ALGORITHMS, 
  DEFAULT_ARGON2ID_CONFIG,
  DEFAULT_SCRYPT_CONFIG,
  DEFAULT_BCRYPT_CONFIG,
  DEFAULT_PBKDF2_CONFIG,
} from './hash-config';

const CONFIG_VERSION = 1;
const CONFIG_FILENAME = 'password-game-config.json';

// ============================================================
// JSON Schema Types
// ============================================================

interface ConfigJson {
  version: number;
  seedPhrase: string;
  gridRows: number;
  gridCols: number;
  hashAlgorithm: HashAlgorithmConfig;
  useRecommendedHash: boolean;
  includeSalt: boolean;
  salt: string;
}

// ============================================================
// Export
// ============================================================

export function configToJson(config: GenerationConfig): ConfigJson {
  return {
    version: CONFIG_VERSION,
    seedPhrase: config.seedPhrase,
    gridRows: config.gridRows,
    gridCols: config.gridCols,
    hashAlgorithm: config.hashAlgorithm,
    useRecommendedHash: config.useRecommendedHash,
    includeSalt: config.includeSalt,
    salt: config.salt,
  };
}

export function downloadConfigAsJson(config: GenerationConfig): void {
  const json = configToJson(config);
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = CONFIG_FILENAME;
  a.click();
  
  URL.revokeObjectURL(url);
}

// ============================================================
// Import & Validation
// ============================================================

export class ConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigParseError';
  }
}

export async function parseConfigFromJson(file: File): Promise<GenerationConfig> {
  const text = await file.text();
  
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ConfigParseError('Invalid JSON format');
  }
  
  return validateAndParseConfig(json);
}

function validateAndParseConfig(json: unknown): GenerationConfig {
  if (typeof json !== 'object' || json === null) {
    throw new ConfigParseError('Config must be an object');
  }
  
  const obj = json as Record<string, unknown>;
  
  // Version check
  if (typeof obj.version !== 'number') {
    throw new ConfigParseError('Missing or invalid version');
  }
  if (obj.version > CONFIG_VERSION) {
    throw new ConfigParseError(`Config version ${obj.version} is newer than supported (${CONFIG_VERSION})`);
  }
  
  // Required string fields
  if (typeof obj.seedPhrase !== 'string') {
    throw new ConfigParseError('Missing or invalid seedPhrase');
  }
  if (typeof obj.salt !== 'string') {
    throw new ConfigParseError('Missing or invalid salt');
  }
  
  // Required number fields
  if (typeof obj.gridRows !== 'number' || obj.gridRows < 2 || obj.gridRows > 10) {
    throw new ConfigParseError('gridRows must be a number between 2 and 10');
  }
  if (typeof obj.gridCols !== 'number' || obj.gridCols < 2 || obj.gridCols > 10) {
    throw new ConfigParseError('gridCols must be a number between 2 and 10');
  }
  
  // Required boolean fields
  if (typeof obj.useRecommendedHash !== 'boolean') {
    throw new ConfigParseError('Missing or invalid useRecommendedHash');
  }
  if (typeof obj.includeSalt !== 'boolean') {
    throw new ConfigParseError('Missing or invalid includeSalt');
  }
  
  // Hash algorithm validation
  const hashAlgorithm = validateHashAlgorithm(obj.hashAlgorithm);
  
  return {
    seedPhrase: obj.seedPhrase,
    gridRows: obj.gridRows,
    gridCols: obj.gridCols,
    hashAlgorithm,
    useRecommendedHash: obj.useRecommendedHash,
    includeSalt: obj.includeSalt,
    salt: obj.salt,
  };
}

function validateHashAlgorithm(value: unknown): HashAlgorithmConfig {
  if (typeof value !== 'object' || value === null) {
    throw new ConfigParseError('hashAlgorithm must be an object');
  }
  
  const obj = value as Record<string, unknown>;
  
  if (typeof obj.algorithm !== 'string') {
    throw new ConfigParseError('hashAlgorithm.algorithm must be a string');
  }
  
  if (!AVAILABLE_ALGORITHMS.includes(obj.algorithm as HashAlgorithm)) {
    throw new ConfigParseError(`Unknown algorithm: ${obj.algorithm}`);
  }
  
  const algorithm = obj.algorithm as HashAlgorithm;
  
  // Validate algorithm-specific fields, using defaults for missing values
  switch (algorithm) {
    case 'argon2id':
      return {
        algorithm: 'argon2id',
        memoryCost: validateNumber(obj.memoryCost, 'memoryCost', DEFAULT_ARGON2ID_CONFIG.memoryCost),
        timeCost: validateNumber(obj.timeCost, 'timeCost', DEFAULT_ARGON2ID_CONFIG.timeCost),
        parallelism: validateNumber(obj.parallelism, 'parallelism', DEFAULT_ARGON2ID_CONFIG.parallelism),
      };
    case 'scrypt':
      return {
        algorithm: 'scrypt',
        N: validateNumber(obj.N, 'N', DEFAULT_SCRYPT_CONFIG.N),
        r: validateNumber(obj.r, 'r', DEFAULT_SCRYPT_CONFIG.r),
        p: validateNumber(obj.p, 'p', DEFAULT_SCRYPT_CONFIG.p),
      };
    case 'bcrypt':
      return {
        algorithm: 'bcrypt',
        cost: validateNumber(obj.cost, 'cost', DEFAULT_BCRYPT_CONFIG.cost),
      };
    case 'pbkdf2':
      return {
        algorithm: 'pbkdf2',
        iterations: validateNumber(obj.iterations, 'iterations', DEFAULT_PBKDF2_CONFIG.iterations),
        hash: validatePbkdf2Hash(obj.hash),
      };
    case 'sha256':
      return { algorithm: 'sha256' };
  }
}

function validateNumber(value: unknown, name: string, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'number') {
    throw new ConfigParseError(`${name} must be a number`);
  }
  return value;
}

function validatePbkdf2Hash(value: unknown): 'sha256' | 'sha512' {
  if (value === undefined) return 'sha256';
  if (value !== 'sha256' && value !== 'sha512') {
    throw new ConfigParseError('pbkdf2 hash must be "sha256" or "sha512"');
  }
  return value;
}

