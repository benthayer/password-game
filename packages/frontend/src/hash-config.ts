/**
 * Configurable hash function system for Password Game.
 * 
 * Grid expansion: Always SHA256 (fast, good UX)
 * Final derivation: Configurable (Argon2id, scrypt, bcrypt, etc.)
 */

// ============================================================
// Hash Function Config Types (discriminated union by algorithm)
// ============================================================

export interface Argon2idConfig {
  algorithm: 'argon2id';
  memoryCost: number;    // in KB (e.g., 65536 = 64MB)
  timeCost: number;      // iterations
  parallelism: number;   // lanes
}

export interface ScryptConfig {
  algorithm: 'scrypt';
  N: number;             // CPU/memory cost (power of 2)
  r: number;             // block size
  p: number;             // parallelism
}

export interface BcryptConfig {
  algorithm: 'bcrypt';
  cost: number;          // log2 of iterations (e.g., 12 = 4096 iterations)
}

export interface Pbkdf2Config {
  algorithm: 'pbkdf2';
  iterations: number;
  hash: 'sha256' | 'sha512';
}

export interface Sha256Config {
  algorithm: 'sha256';
  // No params - just raw SHA256 (not recommended for production)
}

export type HashAlgorithmConfig = 
  | Argon2idConfig 
  | ScryptConfig 
  | BcryptConfig 
  | Pbkdf2Config
  | Sha256Config;

export type HashAlgorithm = HashAlgorithmConfig['algorithm'];

// ============================================================
// Full Hash Configuration (algorithm + salt)
// ============================================================

export interface FullHashConfig {
  algorithmConfig: HashAlgorithmConfig;
  includeSalt: boolean;
  salt: string;
}

// ============================================================
// Defaults
// ============================================================

export const DEFAULT_ARGON2ID_CONFIG: Argon2idConfig = {
  algorithm: 'argon2id',
  memoryCost: 65536,    // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export const DEFAULT_SCRYPT_CONFIG: ScryptConfig = {
  algorithm: 'scrypt',
  N: 1048576,           // 2^20
  r: 8,
  p: 1,
};

export const DEFAULT_BCRYPT_CONFIG: BcryptConfig = {
  algorithm: 'bcrypt',
  cost: 12,
};

export const DEFAULT_PBKDF2_CONFIG: Pbkdf2Config = {
  algorithm: 'pbkdf2',
  iterations: 600000,
  hash: 'sha256',
};

export const DEFAULT_SHA256_CONFIG: Sha256Config = {
  algorithm: 'sha256',
};

export const DEFAULT_FULL_HASH_CONFIG: FullHashConfig = {
  algorithmConfig: DEFAULT_ARGON2ID_CONFIG,
  includeSalt: false,
  salt: '',
};

export function getDefaultConfigForAlgorithm(algorithm: HashAlgorithm): HashAlgorithmConfig {
  switch (algorithm) {
    case 'argon2id': return { ...DEFAULT_ARGON2ID_CONFIG };
    case 'scrypt': return { ...DEFAULT_SCRYPT_CONFIG };
    case 'bcrypt': return { ...DEFAULT_BCRYPT_CONFIG };
    case 'pbkdf2': return { ...DEFAULT_PBKDF2_CONFIG };
    case 'sha256': return { ...DEFAULT_SHA256_CONFIG };
  }
}

// ============================================================
// Algorithm metadata (for UI)
// ============================================================

export interface AlgorithmMeta {
  name: string;
  description: string;
  recommended: boolean;
}

export const ALGORITHM_META: Record<HashAlgorithm, AlgorithmMeta> = {
  argon2id: {
    name: 'Argon2id',
    description: 'Memory-hard, GPU/ASIC resistant. Recommended.',
    recommended: true,
  },
  scrypt: {
    name: 'scrypt',
    description: 'Memory-hard, older than Argon2. Still secure.',
    recommended: false,
  },
  bcrypt: {
    name: 'bcrypt',
    description: 'Time-tested, but not memory-hard. Fixed 4KB memory.',
    recommended: false,
  },
  pbkdf2: {
    name: 'PBKDF2',
    description: 'NIST standard. NOT memory-hard — weaker against GPUs.',
    recommended: false,
  },
  sha256: {
    name: 'SHA-256 (raw)',
    description: 'Fast, no protection against brute force. Not recommended.',
    recommended: false,
  },
};

export const AVAILABLE_ALGORITHMS: HashAlgorithm[] = [
  'argon2id',
  'scrypt', 
  'bcrypt',
  'pbkdf2',
  'sha256',
];

