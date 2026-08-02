/**
 * Web Worker for vault key computation.
 * 
 * Runs expensive Argon2id hashing off the main thread.
 * Each worker handles one computation then terminates.
 */

import { getSigningKeys, getSecondaryKey, getPrimaryKeyHex } from './vault-crypto-streaming';
import { getHashConfig } from '../generation-config';
import type { GenerationConfig } from '../generation-config';

export interface WorkerInput {
  password: string[];
  config: GenerationConfig;
}

export interface WorkerOutput {
  address: string;
  signingSecretKeyHex: string;
  secondaryKey: string;
  // CryptoKey can't be transferred between threads, so we return hex key material
  primaryKeyHex: string;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { password, config } = e.data;
  const hashConfig = getHashConfig(config);

  try {
    const [signingKeys, secondaryKey, primaryKeyHex] = await Promise.all([
      getSigningKeys(password, hashConfig),
      getSecondaryKey(password, hashConfig),
      getPrimaryKeyHex(password, hashConfig),
    ]);

    const result: WorkerOutput = {
      address: signingKeys.address,
      signingSecretKeyHex: signingKeys.signingSecretKeyHex,
      secondaryKey,
      primaryKeyHex,
    };
    self.postMessage(result);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

