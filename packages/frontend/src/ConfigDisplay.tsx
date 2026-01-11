import type { GenerationConfig, HashAlgorithmConfig } from './generation-config';
import { getGridSize, calculateEntropyPerWord, calculateWordsFor80Bits } from './generation-config';
import './ConfigDisplay.css';

interface ConfigDisplayProps {
  config: GenerationConfig;
  numWords?: number;
}

export default function ConfigDisplay({ config, numWords }: ConfigDisplayProps) {
  const entropyPerWord = calculateEntropyPerWord(config);
  const totalEntropy = numWords !== undefined ? entropyPerWord * numWords : undefined;

  return (
    <div className="config-display">
      <h3 className="config-title">Configuration</h3>
      <div className="config-display-item">
        <span className="config-label">Public seed phrase:</span>
        <span className="config-value config-seed-phrase">"{config.seedPhrase || ''}"</span>
      </div>
      <div className="config-display-item">
        <span className="config-label">Grid:</span>
        <span className="config-value">{config.gridRows} × {config.gridCols}</span>
      </div>
      <div className="config-display-item">
        <span className="config-label">Hash:</span>
        <span className="config-value">{formatHashConfig(config.hashAlgorithm)}</span>
      </div>
      <div className="config-display-item">
        <span className="config-label">Salt:</span>
        <span className={`config-value config-salt ${config.includeSalt ? 'salt-enabled' : 'salt-disabled'}`}>
          {config.includeSalt ? '✓ Enabled' : '⚠ Disabled'}
        </span>
      </div>
      <h3 className="config-title">Calculations</h3>
      <div className="config-display-item">
        <span className="config-label">Entropy per word:</span>
        <span className="config-value">{entropyPerWord.toFixed(2)} bits</span>
      </div>
      {totalEntropy !== undefined && (
        <div className="config-display-item">
          <span className="config-label">Total password entropy:</span>
          <span className="config-value">{totalEntropy.toFixed(2)} bits</span>
        </div>
      )}
    </div>
  );
}

function formatHashConfig(config: HashAlgorithmConfig): string {
  switch (config.algorithm) {
    case 'argon2id':
      return `Argon2id (${config.memoryCost / 1024}MB, ${config.timeCost} iter, p=${config.parallelism})`;
    case 'scrypt':
      return `scrypt (N=2^${Math.log2(config.N).toFixed(0)}, r=${config.r}, p=${config.p})`;
    case 'bcrypt':
      return `bcrypt (cost=${config.cost})`;
    case 'pbkdf2':
      return `PBKDF2-${config.hash.toUpperCase()} (${config.iterations.toLocaleString()} iter)`;
    case 'sha256':
      return 'SHA-256 (raw)';
  }
}