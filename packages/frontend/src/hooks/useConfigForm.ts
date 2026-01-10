/**
 * Form state management for GenerationConfig.
 * Separates form concerns from rendering.
 */

import { useState, useEffect, useMemo } from 'react';
import type { GenerationConfig, HashAlgorithm, HashAlgorithmConfig } from '../generation-config';
import { getGridSize, getDefaultConfigForAlgorithm, DEFAULT_ARGON2ID_CONFIG } from '../generation-config';

export interface UseConfigFormResult {
  // Grid fields
  seedPhrase: string;
  setSeedPhrase: (value: string) => void;
  gridRows: number;
  gridCols: number;
  incrementRows: () => void;
  decrementRows: () => void;
  incrementCols: () => void;
  decrementCols: () => void;
  
  // Hash fields
  hashAlgorithm: HashAlgorithmConfig;
  setHashAlgorithm: (config: HashAlgorithmConfig) => void;
  changeAlgorithm: (algorithm: HashAlgorithm) => void;
  useRecommendedHash: boolean;
  setUseRecommendedHash: (value: boolean) => void;
  
  // Salt fields
  includeSalt: boolean;
  setIncludeSalt: (value: boolean) => void;
  salt: string;
  setSalt: (value: string) => void;
  
  // Derived values
  gridSize: number;
  
  // Convert form state back to config
  toConfig: () => GenerationConfig;
}

export function useConfigForm(
  initialConfig: GenerationConfig,
  resetOnChange: boolean = false
): UseConfigFormResult {
  // Grid state
  const [seedPhrase, setSeedPhrase] = useState(initialConfig.seedPhrase);
  const [gridRows, setGridRows] = useState(initialConfig.gridRows);
  const [gridCols, setGridCols] = useState(initialConfig.gridCols);
  
  // Hash state
  const [hashAlgorithm, setHashAlgorithm] = useState<HashAlgorithmConfig>(initialConfig.hashAlgorithm);
  const [useRecommendedHash, setUseRecommendedHashState] = useState(
    initialConfig.hashAlgorithm.algorithm === 'argon2id'
  );
  
  // When useRecommended is toggled on, reset to default Argon2id
  const setUseRecommendedHash = (value: boolean) => {
    setUseRecommendedHashState(value);
    if (value) {
      setHashAlgorithm(DEFAULT_ARGON2ID_CONFIG);
    }
  };
  
  // Salt state
  const [includeSalt, setIncludeSalt] = useState(initialConfig.includeSalt);
  const [salt, setSalt] = useState(initialConfig.salt);

  // Reset form when initialConfig changes (if resetOnChange is true)
  useEffect(() => {
    if (resetOnChange) {
      setSeedPhrase(initialConfig.seedPhrase);
      setGridRows(initialConfig.gridRows);
      setGridCols(initialConfig.gridCols);
      setHashAlgorithm(initialConfig.hashAlgorithm);
      setUseRecommendedHashState(initialConfig.hashAlgorithm.algorithm === 'argon2id');
      setIncludeSalt(initialConfig.includeSalt);
      setSalt(initialConfig.salt);
    }
  }, [resetOnChange, initialConfig]);

  // Grid operations
  const incrementRows = () => setGridRows(r => Math.min(r + 1, 10));
  const decrementRows = () => setGridRows(r => Math.max(r - 1, 1));
  const incrementCols = () => setGridCols(c => Math.min(c + 1, 10));
  const decrementCols = () => setGridCols(c => Math.max(c - 1, 1));

  // Algorithm change resets to default config for that algorithm
  const changeAlgorithm = (algorithm: HashAlgorithm) => {
    setHashAlgorithm(getDefaultConfigForAlgorithm(algorithm));
  };

  // Derived
  const gridSize = useMemo(() => gridRows * gridCols, [gridRows, gridCols]);

  // Convert to config
  const toConfig = (): GenerationConfig => ({
    seedPhrase,
    gridRows,
    gridCols,
    hashAlgorithm,
    includeSalt,
    salt,
  });

  return {
    // Grid
    seedPhrase,
    setSeedPhrase,
    gridRows,
    gridCols,
    incrementRows,
    decrementRows,
    incrementCols,
    decrementCols,
    
    // Hash
    hashAlgorithm,
    setHashAlgorithm,
    changeAlgorithm,
    useRecommendedHash,
    setUseRecommendedHash,
    
    // Salt
    includeSalt,
    setIncludeSalt,
    salt,
    setSalt,
    
    // Derived
    gridSize,
    
    // Export
    toConfig,
  };
}

