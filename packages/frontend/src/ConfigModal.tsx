import { useState, useEffect } from 'react';
import type { GenerationConfig, HashAlgorithm, HashAlgorithmConfig } from './generation-config';
import { 
  getGridSize, 
  calculateEntropyPerWord, 
  AVAILABLE_ALGORITHMS, 
  ALGORITHM_META, 
  getDefaultConfigForAlgorithm,
} from './generation-config';
import type { Argon2idConfig, ScryptConfig, BcryptConfig, Pbkdf2Config } from './hash-config';
import { calculateCostToCrack, type CostToCrackResult } from './cost-calculation';
import './ConfigModal.css';

// Memory unit helpers
type MemoryUnit = 'KB' | 'MB' | 'GB';

function getMemoryUnit(kb: number): MemoryUnit {
  if (kb >= 1024 * 1024) return 'GB';
  if (kb >= 1024) return 'MB';
  return 'KB';
}

function getMemoryDisplayValue(kb: number): number {
  const unit = getMemoryUnit(kb);
  switch (unit) {
    case 'GB': return kb / (1024 * 1024);
    case 'MB': return kb / 1024;
    default: return kb;
  }
}

function parseMemoryInput(value: number, unit: MemoryUnit): number {
  switch (unit) {
    case 'GB': return value * 1024 * 1024;
    case 'MB': return value * 1024;
    default: return value;
  }
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  onSave: (config: GenerationConfig) => void;
  wordCount?: number; // For cost calculation
}

export default function ConfigModal({ isOpen, onClose, config, onSave, wordCount = 8 }: ConfigModalProps) {
  // Grid settings
  const [seedPhrase, setSeedPhrase] = useState(config.seedPhrase);
  const [gridRows, setGridRows] = useState(config.gridRows);
  const [gridCols, setGridCols] = useState(config.gridCols);
  
  // Hash settings
  const [hashAlgorithm, setHashAlgorithm] = useState<HashAlgorithmConfig>(config.hashAlgorithm);
  const [includeSalt, setIncludeSalt] = useState(config.includeSalt);
  const [salt, setSalt] = useState(config.salt);

  useEffect(() => {
    if (isOpen) {
      setSeedPhrase(config.seedPhrase);
      setGridRows(config.gridRows);
      setGridCols(config.gridCols);
      setHashAlgorithm(config.hashAlgorithm);
      setIncludeSalt(config.includeSalt);
      setSalt(config.salt);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const currentConfig: GenerationConfig = { 
    seedPhrase, 
    gridRows, 
    gridCols,
    hashAlgorithm,
    includeSalt,
    salt,
  };
  
  const numOptions = getGridSize(currentConfig);
  const entropyPerWord = calculateEntropyPerWord(currentConfig);

  // Calculate cost to crack
  const costResult: CostToCrackResult | null = wordCount > 0 
    ? calculateCostToCrack({
        gridSize: numOptions,
        wordCount,
        hashConfig: hashAlgorithm,
        userCount: 1,
      })
    : null;

  const handleSave = () => {
    onSave(currentConfig);
    onClose();
  };

  const handleAlgorithmChange = (newAlgorithm: HashAlgorithm) => {
    setHashAlgorithm(getDefaultConfigForAlgorithm(newAlgorithm));
  };

  const updateArgon2Config = (updates: Partial<Argon2idConfig>) => {
    if (hashAlgorithm.algorithm === 'argon2id') {
      setHashAlgorithm({ ...hashAlgorithm, ...updates });
    }
  };

  const updateScryptConfig = (updates: Partial<ScryptConfig>) => {
    if (hashAlgorithm.algorithm === 'scrypt') {
      setHashAlgorithm({ ...hashAlgorithm, ...updates });
    }
  };

  const updateBcryptConfig = (updates: Partial<BcryptConfig>) => {
    if (hashAlgorithm.algorithm === 'bcrypt') {
      setHashAlgorithm({ ...hashAlgorithm, ...updates });
    }
  };

  const updatePbkdf2Config = (updates: Partial<Pbkdf2Config>) => {
    if (hashAlgorithm.algorithm === 'pbkdf2') {
      setHashAlgorithm({ ...hashAlgorithm, ...updates });
    }
  };

  const incrementRows = () => {
    if (gridRows < 10) setGridRows(gridRows + 1);
  };

  const decrementRows = () => {
    if (gridRows > 1) setGridRows(gridRows - 1);
  };

  const incrementCols = () => {
    if (gridCols < 10) setGridCols(gridCols + 1);
  };

  const decrementCols = () => {
    if (gridCols > 1) setGridCols(gridCols - 1);
  };

  return (
    <div className="config-modal-overlay" onClick={onClose}>
      <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="config-modal-header">
          <h2>Configuration</h2>
          <button className="config-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="config-modal-body">
          {/* Grid Settings Section */}
          <div className="config-section">
            <h3>Grid Settings</h3>
            
            <div className="config-field">
              <label htmlFor="seed-phrase">Public Seed Phrase</label>
              <input
                id="seed-phrase"
                type="text"
                value={seedPhrase}
                onChange={(e) => setSeedPhrase(e.target.value)}
                placeholder="Enter seed phrase"
              />
            </div>

            <div className="grid-fields-container">
              <div className="config-field">
                <label>Grid Rows</label>
                <div className="grid-control">
                  <button onClick={decrementRows} className="grid-button">-</button>
                  <span className="grid-value">{gridRows}</span>
                  <button onClick={incrementRows} className="grid-button">+</button>
                </div>
              </div>

              <div className="config-field">
                <label>Grid Columns</label>
                <div className="grid-control">
                  <button onClick={decrementCols} className="grid-button">-</button>
                  <span className="grid-value">{gridCols}</span>
                  <button onClick={incrementCols} className="grid-button">+</button>
                </div>
              </div>
            </div>

            <div className="config-stats">
              <div className="stat-item">
                <span>Options per word:</span>
                <span className="stat-value">{numOptions}</span>
              </div>
              <div className="stat-item">
                <span>Entropy per word:</span>
                <span className="stat-value">{entropyPerWord.toFixed(2)} bits</span>
              </div>
            </div>
          </div>

          {/* Hash Settings Section */}
          <div className="config-section">
            <h3>Hash Settings</h3>
            
            <div className="config-field">
              <label htmlFor="algorithm">Algorithm</label>
              <select
                id="algorithm"
                value={hashAlgorithm.algorithm}
                onChange={(e) => handleAlgorithmChange(e.target.value as HashAlgorithm)}
              >
                {AVAILABLE_ALGORITHMS.map((alg) => (
                  <option key={alg} value={alg}>
                    {ALGORITHM_META[alg].name}
                    {ALGORITHM_META[alg].recommended ? ' (Recommended)' : ''}
                  </option>
                ))}
              </select>
              <div className="field-hint algorithm-description">
                {ALGORITHM_META[hashAlgorithm.algorithm].description}
              </div>
            </div>

            {/* Algorithm-specific parameters */}
            <div className="algorithm-params">
              {hashAlgorithm.algorithm === 'argon2id' && (
                <>
                  <div className="config-field">
                    <label>Memory Cost</label>
                    <div className="memory-input-group">
                      <input
                        type="number"
                        value={getMemoryDisplayValue(hashAlgorithm.memoryCost)}
                        onChange={(e) => updateArgon2Config({ 
                          memoryCost: parseMemoryInput(parseInt(e.target.value) || 64, getMemoryUnit(hashAlgorithm.memoryCost))
                        })}
                        min={1}
                      />
                      <select
                        value={getMemoryUnit(hashAlgorithm.memoryCost)}
                        onChange={(e) => {
                          const currentValue = getMemoryDisplayValue(hashAlgorithm.memoryCost);
                          updateArgon2Config({ memoryCost: parseMemoryInput(currentValue, e.target.value as MemoryUnit) });
                        }}
                        className="memory-unit-select"
                      >
                        <option value="KB">KB</option>
                        <option value="MB">MB</option>
                        <option value="GB">GB</option>
                      </select>
                    </div>
                  </div>
                  <div className="config-field">
                    <label>Time Cost (iterations)</label>
                    <input
                      type="number"
                      value={hashAlgorithm.timeCost}
                      onChange={(e) => updateArgon2Config({ timeCost: parseInt(e.target.value) || 3 })}
                      min={1}
                    />
                  </div>
                  <div className="config-field">
                    <label>Parallelism</label>
                    <input
                      type="number"
                      value={hashAlgorithm.parallelism}
                      onChange={(e) => updateArgon2Config({ parallelism: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                </>
              )}

              {hashAlgorithm.algorithm === 'scrypt' && (
                <>
                  <div className="config-field">
                    <label>N (CPU/memory cost)</label>
                    <input
                      type="number"
                      value={hashAlgorithm.N}
                      onChange={(e) => updateScryptConfig({ N: parseInt(e.target.value) || 1048576 })}
                      min={16384}
                      step={16384}
                    />
                    <div className="field-hint">2^{Math.log2(hashAlgorithm.N).toFixed(0)}</div>
                  </div>
                  <div className="config-field">
                    <label>r (block size)</label>
                    <input
                      type="number"
                      value={hashAlgorithm.r}
                      onChange={(e) => updateScryptConfig({ r: parseInt(e.target.value) || 8 })}
                      min={1}
                    />
                  </div>
                  <div className="config-field">
                    <label>p (parallelism)</label>
                    <input
                      type="number"
                      value={hashAlgorithm.p}
                      onChange={(e) => updateScryptConfig({ p: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                </>
              )}

              {hashAlgorithm.algorithm === 'bcrypt' && (
                <div className="config-field">
                  <label>Cost (log2 iterations)</label>
                  <input
                    type="number"
                    value={hashAlgorithm.cost}
                    onChange={(e) => updateBcryptConfig({ cost: parseInt(e.target.value) || 12 })}
                    min={4}
                    max={31}
                  />
                  <div className="field-hint">{Math.pow(2, hashAlgorithm.cost).toLocaleString()} iterations</div>
                </div>
              )}

              {hashAlgorithm.algorithm === 'pbkdf2' && (
                <>
                  <div className="config-field">
                    <label>Iterations</label>
                    <input
                      type="number"
                      value={hashAlgorithm.iterations}
                      onChange={(e) => updatePbkdf2Config({ iterations: parseInt(e.target.value) || 600000 })}
                      min={10000}
                      step={10000}
                    />
                  </div>
                  <div className="config-field">
                    <label>Hash Function</label>
                    <select
                      value={hashAlgorithm.hash}
                      onChange={(e) => updatePbkdf2Config({ hash: e.target.value as 'sha256' | 'sha512' })}
                    >
                      <option value="sha256">SHA-256</option>
                      <option value="sha512">SHA-512</option>
                    </select>
                  </div>
                </>
              )}

              {hashAlgorithm.algorithm === 'sha256' && (
                <div className="algorithm-warning">
                  ⚠️ Raw SHA-256 provides no brute-force protection. 
                  Only use for testing or if passwords have extremely high entropy.
                </div>
              )}
            </div>
          </div>

          {/* Salt Section */}
          <div className="config-section">
            <h3>Salt</h3>
            <div className="config-field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={includeSalt}
                  onChange={(e) => setIncludeSalt(e.target.checked)}
                />
                Include salt
              </label>
              <div className="field-hint">
                Salt prevents multi-target attacks. Required if you expect multiple users.
              </div>
            </div>
            
            {includeSalt && (
              <div className="config-field">
                <label>Salt value</label>
                <input
                  type="text"
                  value={salt}
                  onChange={(e) => setSalt(e.target.value)}
                  placeholder="Enter a unique salt"
                />
              </div>
            )}
          </div>

          {/* Security Estimate */}
          {costResult && (
            <div className="cost-display">
              <h3>Security Estimate</h3>
              <div className="cost-item">
                <span>Password entropy:</span>
                <span className="cost-value">{costResult.formatted.entropy}</span>
              </div>
              <div className="cost-item">
                <span>Password space:</span>
                <span className="cost-value">{costResult.formatted.passwordSpace}</span>
              </div>
              <div className="cost-item">
                <span>Hash algorithm:</span>
                <span className="cost-value">{costResult.costPerHashDescription}</span>
              </div>
              <div className="cost-item highlight">
                <span>Estimated cost to crack:</span>
                <span className="cost-value">{costResult.formatted.singleTarget}</span>
              </div>
              {!includeSalt && (
                <div className="cost-warning">
                  ⚠️ Without salt, multiple users share this cost (birthday attack).
                </div>
              )}
            </div>
          )}
        </div>
        <div className="config-modal-footer">
          <button onClick={onClose} className="config-button cancel-button">Cancel</button>
          <button onClick={handleSave} className="config-button save-button">Save</button>
        </div>
      </div>
    </div>
  );
}
