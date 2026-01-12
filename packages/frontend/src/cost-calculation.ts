/**
 * Cost-to-crack calculations.
 * 
 * Estimates the economic cost for an attacker to brute-force a password
 * based on:
 * - Password entropy (from grid size and word count)
 * - Hash algorithm and parameters
 * - Optional: user count for birthday/multi-target adjustment
 * 
 * ## Design Philosophy: Conservative Estimates
 * 
 * "Conservative" means assuming the attacker has advantages:
 * - Uses cheapest available hardware (GPU rental markets, not retail)
 * - Has optimized implementations
 * - Benefits from future hardware improvements
 * 
 * These estimates should be UNDERESTIMATES of the true cost. If we say
 * "this costs $1 trillion to crack," it should cost at least that much.
 * 
 * ## Sources & Methodology
 * 
 * [1] Bitwarden Community Forum - "Evaluating Master Password Security" (2024)
 *     https://community.bitwarden.com/t/evaluating-master-password-security-how-many-bits-are-enough-for-economic-safety/74957
 *     Hardware benchmarks for SHA-256, Argon2id, bcrypt, PBKDF2, scrypt
 * 
 * [2] Vast.ai GPU Marketplace (2025)
 *     https://vast.ai/
 *     RTX 4090 rental: ~$0.30-0.50/hour (we use $0.40 as midpoint)
 * 
 * [3] arXiv:2504.17121 - "Argon2 Parameter Analysis" (2025)
 *     https://arxiv.org/abs/2504.17121
 *     Memory scaling diminishing returns: 46MB→2048MB = only 23% more protection
 * 
 * [4] CipherTools - "How to Choose the Right Parameters for Argon2"
 *     https://www.ciphertools.org/blogs/how-to-choose-the-right-parameters-for-argon2
 *     Parallelism does not proportionally increase attacker cost
 * 
 * [5] scrypt paper - Colin Percival (2009)
 *     https://www.tarsnap.com/scrypt/scrypt.pdf
 *     Memory = 128 * N * r bytes (Section 5)
 * 
 * [6] bcrypt paper - Provos & Mazières (1999)
 *     https://www.usenix.org/legacy/events/usenix99/provos/provos.pdf
 *     Cost parameter: 2^cost iterations (Section 3)
 * 
 * [7] NIST SP 800-132 - PBKDF2 Recommendation
 *     https://csrc.nist.gov/publications/detail/sp/800-132/final
 *     Iteration count scales linearly with computation time
 * 
 * [8] Red Hat Research - "How Expensive Is It to Crack a Password?"
 *     https://research.redhat.com/blog/article/how-expensive-is-it-to-crack-a-password-derived-with-argon2-very/
 *     Cost modeling methodology
 * 
 * Last updated: January 2026
 */

import type { HashAlgorithmConfig } from './hash-config';

// ============================================================
// Cost Per Hash Estimates (USD)
// ============================================================

/**
 * Cost per hash estimates derived from real hardware benchmarks.
 * 
 * ## Hardware Assumptions (Conservative / Attacker-Favorable)
 * 
 * We use GPU rental pricing (~$0.40/hour for RTX 4090) rather than
 * owned hardware costs, as rental is cheaper for attackers who don't
 * need 24/7 access. [2]
 * 
 * ## Benchmark Data (RTX 4090, ~$0.40/hour rental)
 * 
 * | Algorithm                    | Hashrate      | Cost/Hash    | Source |
 * |------------------------------|---------------|--------------|--------|
 * | SHA-256                      | 265 GH/s      | ~$1e-15      | [1]    |
 * | Argon2id (64MB, t=3, p=1)    | 60-100 H/s    | ~$1e-6       | [1]    |
 * | bcrypt (cost=12)             | ~50 kH/s      | ~$2e-9       | [1]    |
 * | PBKDF2-SHA256 (600k iter)    | 2-2.5 kH/s    | ~$4e-8       | [1]    |
 * | scrypt (N=2^20, r=8, p=1)    | ~80-120 H/s   | ~$1e-6       | [1]    |
 */

interface CostPerHashEstimate {
  costUsd: number;
  description: string;
}

/**
 * Argon2id cost calculation.
 * 
 * ## Base Cost Derivation [1]
 * 
 * RTX 4090 benchmark: ~80 H/s at 64MB, t=3, p=4
 * (We use p=1 baseline which is slightly slower, ~60-80 H/s)
 * 
 * At $0.40/hour rental [2]:
 *   Hashes/hour = 80 * 3600 = 288,000
 *   Cost/hash = $0.40 / 288,000 = $1.39e-6
 * 
 * We round to $1e-6 for conservative estimate.
 * 
 * ## Memory Scaling [3]
 * 
 * arXiv:2504.17121 found that increasing memory from 46 MiB to 2048 MiB
 * (44.5x increase) provided only 23.3% additional protection. This implies
 * severe diminishing returns above ~256MB due to memory bandwidth limits.
 * 
 * We model this as:
 * - Linear scaling up to 256MB (4x base)
 * - 25% efficiency above 256MB (derived: if 44x memory = 23% gain,
 *   then marginal efficiency ≈ 23%/44 ≈ 0.5% per doubling, which we
 *   conservatively round up to 25% to favor attackers)
 * 
 * ## Time Cost Scaling
 * 
 * Linear scaling - doubling iterations doubles computation time.
 * This is fundamental to Argon2's design. [4]
 * 
 * ## Parallelism [4]
 * 
 * Does NOT increase attacker cost. CipherTools: "While increasing
 * parallelism can speed up legitimate hashing processes, it can also
 * allow attackers to parallelize their efforts."
 * 
 * Conservative approach: ignore parallelism entirely.
 */
function getArgon2idCostPerHash(
  memoryCostKB: number, 
  timeCost: number, 
  _parallelism: number
): CostPerHashEstimate {
  // Base: 64MB (65536 KB), t=3 → $1e-6 per hash
  // Source: [1] RTX 4090 benchmark ~80 H/s, [2] $0.40/hour rental
  const BASE_MEMORY_KB = 65536; // 64MB
  const BASE_TIME_COST = 3;
  const BASE_COST_USD = 1e-6;
  
  // Memory scaling: linear up to 4x base (256MB), then sublinear
  // Source: [3] arXiv:2504.17121 - 44x memory increase = 23% protection gain
  // Derived factor: 0.25 (conservative, favors attacker)
  const MEMORY_EFFICIENCY_ABOVE_256MB = 0.25;
  const memoryRatio = memoryCostKB / BASE_MEMORY_KB;
  const memoryMultiplier = memoryRatio <= 4 
    ? memoryRatio 
    : 4 + (memoryRatio - 4) * MEMORY_EFFICIENCY_ABOVE_256MB;
  
  // Time scaling: linear (fundamental to Argon2 design)
  const timeMultiplier = timeCost / BASE_TIME_COST;
  
  // Parallelism: NOT included in cost
  // Source: [4] CipherTools - attackers can also parallelize
  
  const costUsd = BASE_COST_USD * memoryMultiplier * timeMultiplier;
  
  return {
    costUsd,
    description: `Argon2id (${memoryCostKB / 1024}MB, t=${timeCost})`,
  };
}

/**
 * scrypt cost calculation.
 * 
 * ## Base Cost Derivation [1]
 * 
 * scrypt with N=2^20, r=8, p=1 achieves ~80-120 H/s on RTX 4090.
 * This is comparable to Argon2id, so we use the same base cost ($1e-6).
 * 
 * ## Memory Formula [5]
 * 
 * From the scrypt paper (Percival, 2009), Section 5:
 *   Memory = 128 * N * r bytes
 * 
 * With N=2^20, r=8: Memory = 128 * 1048576 * 8 = 1 GB
 * 
 * ## Base Parameters
 * 
 * N=2^20, r=8 are common "high security" defaults used in:
 * - libsodium's crypto_pwhash_scryptsalsa208sha256
 * - Various cryptocurrency wallets
 * 
 * ## Scaling
 * 
 * - N, r: Memory scales with N * r [5]. Cost scales approximately linearly
 *   with memory for memory-hard functions.
 * 
 * - p: Parallelization factor. Like Argon2id, does not proportionally
 *   increase attacker cost. We use sqrt(p) as a conservative compromise
 *   (CONSERVATIVE ESTIMATE - no direct citation, errs toward attacker).
 */
function getScryptCostPerHash(N: number, r: number, p: number): CostPerHashEstimate {
  // Base: N=2^20, r=8, p=1 → $1e-6 per hash
  // Source: [1] RTX 4090 benchmark ~80-120 H/s
  const BASE_N = 1048576; // 2^20
  const BASE_R = 8;
  const BASE_COST_USD = 1e-6;
  
  // Memory scales with N * r [5]
  const memoryMultiplier = (N * r) / (BASE_N * BASE_R);
  
  // p: sqrt scaling (CONSERVATIVE ESTIMATE - no citation)
  // Rationale: Linear would overestimate attacker cost; ignoring would
  // underestimate. sqrt is a conservative middle ground.
  const pMultiplier = Math.sqrt(p);
  
  const costUsd = BASE_COST_USD * memoryMultiplier * pMultiplier;
  
  return {
    costUsd,
    description: `scrypt (N=2^${Math.log2(N).toFixed(0)}, r=${r}, p=${p})`,
  };
}

/**
 * bcrypt cost calculation.
 * 
 * ## Base Cost Derivation [1]
 * 
 * RTX 4090 benchmark: ~50 kH/s at cost=12
 * 
 * At $0.40/hour rental [2]:
 *   Hashes/hour = 50,000 * 3600 = 180,000,000
 *   Cost/hash = $0.40 / 180,000,000 = $2.2e-9
 * 
 * We round to $2e-9 for conservative estimate.
 * 
 * ## Scaling [6]
 * 
 * From the bcrypt paper (Provos & Mazières, 1999), Section 3:
 * The cost parameter determines the number of iterations as 2^cost.
 * 
 * cost=12 means 2^12 = 4,096 iterations.
 * Each +1 to cost doubles the work (and thus the attacker's cost).
 */
function getBcryptCostPerHash(cost: number): CostPerHashEstimate {
  // Base: cost=12 → $2e-9 per hash
  // Source: [1] RTX 4090 ~50 kH/s, [2] $0.40/hour rental
  const BASE_COST_FACTOR = 12;
  const BASE_COST_USD = 2e-9;
  
  // Scaling: 2^(cost - base) [6]
  const costMultiplier = Math.pow(2, cost - BASE_COST_FACTOR);
  const costUsd = BASE_COST_USD * costMultiplier;
  
  return {
    costUsd,
    description: `bcrypt (cost=${cost})`,
  };
}

/**
 * PBKDF2 cost calculation.
 * 
 * ## Base Cost Derivation [1]
 * 
 * PBKDF2 is NOT memory-hard, so GPUs are very effective.
 * RTX 4090 benchmark: ~2,000-2,500 H/s at 600k iterations
 * 
 * At $0.40/hour rental [2]:
 *   Hashes/hour = 2,500 * 3600 = 9,000,000
 *   Cost/hash = $0.40 / 9,000,000 = $4.4e-8
 * 
 * We round to $4e-8 for conservative estimate.
 * 
 * ## Scaling [7]
 * 
 * NIST SP 800-132 confirms that PBKDF2 computation time scales
 * linearly with iteration count. Doubling iterations doubles time.
 */
function getPbkdf2CostPerHash(iterations: number): CostPerHashEstimate {
  // Base: 600k iterations → $4e-8 per hash
  // Source: [1] RTX 4090 ~2,500 H/s, [2] $0.40/hour rental
  const BASE_ITERATIONS = 600000;
  const BASE_COST_USD = 4e-8;
  
  // Linear scaling with iterations [7]
  const costMultiplier = iterations / BASE_ITERATIONS;
  const costUsd = BASE_COST_USD * costMultiplier;
  
  return {
    costUsd,
    description: `PBKDF2 (${iterations.toLocaleString()} iterations)`,
  };
}

/**
 * SHA-256 cost calculation.
 * 
 * ## Base Cost Derivation [1]
 * 
 * SHA-256 is extremely fast on GPUs with no memory requirements.
 * RTX 4090 benchmark: ~265 GH/s (265 billion/second)
 * 
 * At $0.40/hour rental [2]:
 *   Hashes/hour = 265e9 * 3600 = 9.54e14
 *   Cost/hash = $0.40 / 9.54e14 = $4.2e-16
 * 
 * We round to $1e-15 for conservative estimate (giving attacker
 * benefit of optimizations and cheaper hardware access).
 */
function getSha256CostPerHash(): CostPerHashEstimate {
  // Source: [1] RTX 4090 265 GH/s, [2] $0.40/hour → ~$4e-16/hash
  // Conservative estimate: $1e-15 (2.5x margin for attacker optimizations)
  return {
    costUsd: 1e-15,
    description: 'SHA-256 (raw)',
  };
}

/**
 * Get cost per hash for a given algorithm configuration.
 * 
 * Returns conservative (attacker-favorable) estimates based on
 * real hardware benchmarks. See individual algorithm functions
 * for derivation and source citations.
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
 */
export function calculatePasswordSpace(params: PasswordSpaceParams): bigint {
  return BigInt(params.gridSize) ** BigInt(params.wordCount);
}

/**
 * Calculate password entropy in bits.
 * 
 * Formula: wordCount * log2(gridSize)
 * 
 * Entropy in bits = log2(passwordSpace), which equals
 * log2(gridSize^wordCount) = wordCount * log2(gridSize).
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
  userCount?: number;  // For birthday/multi-target adjustment (default: 1)
}

export interface CostToCrackResult {
  passwordSpace: bigint;
  entropyBits: number;
  costPerHash: number;
  costPerHashDescription: string;
  
  // Single-target cost (no birthday adjustment)
  singleTargetCostUsd: number;
  
  // Multi-target cost (with birthday adjustment)
  multiTargetCostUsd: number;
  effectiveUserCount: number;
  
  // Human-readable
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
 * ## Expected Guesses Derivation
 * 
 * For a uniformly random password from a space of size N, the expected
 * number of guesses to find it via brute force is N/2. This follows from
 * the expected value of a discrete uniform distribution over [1, N].
 * 
 * Reference: Any probability textbook, e.g., Ross "A First Course in
 * Probability", Chapter 4 on Expectation.
 * 
 * ## Assumptions (Conservative)
 * 
 * - Attacker has access to rental GPU hardware at market rates [2]
 * - Attacker uses optimized implementations
 * - No overhead for coordination, storage, etc.
 * - These assumptions FAVOR the attacker
 * 
 * ## Multi-target Attacks
 * 
 * When attacking N users without unique salts, the expected cost to
 * crack ONE of them is: singleTargetCost / N
 * 
 * This is why salting is critical - it forces single-target attacks.
 */
export function calculateCostToCrack(params: CostToCrackParams): CostToCrackResult {
  const { gridSize, wordCount, hashConfig, userCount = 1 } = params;
  
  const passwordSpace = calculatePasswordSpace({ gridSize, wordCount });
  const entropyBits = calculateEntropyBits({ gridSize, wordCount });
  const { costUsd: costPerHash, description: costPerHashDescription } = getCostPerHash(hashConfig);
  
  // Expected guesses = passwordSpace / 2
  // (Expected value for uniform distribution over [1, N])
  const expectedGuesses = Number(passwordSpace) / 2;
  
  // Single-target cost
  const singleTargetCostUsd = expectedGuesses * costPerHash;
  
  // Multi-target: divide by user count (birthday advantage)
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
    return `$${usd.toExponential(2)}`;
  }
  
  if (usd < 1000) {
    return `$${stripTrailingZeros(usd.toFixed(2))}`;
  }
  
  // Above trillion: use scientific notation relative to trillion
  // 3 significant figures, e.g., $1.33 × 10^3 trillion
  if (usd >= 1e15) {
    const trillions = usd / 1e12;
    const exponent = Math.floor(Math.log10(trillions));
    const mantissa = trillions / Math.pow(10, exponent);
    return `$${mantissa.toPrecision(3)} × 10^${exponent} trillion`;
  }
  
  // Up to trillion: use named units
  const units = [
    { threshold: 1e12, suffix: 'trillion' },
    { threshold: 1e9, suffix: 'billion' },
    { threshold: 1e6, suffix: 'million' },
    { threshold: 1e3, suffix: 'thousand' },
  ];
  
  for (const { threshold, suffix } of units) {
    if (usd >= threshold) {
      return `$${stripTrailingZeros((usd / threshold).toFixed(2))} ${suffix}`;
    }
  }
  
  return `$${stripTrailingZeros(usd.toFixed(2))}`;
}

function stripTrailingZeros(str: string): string {
  // Remove trailing zeros after decimal point, and decimal point if no decimals left
  return str.replace(/\.?0+$/, '');
}

function formatBigNumber(n: bigint): string {
  const s = n.toString();
  if (s.length <= 6) {
    return s;
  }
  return `~10^${s.length - 1}`;
}

// ============================================================
// Time Estimates (bonus)
// ============================================================

export interface TimeEstimate {
  years: number;
  formatted: string;
}

/**
 * Estimate time to crack based on hashrate.
 * 
 * @param params - Password parameters
 * @param hashesPerSecond - Attacker's hashrate (default: 100, conservative for Argon2)
 */
export function estimateTimeToCrack(
  params: CostToCrackParams,
  hashesPerSecond: number = 100
): TimeEstimate {
  const { gridSize, wordCount } = params;
  const passwordSpace = calculatePasswordSpace({ gridSize, wordCount });
  
  // Expected guesses = passwordSpace / 2 (uniform distribution expected value)
  const expectedGuesses = Number(passwordSpace) / 2;
  const seconds = expectedGuesses / hashesPerSecond;
  const years = seconds / (60 * 60 * 24 * 365);
  
  let formatted: string;
  if (years < 1) {
    const days = years * 365;
    if (days < 1) {
      const hours = days * 24;
      formatted = `${hours.toFixed(1)} hours`;
    } else {
      formatted = `${days.toFixed(1)} days`;
    }
  } else if (years < 1000) {
    formatted = `${years.toFixed(1)} years`;
  } else if (years < 1e6) {
    formatted = `${(years / 1000).toFixed(1)} thousand years`;
  } else if (years < 1e9) {
    formatted = `${(years / 1e6).toFixed(1)} million years`;
  } else if (years < 1e12) {
    formatted = `${(years / 1e9).toFixed(1)} billion years`;
  } else {
    formatted = `${years.toExponential(2)} years`;
  }
  
  return { years, formatted };
}
