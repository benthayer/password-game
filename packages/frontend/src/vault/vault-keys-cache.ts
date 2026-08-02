/**
 * Vault Keys Cache
 * 
 * Promise-based cache for expensive vault key derivations.
 * Keys are computed in Web Workers (off main thread) on word selection,
 * so vault operations are instant when the user clicks.
 * 
 * Cache key: identityHash (fast SHA-256 of config + password)
 * Cache value: Promise<VaultKeys> containing all derived keys
 * 
 * Architecture:
 * - Each computation spawns a dedicated Web Worker
 * - Workers run in parallel, don't block each other
 * - Worker terminates after completing its computation
 * 
 * Race condition handling: Store promise synchronously before any await.
 * Even if duplicate computations occur, result is identical.
 */

import { getIdentityHash } from '../crypto-utils';
import type { GenerationConfig } from '../generation-config';
import type { WorkerInput, WorkerOutput } from './vault-keys.worker';

// =============================================================================
// TYPES
// =============================================================================

export interface VaultKeys {
  /** Hex-encoded Ed25519 public key — the account address. */
  address: string;
  /** Hex-encoded Ed25519 secret key for signing server operations. */
  signingSecretKeyHex: string;
  secondaryKey: string;
  primaryKeyHex: string;
}

// =============================================================================
// WORKER HELPERS
// =============================================================================

/**
 * Spawn a Web Worker to compute vault keys off the main thread.
 * Each call creates a new worker that terminates after completion.
 */
function computeVaultKeysInWorker(
  password: string[],
  config: GenerationConfig
): Promise<VaultKeys> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./vault-keys.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = (e: MessageEvent<WorkerOutput & { error?: string }>) => {
      worker.terminate();
      
      if (e.data.error) {
        reject(new Error(e.data.error));
        return;
      }
      
      resolve({
        address: e.data.address,
        signingSecretKeyHex: e.data.signingSecretKeyHex,
        secondaryKey: e.data.secondaryKey,
        primaryKeyHex: e.data.primaryKeyHex,
      });
    };
    
    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(error.message));
    };
    
    const input: WorkerInput = { password, config };
    worker.postMessage(input);
  });
}

// =============================================================================
// CACHE
// =============================================================================

const cache = new Map<string, Promise<VaultKeys>>();

/**
 * Get vault keys for a password, using cache if available.
 * 
 * Cache key is the identity hash (fast SHA-256), not the password itself.
 * Promise is stored synchronously to prevent race conditions.
 * 
 * Computation runs in a dedicated Web Worker (off main thread).
 */
export function getVaultKeys(
  password: string[],
  config: GenerationConfig
): Promise<VaultKeys> {
  const identityHash = getIdentityHash(config, password);
  
  // Synchronous check - no race condition possible
  const existing = cache.get(identityHash);
  if (existing) return existing;
  
  // Spawn worker and store promise synchronously before any async work
  const promise = computeVaultKeysInWorker(password, config);
  cache.set(identityHash, promise);
  
  return promise;
}

/**
 * Prefetch vault keys in the background.
 * Fire-and-forget - call on word selection to start hashing early.
 */
export function prefetchVaultKeys(
  password: string[],
  config: GenerationConfig
): void {
  getVaultKeys(password, config);
}

/**
 * Check if vault keys are cached (synchronous check).
 * Returns true if a cache entry exists (may still be computing).
 * Useful for UX - skip showing "Preparing..." if keys are being fetched.
 */
export function hasVaultKeysCached(
  password: string[],
  config: GenerationConfig
): boolean {
  const identityHash = getIdentityHash(config, password);
  return cache.has(identityHash);
}

/**
 * Clear the cache. Useful for testing or config changes.
 */
export function clearVaultKeysCache(): void {
  cache.clear();
}
