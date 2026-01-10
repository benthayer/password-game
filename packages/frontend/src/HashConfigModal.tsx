import { useState, useEffect } from 'react';
import type { 
  FullHashConfig, 
  HashAlgorithm, 
  HashAlgorithmConfig,
  Argon2idConfig,
  ScryptConfig,
  BcryptConfig,
  Pbkdf2Config,
} from './hash-config';
import { 
  AVAILABLE_ALGORITHMS, 
  ALGORITHM_META, 
  getDefaultConfigForAlgorithm,
  DEFAULT_FULL_HASH_CONFIG,
} from './hash-config';
import { calculateCostToCrack, type CostToCrackResult } from './cost-calculation';
import './HashConfigModal.css';

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

interface HashConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: FullHashConfig;
  onSave: (config: FullHashConfig) => void;
  // For cost calculation
  gridSize: number;
  wordCount: number;
}

export default function HashConfigModal({ 
  isOpen, 
  onClose, 
  config, 
  onSave,
  gridSize,
  wordCount,
}: HashConfigModalProps) {
  const [algorithmConfig, setAlgorithmConfig] = useState<HashAlgorithmConfig>(config.algorithmConfig);
  const [includeSalt, setIncludeSalt] = useState(config.includeSalt);
  const [salt, setSalt] = useState(config.salt);

  useEffect(() => {
    if (isOpen) {
      setAlgorithmConfig(config.algorithmConfig);
      setIncludeSalt(config.includeSalt);
      setSalt(config.salt);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const currentConfig: FullHashConfig = { algorithmConfig, includeSalt, salt };
  
  // Calculate cost to crack
  const costResult: CostToCrackResult | null = wordCount > 0 
    ? calculateCostToCrack({
        gridSize,
        wordCount,
        hashConfig: algorithmConfig,
        userCount: 1,
      })
    : null;

  const handleAlgorithmChange = (newAlgorithm: HashAlgorithm) => {
    setAlgorithmConfig(getDefaultConfigForAlgorithm(newAlgorithm));
  };

  const handleSave = () => {
    onSave(currentConfig);
    onClose();
  };

  const updateArgon2Config = (updates: Partial<Argon2idConfig>) => {
    if (algorithmConfig.algorithm === 'argon2id') {
      setAlgorithmConfig({ ...algorithmConfig, ...updates });
    }
  };

  const updateScryptConfig = (updates: Partial<ScryptConfig>) => {
    if (algorithmConfig.algorithm === 'scrypt') {
      setAlgorithmConfig({ ...algorithmConfig, ...updates });
    }
  };

  const updateBcryptConfig = (updates: Partial<BcryptConfig>) => {
    if (algorithmConfig.algorithm === 'bcrypt') {
      setAlgorithmConfig({ ...algorithmConfig, ...updates });
    }
  };

  const updatePbkdf2Config = (updates: Partial<Pbkdf2Config>) => {
    if (algorithmConfig.algorithm === 'pbkdf2') {
      setAlgorithmConfig({ ...algorithmConfig, ...updates });
    }
  };

  return (
    <div className="hash-config-modal-overlay" onClick={onClose}>
      <div className="hash-config-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="hash-config-modal-header">
          <h2>Hash Configuration</h2>
          <button className="hash-config-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="hash-config-modal-body">
          {/* Algorithm Dropdown */}
          <div className="hash-config-field">
            <label htmlFor="algorithm">Algorithm</label>
            <select
              id="algorithm"
              value={algorithmConfig.algorithm}
              onChange={(e) => handleAlgorithmChange(e.target.value as HashAlgorithm)}
            >
              {AVAILABLE_ALGORITHMS.map((alg) => (
                <option key={alg} value={alg}>
                  {ALGORITHM_META[alg].name}
                  {ALGORITHM_META[alg].recommended ? ' (Recommended)' : ''}
                </option>
              ))}
            </select>
            <div className="algorithm-description">
              {ALGORITHM_META[algorithmConfig.algorithm].description}
            </div>
          </div>

          {/* Algorithm-specific parameters */}
          <div className="algorithm-params">
            {algorithmConfig.algorithm === 'argon2id' && (
              <>
                <div className="hash-config-field">
                  <label>Memory Cost</label>
                  <div className="memory-input-group">
                    <input
                      type="number"
                      value={getMemoryDisplayValue(algorithmConfig.memoryCost)}
                      onChange={(e) => updateArgon2Config({ 
                        memoryCost: parseMemoryInput(parseInt(e.target.value) || 64, getMemoryUnit(algorithmConfig.memoryCost))
                      })}
                      min={1}
                    />
                    <select
                      value={getMemoryUnit(algorithmConfig.memoryCost)}
                      onChange={(e) => {
                        const currentValue = getMemoryDisplayValue(algorithmConfig.memoryCost);
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
                <div className="hash-config-field">
                  <label>Time Cost (iterations)</label>
                  <input
                    type="number"
                    value={algorithmConfig.timeCost}
                    onChange={(e) => updateArgon2Config({ timeCost: parseInt(e.target.value) || 3 })}
                    min={1}
                  />
                </div>
                <div className="hash-config-field">
                  <label>Parallelism</label>
                  <input
                    type="number"
                    value={algorithmConfig.parallelism}
                    onChange={(e) => updateArgon2Config({ parallelism: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                </div>
              </>
            )}

            {algorithmConfig.algorithm === 'scrypt' && (
              <>
                <div className="hash-config-field">
                  <label>N (CPU/memory cost)</label>
                  <input
                    type="number"
                    value={algorithmConfig.N}
                    onChange={(e) => updateScryptConfig({ N: parseInt(e.target.value) || 1048576 })}
                    min={16384}
                    step={16384}
                  />
                  <div className="field-hint">2^{Math.log2(algorithmConfig.N).toFixed(0)}</div>
                </div>
                <div className="hash-config-field">
                  <label>r (block size)</label>
                  <input
                    type="number"
                    value={algorithmConfig.r}
                    onChange={(e) => updateScryptConfig({ r: parseInt(e.target.value) || 8 })}
                    min={1}
                  />
                </div>
                <div className="hash-config-field">
                  <label>p (parallelism)</label>
                  <input
                    type="number"
                    value={algorithmConfig.p}
                    onChange={(e) => updateScryptConfig({ p: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                </div>
              </>
            )}

            {algorithmConfig.algorithm === 'bcrypt' && (
              <div className="hash-config-field">
                <label>Cost (log2 iterations)</label>
                <input
                  type="number"
                  value={algorithmConfig.cost}
                  onChange={(e) => updateBcryptConfig({ cost: parseInt(e.target.value) || 12 })}
                  min={4}
                  max={31}
                />
                <div className="field-hint">{Math.pow(2, algorithmConfig.cost).toLocaleString()} iterations</div>
              </div>
            )}

            {algorithmConfig.algorithm === 'pbkdf2' && (
              <>
                <div className="hash-config-field">
                  <label>Iterations</label>
                  <input
                    type="number"
                    value={algorithmConfig.iterations}
                    onChange={(e) => updatePbkdf2Config({ iterations: parseInt(e.target.value) || 600000 })}
                    min={10000}
                    step={10000}
                  />
                </div>
                <div className="hash-config-field">
                  <label>Hash Function</label>
                  <select
                    value={algorithmConfig.hash}
                    onChange={(e) => updatePbkdf2Config({ hash: e.target.value as 'sha256' | 'sha512' })}
                  >
                    <option value="sha256">SHA-256</option>
                    <option value="sha512">SHA-512</option>
                  </select>
                </div>
              </>
            )}

            {algorithmConfig.algorithm === 'sha256' && (
              <div className="algorithm-warning">
                ⚠️ Raw SHA-256 provides no brute-force protection. 
                Only use for testing or if passwords have extremely high entropy.
              </div>
            )}
          </div>

          {/* Salt Configuration */}
          <div className="salt-section">
            <h3>Salt</h3>
            <div className="hash-config-field checkbox-field">
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
              <div className="hash-config-field">
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

          {/* Cost to Crack Display */}
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

        <div className="hash-config-modal-footer">
          <button onClick={onClose} className="hash-config-button cancel-button">Cancel</button>
          <button onClick={handleSave} className="hash-config-button save-button">Save</button>
        </div>
      </div>
    </div>
  );
}

