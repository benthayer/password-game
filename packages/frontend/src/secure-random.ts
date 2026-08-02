/**
 * Uniform random integers from the platform CSPRNG.
 * Rejection sampling over a power-of-two range, so there is no modulo bias.
 */

/** Smallest all-ones bitmask that covers maxValue (i.e. mask >= maxValue). */
function getSmallestMaskCovering(maxValue: bigint): bigint {
  let mask = 0n;
  while (true) {
    if (mask >= maxValue) return mask;
    mask = (mask << 1n) | 1n;
  }
}

/** Cryptographically random bytes, enough to fill the mask. */
function getRandBytes(mask: bigint): Uint8Array {
  const byteCount = Math.ceil(mask.toString(2).length / 8);
  return crypto.getRandomValues(new Uint8Array(byteCount));
}

/** Interpret bytes as a big-endian integer, truncated to the mask. */
function applyMask(mask: bigint, bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value & mask;
}

/** Random candidate in [0, mask], the smallest power-of-2 range covering [0, n). */
function getCandidate(n: bigint): bigint {
  const mask = getSmallestMaskCovering(n - 1n);
  const randBytes = getRandBytes(mask);
  return applyMask(mask, randBytes);
}

/** Uniform random bigint in [0, n) by rejection sampling. */
export function secureRandomBelow(n: bigint): bigint {
  if (n < 1n) throw new Error(`secureRandomBelow requires n >= 1, got ${n}`);
  while (true) {
    const candidate = getCandidate(n);
    if (candidate < n) return candidate;
  }
}

/** Uniform random index in [0, n) for callers working in numbers. */
export function secureRandomIndex(n: number): number {
  if (!Number.isSafeInteger(n)) throw new Error(`secureRandomIndex requires a safe integer, got ${n}`);
  return Number(secureRandomBelow(BigInt(n)));
}
