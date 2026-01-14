/**
 * Web Worker for vault key computation.
 * 
 * Runs expensive Argon2id hashing off the main thread.
 * Each worker handles one computation then terminates.
 */

import { getAddressHash, getSecondaryKey, getPrimaryKeyHex } from './vault-crypto-streaming';
import { getHashConfig } from '../generation-config';
import type { GenerationConfig } from '../generation-config';

export interface WorkerInput {
  password: string[];
  config: GenerationConfig;
}

export interface WorkerOutput {
  addressHash: string;
  secondaryKey: string;
  // CryptoKey can't be transferred between threads, so we return hex key material
  primaryKeyHex: string;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { password, config } = e.data;
  const hashConfig = getHashConfig(config);
  
  try {
    const [addressHash, secondaryKey, primaryKeyHex] = await Promise.all([
      getAddressHash(password, hashConfig),
      getSecondaryKey(password, hashConfig),
      getPrimaryKeyHex(password, hashConfig),
    ]);
    
    const result: WorkerOutput = { addressHash, secondaryKey, primaryKeyHex };
    self.postMessage(result);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

