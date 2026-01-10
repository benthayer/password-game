/**
 * Recovery mode state management.
 * Handles word selection for building/recovering a password.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords } from '../crypto-utils';
import type { GenerationConfig } from '../generation-config';

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
    setNextWords(getNextWords(subpassword, config));
  }, [subpassword, config]);

  const selectWord = useCallback((word: string) => {
    setSubpassword([...subpassword, word]);
  }, [subpassword, setSubpassword]);

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

