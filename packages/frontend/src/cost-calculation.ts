/**
 * Cost-to-crack calculations.
 * 
 * Estimates the economic cost for an attacker to brute-force a password
 * based on:
 * - Password entropy (from grid size and word count)
 * - Hash algorithm and parameters
 * - Optional: user count for birthday/multi-target adjustment
 */

import type { HashAlgorithmConfig } from './hash-config';

// ============================================================
// Cost Per Hash Estimates (USD)
// ============================================================

/**
 * Estimated cost per hash for different algorithms.
 * Based on:
 * - SHA256: ~2.4 trillion/sec on $1.4M GPU cluster
 * - Argon2id (64MB): ~100-500/sec per high-end CPU
 * - Conservative attacker assumptions
 * 
 * These are rough estimates and should be updated as hardware improves.
 */

interface CostPerHashEstimate {
  costUsd: number;
  description: string;
}

function getArgon2idCostPerHash(memoryCostKB: number, timeCost: number, parallelism: number): CostPerHashEstimate {
  // Base: 64MB, 3 iterations, 1 thread ≈ $0.0001 per hash (conservative)
  // Scale with memory, time, and parallelism
  const baseMemory = 65536; // 64MB in KB
  const baseTime = 3;
  const baseParallelism = 1;
  const baseCost = 0.0001;
  
  const memoryMultiplier = memoryCostKB / baseMemory;
  const timeMultiplier = timeCost / baseTime;
  const parallelismMultiplier = parallelism / baseParallelism;
  const costUsd = baseCost * memoryMultiplier * timeMultiplier * parallelismMultiplier;
  
  return {
    costUsd,
    description: `Argon2id (${memoryCostKB / 1024}MB, ${timeCost} iterations, p=${parallelism})`,
  };
}

function getScryptCostPerHash(N: number, r: number, p: number): CostPerHashEstimate {
  // Base: N=2^20, r=8, p=1 ≈ similar to Argon2id 64MB
  const baseN = 1048576; // 2^20
  const baseCost = 0.0001;
  
  const memoryMultiplier = (N * r) / (baseN * 8);
  const costUsd = baseCost * memoryMultiplier * p;
  
  return {
    costUsd,
    description: `scrypt (N=2^${Math.log2(N)}, r=${r}, p=${p})`,
  };
}

function getBcryptCostPerHash(cost: number): CostPerHashEstimate {
  // bcrypt cost is log2 of iterations
  // cost=12 ≈ 4096 iterations ≈ $0.000001 per hash
  const baseCost = 12;
  const baseCostUsd = 0.000001;
  
  const costMultiplier = Math.pow(2, cost - baseCost);
  const costUsd = baseCostUsd * costMultiplier;
  
  return {
    costUsd,
    description: `bcrypt (cost=${cost})`,
  };
}

function getPbkdf2CostPerHash(iterations: number): CostPerHashEstimate {
  // PBKDF2 is not memory-hard, much cheaper to attack
  // 600k iterations ≈ $0.0000001 per hash
  const baseIterations = 600000;
  const baseCostUsd = 0.0000001;
  
  const costMultiplier = iterations / baseIterations;
  const costUsd = baseCostUsd * costMultiplier;
  
  return {
    costUsd,
    description: `PBKDF2 (${iterations.toLocaleString()} iterations)`,
  };
}

function getSha256CostPerHash(): CostPerHashEstimate {
  // SHA256 is extremely fast: ~2.4 trillion/sec on big cluster
  // Cost per hash ≈ $0.0000000000001
  return {
    costUsd: 1e-13,
    description: 'SHA-256 (raw)',
  };
}

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

