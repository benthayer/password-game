/**
 * Recovery mode state management.
 * Handles word selection for building/recovering a password.
 * 
 * Prefetches vault keys on word selection for instant vault operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { getNextWordsFlat } from '../crypto-utils';
import type { GenerationConfig } from '../generation-config';
import { prefetchVaultKeys } from '../vault/vault-keys-cache';

export interface UseRecoveryModeResult {
  // State
  nextWords: string[];
  
  // Actions
  selectWord: (word: string) => void;
  deleteLastWord: () => void;
  reset: () => void;
}

export function useRecoveryMode(
  config: GenerationConfig,
  subpassword: string[],
  setSubpassword: (words: string[]) => void,
): UseRecoveryModeResult {
  const [nextWords, setNextWords] = useState<string[]>([]);

  // Load next words whenever subpassword or config changes
  useEffect(() => {
    setNextWords(getNextWordsFlat(subpassword, config));
  }, [subpassword, config]);

  const selectWord = useCallback((word: string) => {
    const newPassword = [...subpassword, word];
    setSubpassword(newPassword);
    prefetchVaultKeys(newPassword, config);
  }, [subpassword, setSubpassword, config]);

  const deleteLastWord = useCallback(() => {
    if (subpassword.length > 0) {
      setSubpassword(subpassword.slice(0, -1));
    }
  }, [subpassword, setSubpassword]);

  const reset = useCallback(() => {
    setSubpassword([]);
  }, [setSubpassword]);

  return {
    nextWords,
    selectWord,
    deleteLastWord,
    reset,
  };
}

