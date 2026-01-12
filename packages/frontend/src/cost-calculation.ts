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
 * Primary benchmark source:
 * - Bitwarden Community Forum analysis (2024)
 *   https://community.bitwarden.com/t/evaluating-master-password-security-how-many-bits-are-enough-for-economic-safety/74957
 * 
 * Cost model:
 * - GPU rental pricing from Vast.ai, Lambda Labs (~$0.30-0.50/hour for RTX 4090)
 * - Red Hat Research cost methodology
 *   https://research.redhat.com/blog/article/how-expensive-is-it-to-crack-a-password-derived-with-argon2-very/
 * 
 * Scaling research:
 * - arXiv:2504.17121 - Argon2 memory scaling diminishing returns
 *   https://arxiv.org/abs/2504.17121
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
 * need 24/7 access.
 * 
 * ## Benchmark Data (RTX 4090, ~$0.40/hour rental)
 * 
 * | Algorithm                    | Hashrate      | Cost/Hash    |
 * |------------------------------|---------------|--------------|
 * | SHA-256                      | 265 GH/s      | ~$1e-15      |
 * | Argon2id (64MB, t=3, p=1)    | 60-100 H/s    | ~$1e-6       |
 * | bcrypt (cost=12)             | ~50 kH/s      | ~$2e-9       |
 * | PBKDF2-SHA256 (600k iter)    | 2-2.5 kH/s    | ~$4e-8       |
 * | scrypt (N=2^20, r=8, p=1)    | ~80-120 H/s   | ~$1e-6       |
 * 
 * Source: Bitwarden Community analysis
 * https://community.bitwarden.com/t/evaluating-master-password-security-how-many-bits-are-enough-for-economic-safety/74957
 */

interface CostPerHashEstimate {
  costUsd: number;
  description: string;
}

/**
 * Argon2id cost calculation.
 * 
 * ## Base Cost Derivation
 * 
 * RTX 4090 benchmark: ~80 H/s at 64MB, t=3, p=4
 * (We use p=1 baseline which is slightly slower, ~60-80 H/s)
 * 
 * At $0.40/hour rental:
 *   Hashes/hour = 80 * 3600 = 288,000
 *   Cost/hash = $0.40 / 288,000 = $1.39e-6
 * 
 * We round to $1e-6 for conservative estimate.
 * 
 * ## Scaling Behavior
 * 
 * - Memory: Linear scaling up to ~256MB, then sublinear due to memory
 *   bandwidth limits. arXiv:2504.17121 shows 46MB→2048MB gives only
 *   23% more protection despite 44x memory increase.
 * 
 * - Time cost (iterations): Linear scaling. Doubling t doubles time.
 * 
 * - Parallelism: Does NOT increase attacker cost. The parallelism
 *   parameter helps defenders (faster hashing) but attackers can
 *   also parallelize. Conservative approach: ignore parallelism.
 *   Source: CipherTools Argon2 guide
 *   https://www.ciphertools.org/blogs/how-to-choose-the-right-parameters-for-argon2
 * 
 * @param memoryCostKB - Memory in kilobytes
 * @param timeCost - Number of iterations
 * @param _parallelism - Ignored for cost calculation (see above)
 */
function getArgon2idCostPerHash(
  memoryCostKB: number, 
  timeCost: number, 
  _parallelism: number
): CostPerHashEstimate {
  // Base: 64MB (65536 KB), t=3 → $1e-6 per hash
  // Source: RTX 4090 benchmark ~80 H/s at $0.40/hour rental
  const BASE_MEMORY_KB = 65536; // 64MB
  const BASE_TIME_COST = 3;
  const BASE_COST_USD = 1e-6;
  
  // Memory scaling: linear up to 4x base (256MB), then sublinear
  // Beyond 256MB, diminishing returns due to memory bandwidth
  // Source: arXiv:2504.17121
  const memoryRatio = memoryCostKB / BASE_MEMORY_KB;
  const memoryMultiplier = memoryRatio <= 4 
    ? memoryRatio 
    : 4 + (memoryRatio - 4) * 0.25; // 75% diminishing returns above 256MB
  
  // Time scaling: linear
  const timeMultiplier = timeCost / BASE_TIME_COST;
  
  // Parallelism: NOT included in cost (conservative - see docstring)
  
  const costUsd = BASE_COST_USD * memoryMultiplier * timeMultiplier;
  
  return {
    costUsd,
    description: `Argon2id (${memoryCostKB / 1024}MB, t=${timeCost})`,
  };
}

/**
 * scrypt cost calculation.
 * 
 * ## Base Cost Derivation
 * 
 * scrypt with N=2^20, r=8, p=1 uses ~1GB memory and is comparable
 * to Argon2id in GPU resistance. Benchmark: ~80-120 H/s on RTX 4090.
 * 
 * We use same base cost as Argon2id ($1e-6) for similar memory usage.
 * 
 * ## Scaling
 * 
 * - N: CPU/memory cost factor. Memory = 128 * N * r bytes.
 *   Doubling N approximately doubles cost.
 * 
 * - r: Block size. Affects memory bandwidth requirements.
 *   Linear scaling with r.
 * 
 * - p: Parallelization. Like Argon2id, does not increase attacker cost
 *   proportionally. We apply sqrt scaling as a conservative compromise.
 * 
 * @param N - CPU/memory cost (typically power of 2)
 * @param r - Block size
 * @param p - Parallelization factor
 */
function getScryptCostPerHash(N: number, r: number, p: number): CostPerHashEstimate {
  // Base: N=2^20, r=8, p=1 → $1e-6 per hash (similar to Argon2id 64MB)
  const BASE_N = 1048576; // 2^20
  const BASE_R = 8;
  const BASE_COST_USD = 1e-6;
  
  // Memory scales with N * r
  const memoryMultiplier = (N * r) / (BASE_N * BASE_R);
  
  // p: use sqrt scaling (conservative - full linear would favor defender too much)
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
 * ## Base Cost Derivation
 * 
 * bcrypt cost=12 means 2^12 = 4096 iterations.
 * RTX 4090 benchmark: ~50 kH/s at cost=12
 * 
 * At $0.40/hour rental:
 *   Hashes/hour = 50,000 * 3600 = 180,000,000
 *   Cost/hash = $0.40 / 180,000,000 = $2.2e-9
 * 
 * We round to $2e-9 for conservative estimate.
 * 
 * ## Scaling
 * 
 * Each +1 to cost doubles the work. Linear in 2^cost.
 * 
 * @param cost - bcrypt cost factor (log2 of iterations)
 */
function getBcryptCostPerHash(cost: number): CostPerHashEstimate {
  // Base: cost=12 → $2e-9 per hash
  // Source: RTX 4090 benchmark ~50 kH/s at $0.40/hour rental
  const BASE_COST_FACTOR = 12;
  const BASE_COST_USD = 2e-9;
  
  // Each +1 to cost doubles work
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
 * ## Base Cost Derivation
 * 
 * PBKDF2 is NOT memory-hard, so GPUs are very effective.
 * RTX 4090 benchmark: ~2,000-2,500 H/s at 600k iterations
 * 
 * At $0.40/hour rental:
 *   Hashes/hour = 2,500 * 3600 = 9,000,000
 *   Cost/hash = $0.40 / 9,000,000 = $4.4e-8
 * 
 * We round to $4e-8 for conservative estimate.
 * 
 * ## Scaling
 * 
 * Linear with iteration count.
 * 
 * @param iterations - Number of PBKDF2 iterations
 */
function getPbkdf2CostPerHash(iterations: number): CostPerHashEstimate {
  // Base: 600k iterations → $4e-8 per hash
  // Source: RTX 4090 benchmark ~2,500 H/s at $0.40/hour rental
  const BASE_ITERATIONS = 600000;
  const BASE_COST_USD = 4e-8;
  
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
 * ## Base Cost Derivation
 * 
 * SHA-256 is extremely fast on GPUs with no memory requirements.
 * RTX 4090 benchmark: ~265 GH/s (265 billion/second)
 * 
 * At $0.40/hour rental:
 *   Hashes/hour = 265e9 * 3600 = 9.54e14
 *   Cost/hash = $0.40 / 9.54e14 = $4.2e-16
 * 
 * We round to $1e-15 for conservative estimate (giving attacker
 * benefit of optimizations and cheaper hardware access).
 * 
 * Source: Bitwarden Community analysis
 * https://community.bitwarden.com/t/evaluating-master-password-security-how-many-bits-are-enough-for-economic-safety/74957
 */
function getSha256CostPerHash(): CostPerHashEstimate {
  // RTX 4090: 265 GH/s at $0.40/hour → ~$4e-16/hash
  // Conservative estimate: $1e-15 (allows for attacker optimizations)
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
 * for derivation and sources.
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

export function calculatePasswordSpace(params: PasswordSpaceParams): bigint {
  return BigInt(params.gridSize) ** BigInt(params.wordCount);
}

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
 * 2. Expected guesses to crack: passwordSpace / 2 (average case)
 * 3. Cost = expectedGuesses * costPerHash
 * 
 * ## Assumptions
 * 
 * - Attacker has access to rental GPU hardware at market rates
 * - Attacker uses optimized implementations
 * - No overhead for coordination, storage, etc. (conservative)
 * 
 * ## Multi-target Attacks
 * 
 * When attacking multiple users, the effective cost per user decreases.
 * If attacking N users, expected cost to crack ONE of them is:
 *   singleTargetCost / N
 * 
 * This is why salting is important - it prevents multi-target attacks.
 */
export function calculateCostToCrack(params: CostToCrackParams): CostToCrackResult {
  const { gridSize, wordCount, hashConfig, userCount = 1 } = params;
  
  const passwordSpace = calculatePasswordSpace({ gridSize, wordCount });
  const entropyBits = calculateEntropyBits({ gridSize, wordCount });
  const { costUsd: costPerHash, description: costPerHashDescription } = getCostPerHash(hashConfig);
  
  // Expected guesses = passwordSpace / 2 (on average, find halfway through)
  const expectedGuesses = Number(passwordSpace) / 2;
  
  // Single-target cost
  const singleTargetCostUsd = expectedGuesses * costPerHash;
  
  // Multi-target: divide effective cost by user count (birthday advantage)
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

export function estimateTimeToCrack(
  params: CostToCrackParams,
  hashesPerSecond: number = 100 // Conservative for Argon2
): TimeEstimate {
  const { gridSize, wordCount } = params;
  const passwordSpace = calculatePasswordSpace({ gridSize, wordCount });
  
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
