import { useState } from 'react';
import type { GenerationConfig, HashAlgorithmConfig } from './generation-config';
import './ConfigDisplay.css';

interface ConfigDisplayProps {
  config: GenerationConfig;
}

export default function ConfigDisplay({ config }: ConfigDisplayProps) {
  return (
    <div className="config-display">
      <h3 className="config-title">Configuration</h3>
      <div className="config-notice">
        Write this down! You need it for recovery. It does not need to be private.
      </div>
      <SeedPhraseDisplay seedPhrase={config.seedPhrase || ''} />
      <div className="config-display-item">
        <span className="config-label">Grid:</span>
        <span className="config-value">{config.gridRows} × {config.gridCols}</span>
      </div>
      <div className="config-display-item">
        <span className="config-label">Hash:</span>
        <span className="config-value">{formatHashConfig(config.hashAlgorithm, config.useRecommendedHash)}</span>
      </div>
      <SaltDisplay includeSalt={config.includeSalt} salt={config.salt} />
    </div>
  );
}

function SeedPhraseDisplay({ seedPhrase }: { seedPhrase: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(seedPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!seedPhrase) {
    return (
      <div className="config-display-item">
        <span className="config-label">Public seed phrase:</span>
        <span className="config-value config-seed-phrase seed-not-set">⚠ Not set</span>
      </div>
    );
  }

  return (
    <div className="config-display-item">
      <span className="config-label">Public seed phrase:</span>
      <div className="copyable-value-container">
        <span className="config-value config-seed-phrase">{seedPhrase}</span>
        <button 
          className="copy-button" 
          onClick={handleCopy}
          title="Copy seed phrase"
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>
    </div>
  );
}

function SaltDisplay({ includeSalt, salt }: { includeSalt: boolean; salt: string }) {
  const [copied, setCopied] = useState(false);

  if (!includeSalt) {
    return (
      <div className="config-display-item">
        <span className="config-label">Salt:</span>
        <span className="config-value config-salt salt-disabled">⚠ Disabled</span>
      </div>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(salt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="config-display-item salt-item">
      <span className="config-label">Salt:</span>
      <div className="copyable-value-container">
        <span className="config-value config-salt salt-enabled salt-value">{salt}</span>
        <button 
          className="copy-button" 
          onClick={handleCopy}
          title="Copy salt"
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>
    </div>
  );
}

function formatHashConfig(config: HashAlgorithmConfig, useRecommended: boolean): string {
  if (useRecommended) {
    return 'Recommended (argon2id)';
  }
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