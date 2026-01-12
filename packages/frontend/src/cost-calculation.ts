/**
 * Cost-to-crack calculations with rigorous citations.
 * 
 * ## Principle: Every Number Must Be Justified
 * 
 * Each numeric value is either:
 * 1. DIRECTLY CITED from a verifiable source, or
 * 2. A BOUND derived from cited values (marked with "at least" / "at most")
 * 
 * When direct measurements don't exist, we use conservative bounds that
 * UNDERESTIMATE the true cost (favor the attacker).
 * 
 * ## Primary Sources
 * 
 * [1] atoponce GitHub Gist - "Verifiable brute force strength rates"
 *     https://gist.github.com/atoponce/a7715930ae6eb7d6b487f2f76b57a68d
 *     RTX 4090 benchmarks from Sam Croley (hashcat core developer)
 *     VERIFIED VALUES:
 *     - SHA-256: 21.9755 GH/s
 *     - bcrypt (cost=5): 184.0 kH/s
 * 
 * [2] Sam Croley hashcat benchmark - RTX 4090
 *     https://gist.github.com/Chick3nman/32e662a5bb63bc4f51b847bb422222fd
 *     Primary source for [1]'s RTX 4090 data
 * 
 * [3] jdspugh.github.io - "Hash Algorithms" (April 2023)
 *     https://jdspugh.github.io/2023/04/06/hash-algorithms.html
 *     VERIFIED VALUES:
 *     - Argon2d (512 KB, t=1, p=1): 800 H/s on Radeon VII
 *     - SHA-256 ASIC (Antminer S19 Pro): 110 TH/s at $3200
 * 
 * [4] arXiv:2504.17121 - "Evaluating Argon2 Adoption and Effectiveness"
 *     https://arxiv.org/abs/2504.17121
 *     VERIFIED VALUES:
 *     - 46 MiB → 2048 MiB (44.5x memory) = only 23.3% more protection
 *     - OWASP 46 MiB reduces compromise by 42.5% vs SHA-256 at $1/account
 * 
 * [5] CipherTools - "How to Choose the Right Parameters for Argon2"
 *     https://www.ciphertools.org/blogs/how-to-choose-the-right-parameters-for-argon2
 *     VERIFIED STATEMENT: "increasing parallelism can speed up legitimate
 *     hashing processes, it can also allow attackers to parallelize"
 * 
 * [6] scrypt paper - Colin Percival (2009)
 *     https://www.tarsnap.com/scrypt/scrypt.pdf
 *     VERIFIED FORMULA: Memory = 128 * N * r bytes (Section 5)
 * 
 * [7] bcrypt paper - Provos & Mazières (1999)
 *     https://www.usenix.org/legacy/events/usenix99/provos/provos.pdf
 *     VERIFIED FORMULA: iterations = 2^cost (Section 3)
 * 
 * [8] NIST SP 800-132 - PBKDF2 Recommendation
 *     https://csrc.nist.gov/publications/detail/sp/800-132/final
 *     VERIFIED STATEMENT: iteration count scales linearly with time
 * 
 * [9] Vast.ai GPU Marketplace (checked January 2026)
 *     https://vast.ai/
 *     OBSERVED RANGE: RTX 4090 rental $0.25-0.60/hour
 *     We use $0.25/hour (lower bound, favors attacker)
 * 
 * [10] RFC 7914 - The scrypt Password-Based Key Derivation Function
 *      https://www.rfc-editor.org/rfc/rfc7914.html
 *      VERIFIED STATEMENT (Section 2): "computations of SMix are independent,
 *      a large value of p can be used to increase the computational cost
 *      of scrypt without increasing the memory usage"
 * 
 * [11] Sam Croley hashcat benchmark - scrypt modes (RTX 4090)
 *      https://gist.github.com/Chick3nman/32e662a5bb63bc4f51b847bb422222fd
 *      VERIFIED VALUES:
 *      - Mode 8900 (scrypt N=1024, r=1, p=1): 7,126 H/s
 *      - Mode 15700 (Ethereum Wallet scrypt, N=262144): 1 H/s
 * 
 * [12] hashcat example hashes - scrypt format
 *      https://hashcat.net/wiki/doku.php?id=example_hashes
 *      VERIFIED FORMAT: Mode 8900 uses SCRYPT:1024:1:1 (N=1024, r=1, p=1)
 * 
 * Last updated: January 2026
 */

import type { HashAlgorithmConfig } from './hash-config';

// ============================================================
// Cited Constants
// ============================================================

// [1,2] RTX 4090 SHA-256 hashrate: 21.9755 GH/s (DIRECTLY CITED)
const SHA256_RTX4090_HASHRATE = 21.9755e9;

// [1,2] RTX 4090 bcrypt hashrate at cost=5: 184.0 kH/s (DIRECTLY CITED)
const BCRYPT_RTX4090_HASHRATE_COST5 = 184.0e3;

// [3] Radeon VII Argon2d hashrate at 512KB, t=1, p=1: 800 H/s (DIRECTLY CITED)
const ARGON2_RADEON7_HASHRATE_512KB = 800;

// [11] RTX 4090 scrypt hashrate at N=1024, r=1, p=1: 7,126 H/s (DIRECTLY CITED)
const SCRYPT_RTX4090_HASHRATE_N1024_R1 = 7126;

// [11] RTX 4090 Ethereum scrypt hashrate at N=262144: 1 H/s (DIRECTLY CITED)
const SCRYPT_RTX4090_HASHRATE_ETHEREUM = 1;

// [9] GPU rental lower bound: $0.25/hour (OBSERVED LOWER BOUND)
const GPU_RENTAL_COST_PER_HOUR = 0.25;

// ============================================================
// Cost Per Hash Estimates (USD)
// ============================================================

interface CostPerHashEstimate {
  costUsd: number;
  description: string;
}

/**
 * Argon2id cost calculation.
 * 
 * ## Cited Benchmark [3]
 * 
 * Radeon VII: 800 H/s at 512 KB, t=1, p=1 (Argon2d for Nimiq mining)
 * 
 * ## Bound Derivation
 * 
 * For Argon2id at 64MB, t=3:
 * - More memory (128x) and more iterations (3x) than benchmark
 * - Therefore attacker hashrate is AT MOST 800 H/s
 * - Using 800 H/s gives a LOWER BOUND on attacker cost
 * 
 * Cost calculation:
 *   Hashes/hour = 800 * 3600 = 2,880,000
 *   Cost/hash ≥ $0.25 / 2,880,000 = $8.7e-8
 * 
 * We use $8e-8 as the lower bound (rounded down, favors attacker).
 * 
 * ## Memory/Time Scaling
 * 
 * We do NOT scale down from the benchmark because:
 * - Scaling assumes linear relationship (not cited)
 * - Using benchmark directly gives conservative LOWER BOUND
 * 
 * ## Parallelism [5]
 * 
 * From CipherTools: attackers can also parallelize.
 * Conservative: ignore parallelism (does not increase cost).
 */
function getArgon2idCostPerHash(
  _memoryCostKB: number, 
  _timeCost: number, 
  _parallelism: number
): CostPerHashEstimate {
  // Lower bound on cost per hash
  // Source: [3] 800 H/s upper bound on attacker speed, [9] $0.25/hr lower bound on rental
  // 
  // We intentionally do NOT scale for memory/time because:
  // - Any scaling would INCREASE the cost estimate
  // - Without a cited scaling factor, we use the benchmark directly
  // - This gives a conservative LOWER BOUND
  const hashesPerHour = ARGON2_RADEON7_HASHRATE_512KB * 3600;
  const costUsd = GPU_RENTAL_COST_PER_HOUR / hashesPerHour;
  
  return {
    costUsd,
    description: `Argon2id (≥$${costUsd.toExponential(1)}/hash)`,
  };
}

/**
 * scrypt cost calculation.
 * 
 * ## Cited Benchmarks [11,12]
 * 
 * RTX 4090 hashcat benchmarks (Sam Croley):
 * - Mode 8900 (N=1024, r=1, p=1): 7,126 H/s
 * - Mode 15700 (Ethereum N=262144): 1 H/s
 * 
 * ## Memory Formula [6]
 * 
 * Memory = 128 * N * r bytes
 * - Mode 8900 (N=1024, r=1): 128 KB
 * - Ethereum (N=262144, assumed r=8): 256 MB
 * - Password scrypt (N=16384, r=8): 16 MB (common default)
 * 
 * ## Bound Derivation
 * 
 * We use the mode 8900 benchmark (N=1024, r=1) as our anchor point and
 * scale inversely with memory:
 * 
 *   Memory_target = 128 * N * r bytes
 *   Memory_8900 = 128 * 1024 * 1 = 128 KB
 *   Hashrate_upper_bound = 7126 * (Memory_8900 / Memory_target)
 * 
 * This gives an UPPER BOUND on attacker hashrate → LOWER BOUND on cost.
 * 
 * Cross-validation with Ethereum benchmark:
 *   Ethereum memory ≈ 256 MB (if r=8) or 32 MB (if r=1)
 *   Predicted hashrate: 7126 * 128KB / 256MB = 3.5 H/s (if r=8)
 *   Actual: 1 H/s → our prediction is 3.5x too optimistic for attacker
 *   This confirms our bound is conservative (favors attacker).
 * 
 * ## p Parameter [10]
 * 
 * RFC 7914: "computations of SMix are independent" - attacker must do all p.
 * Cost scales linearly with p (CITED).
 */
function getScryptCostPerHash(N: number, r: number, p: number): CostPerHashEstimate {
  // Reference point: Mode 8900 (N=1024, r=1, p=1) → 7,126 H/s [11,12]
  const BASE_N = 1024;
  const BASE_R = 1;
  const BASE_HASHRATE = SCRYPT_RTX4090_HASHRATE_N1024_R1; // 7,126 H/s [11]
  
  // Memory scales with N * r [6]
  const baseMemory = BASE_N * BASE_R; // 1024
  const targetMemory = N * r;
  
  // Hashrate scales inversely with memory (memory-bound assumption)
  // This is an UPPER BOUND because:
  // - The Ethereum benchmark shows actual is 3.5x slower than linear scaling
  // - We're being generous to the attacker
  const memoryRatio = targetMemory / baseMemory;
  const hashrateUpperBound = BASE_HASHRATE / memoryRatio;
  
  // p: Cost scales linearly [10] (CITED)
  // Higher p means more work, so hashrate effectively decreases
  const effectiveHashrate = hashrateUpperBound / p;
  
  const hashesPerHour = effectiveHashrate * 3600;
  const costUsd = GPU_RENTAL_COST_PER_HOUR / hashesPerHour;
  
  return {
    costUsd,
    description: `scrypt (≥$${costUsd.toExponential(1)}/hash)`,
  };
}

/**
 * bcrypt cost calculation.
 * 
 * ## Cited Benchmark [1,2]
 * 
 * RTX 4090: 184.0 kH/s at cost=5
 * 
 * ## Scaling [7]
 * 
 * From bcrypt paper: iterations = 2^cost
 * - cost=5: 2^5 = 32 iterations
 * - cost=12: 2^12 = 4096 iterations
 * - Ratio: 128x
 * 
 * Hashrate at cost=12: 184,000 / 128 = 1,437.5 H/s
 * 
 * Cost calculation:
 *   Hashes/hour = 1,437.5 * 3600 = 5,175,000
 *   Cost/hash = $0.25 / 5,175,000 = $4.8e-8
 * 
 * This is an EXACT derivation from cited values (not a bound).
 */
function getBcryptCostPerHash(cost: number): CostPerHashEstimate {
  // [7] Scaling: 2^(cost - 5) relative to benchmark
  const scaleFactor = Math.pow(2, cost - 5);
  const hashrate = BCRYPT_RTX4090_HASHRATE_COST5 / scaleFactor;
  const hashesPerHour = hashrate * 3600;
  const costUsd = GPU_RENTAL_COST_PER_HOUR / hashesPerHour;
  
  return {
    costUsd,
    description: `bcrypt (cost=${cost})`,
  };
}

/**
 * PBKDF2 cost calculation.
 * 
 * ## Bound Derivation
 * 
 * PBKDF2-HMAC-SHA256 with k iterations performs at least k hash operations.
 * (Actually ~2k due to HMAC, but we use k for conservative lower bound.)
 * 
 * SHA-256 hashrate: 21.9755 GH/s [1,2]
 * PBKDF2 hashrate ≤ SHA256_hashrate / iterations
 * 
 * At 600k iterations:
 *   Hashrate ≤ 21.9755e9 / 600,000 = 36,626 H/s
 *   Hashes/hour ≤ 131,853,600
 *   Cost/hash ≥ $0.25 / 131,853,600 = $1.9e-9
 * 
 * We use $1.5e-9 (slightly lower, favors attacker).
 * 
 * ## Scaling [8]
 * 
 * NIST SP 800-132: iteration count scales linearly (CITED).
 */
function getPbkdf2CostPerHash(iterations: number): CostPerHashEstimate {
  // Upper bound on hashrate: SHA-256 rate / iterations
  // This is a bound because PBKDF2 does at least `iterations` SHA-256 operations
  const hashrateUpperBound = SHA256_RTX4090_HASHRATE / iterations;
  const hashesPerHour = hashrateUpperBound * 3600;
  const costUsd = GPU_RENTAL_COST_PER_HOUR / hashesPerHour;
  
  return {
    costUsd,
    description: `PBKDF2 (≥$${costUsd.toExponential(1)}/hash)`,
  };
}

/**
 * SHA-256 cost calculation.
 * 
 * ## Cited Benchmark [1,2]
 * 
 * RTX 4090: 21.9755 GH/s (DIRECTLY CITED)
 * 
 * Cost calculation:
 *   Hashes/hour = 21.9755e9 * 3600 = 7.91e13
 *   Cost/hash = $0.25 / 7.91e13 = $3.2e-15
 * 
 * This is an EXACT derivation from cited values.
 * 
 * Note: ASIC mining [3] achieves 110 TH/s (~5000x faster), giving ~$6e-19/hash.
 * We use GPU pricing as it's more accessible to typical attackers.
 */
function getSha256CostPerHash(): CostPerHashEstimate {
  const hashesPerHour = SHA256_RTX4090_HASHRATE * 3600;
  const costUsd = GPU_RENTAL_COST_PER_HOUR / hashesPerHour;
  
  return {
    costUsd,
    description: 'SHA-256',
  };
}

/**
 * Get cost per hash for a given algorithm configuration.
 */
export function getCostPerHash(config: HashAlgorithmConfig): CostPerHashEstimate {
  switch (config.algorithm) {
    case 'argon2id':
      return getArgon2idCostPerHash(config.memoryCost, config.timeCost, config.parallelism);
    case 'scrypt':
      return getScryptCostPerHash(config.N, config.r, config.p);
    case 'bcrypt':
      return getBcryptCostPerHash(config.cost);
    case 'pbkdf2':
      return getPbkdf2CostPerHash(config.iterations);
    case 'sha256':
      return getSha256CostPerHash();
  }
}

// ============================================================
// Password Space Calculation
// ============================================================

export interface PasswordSpaceParams {
  gridSize: number;   // N = options per word
  wordCount: number;  // W = password length
}

/**
 * Calculate total password space (number of possible passwords).
 * 
 * Formula: gridSize^wordCount
 * 
 * This is the fundamental combinatorics formula for the number of
 * ways to choose wordCount items from gridSize options with replacement.
 * (Standard result, no citation needed.)
 */
export function calculatePasswordSpace(params: PasswordSpaceParams): bigint {
  return BigInt(params.gridSize) ** BigInt(params.wordCount);
}

/**
 * Calculate password entropy in bits.
 * 
 * Formula: wordCount * log2(gridSize)
 * 
 * Entropy = log2(passwordSpace) by definition.
 * (Standard information theory, no citation needed.)
 */
export function calculateEntropyBits(params: PasswordSpaceParams): number {
  return params.wordCount * Math.log2(params.gridSize);
}

// ============================================================
// Cost to Crack Calculation
// ============================================================

export interface CostToCrackParams {
  gridSize: number;
  wordCount: number;
  hashConfig: HashAlgorithmConfig;
  userCount?: number;
}

export interface CostToCrackResult {
  passwordSpace: bigint;
  entropyBits: number;
  costPerHash: number;
  costPerHashDescription: string;
  singleTargetCostUsd: number;
  multiTargetCostUsd: number;
  effectiveUserCount: number;
  formatted: {
    singleTarget: string;
    multiTarget: string;
    entropy: string;
    passwordSpace: string;
  };
}

/**
 * Calculate the estimated cost to crack a password.
 * 
 * ## Methodology
 * 
 * 1. Calculate password space: gridSize^wordCount
 * 2. Expected guesses to crack: passwordSpace / 2
 * 3. Cost = expectedGuesses * costPerHash
 * 
 * ## Expected Guesses = N/2
 * 
 * For uniformly random selection from N possibilities, the expected
 * position of the target in a random search is (N+1)/2 ≈ N/2.
 * 
 * This is the expected value of a discrete uniform distribution.
 * (Standard probability theory - e.g., Ross, "A First Course in
 * Probability", Theorem 4.1 on expected value.)
 * 
 * ## Result Interpretation
 * 
 * The cost estimates are LOWER BOUNDS ("at least $X") because:
 * - Hash costs are derived from upper bounds on attacker speed
 * - GPU rental uses lower bound pricing
 * - Real costs are likely higher
 */
export function calculateCostToCrack(params: CostToCrackParams): CostToCrackResult {
  const { gridSize, wordCount, hashConfig, userCount = 1 } = params;
  
  const passwordSpace = calculatePasswordSpace({ gridSize, wordCount });
  const entropyBits = calculateEntropyBits({ gridSize, wordCount });
  const { costUsd: costPerHash, description: costPerHashDescription } = getCostPerHash(hashConfig);
  
  // Expected guesses = N/2 (standard probability result)
  const expectedGuesses = Number(passwordSpace) / 2;
  
  // Lower bound on cost (since costPerHash is a lower bound)
  const singleTargetCostUsd = expectedGuesses * costPerHash;
  const multiTargetCostUsd = singleTargetCostUsd / userCount;
  
  return {
    passwordSpace,
    entropyBits,
    costPerHash,
    costPerHashDescription,
    singleTargetCostUsd,
    multiTargetCostUsd,
    effectiveUserCount: userCount,
    formatted: {
      singleTarget: formatCurrency(singleTargetCostUsd),
      multiTarget: formatCurrency(multiTargetCostUsd),
      entropy: `${entropyBits.toFixed(1)} bits`,
      passwordSpace: formatBigNumber(passwordSpace),
    },
  };
}

// ============================================================
// Formatting Helpers
// ============================================================

function formatCurrency(usd: number): string {
  if (!isFinite(usd)) {
    return 'Numerical overflow';
  }
  
  if (usd < 0.01) {
    return `≥$${usd.toExponential(2)}`;
  }
  
  if (usd < 1000) {
    return `≥$${stripTrailingZeros(usd.toFixed(2))}`;
  }
  
  if (usd >= 1e15) {
    const trillions = usd / 1e12;
    const exponent = Math.floor(Math.log10(trillions));
    const mantissa = trillions / Math.pow(10, exponent);
    return `≥$${mantissa.toPrecision(3)} × 10^${exponent} trillion`;
  }
  
  const units = [
    { threshold: 1e12, suffix: 'trillion' },
    { threshold: 1e9, suffix: 'billion' },
    { threshold: 1e6, suffix: 'million' },
    { threshold: 1e3, suffix: 'thousand' },
  ];
  
  for (const { threshold, suffix } of units) {
    if (usd >= threshold) {
      return `≥$${stripTrailingZeros((usd / threshold).toFixed(2))} ${suffix}`;
    }
  }
  
  return `≥$${stripTrailingZeros(usd.toFixed(2))}`;
}

function stripTrailingZeros(str: string): string {
  return str.replace(/\.?0+$/, '');
}

function formatBigNumber(n: bigint): string {
  const s = n.toString();
  if (s.length <= 6) {
    return s;
  }
  return `~10^${s.length - 1}`;
}

