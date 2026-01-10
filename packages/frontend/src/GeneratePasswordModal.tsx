/**
 * Generate password modal.
 * Configure grid and generate a new password with desired entropy.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord, getGridSize } from './generation-config';
import { generatePassword } from './crypto-utils';
import { useConfigForm } from './hooks/useConfigForm';
import { GridSettingsSection } from './config-modal';
import './GeneratePasswordModal.css';

interface GeneratePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  setSubpassword: (password: string[]) => void;
}

export default function GeneratePasswordModal({
  isOpen,
  onClose,
  config,
  setConfig,
  setSubpassword,
}: GeneratePasswordModalProps) {
  const navigate = useNavigate();
  const form = useConfigForm(config, isOpen);

  const [desiredSecurityBits, setDesiredSecurityBits] = useState<number>(() => {
    const saved = localStorage.getItem('desiredSecurityBits');
    return saved ? parseInt(saved) : 80;
  });

  useEffect(() => {
    localStorage.setItem('desiredSecurityBits', desiredSecurityBits.toString());
  }, [desiredSecurityBits]);

  if (!isOpen) return null;

  const entropyPerWord = calculateEntropyPerWord(form.toConfig());
  const numWords = desiredSecurityBits / entropyPerWord;

  const handleGenerate = () => {
    const newConfig = form.toConfig();
    setConfig(newConfig);
    setSubpassword(generatePassword(Math.ceil(numWords), newConfig));
    navigate('/practice');
    onClose();
  };

  return (
    <div className="generate-modal-overlay" onClick={onClose}>
      <div className="generate-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader onClose={onClose} />

        <div className="generate-modal-body">
          <GridSettingsSection
            seedPhrase={form.seedPhrase}
            onSeedPhraseChange={form.setSeedPhrase}
            gridRows={form.gridRows}
            gridCols={form.gridCols}
            onIncrementRows={form.incrementRows}
            onDecrementRows={form.decrementRows}
            onIncrementCols={form.incrementCols}
            onDecrementCols={form.decrementCols}
            gridSize={form.gridSize}
          />

          <SecurityBitsInput
            value={desiredSecurityBits}
            onChange={setDesiredSecurityBits}
          />

          <EntropyCalculation
            gridSize={form.gridSize}
            entropyPerWord={entropyPerWord}
            desiredBits={desiredSecurityBits}
            numWords={numWords}
          />
        </div>

        <ModalFooter
          onCancel={onClose}
          onGenerate={handleGenerate}
          numWords={Math.ceil(numWords)}
        />
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="generate-modal-header">
      <h2>Generate Password</h2>
      <button className="generate-modal-close" onClick={onClose}>×</button>
    </div>
  );
}

function SecurityBitsInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="bits-input-section">
      <label htmlFor="desired-bits">Desired Bits of Security:</label>
      <input
        id="desired-bits"
        type="number"
        value={value}
        onChange={(e) => {
          const parsed = parseInt(e.target.value);
          if (!isNaN(parsed) && parsed > 0) {
            onChange(parsed);
          }
        }}
        min="1"
        step="1"
        placeholder="Enter bits"
      />
    </div>
  );
}

function EntropyCalculation({
  gridSize,
  entropyPerWord,
  desiredBits,
  numWords,
}: {
  gridSize: number;
  entropyPerWord: number;
  desiredBits: number;
  numWords: number;
}) {
  return (
    <div className="config-calculated">
      <h3>Calculated numbers:</h3>
      <div className="calculated-item">
        <span>Number of words:</span>
        <span className="calculated-value">{gridSize}</span>
      </div>
      <div className="calculated-item">
        <span>Entropy per word:</span>
        <span className="calculated-value">{entropyPerWord.toFixed(2)}</span>
      </div>
      <div className="conversion-display">
        <span className="conversion-text">
          {desiredBits} bits ≈ {numWords.toFixed(2)} words
        </span>
      </div>
    </div>
  );
}

function ModalFooter({
  onCancel,
  onGenerate,
  numWords,
}: {
  onCancel: () => void;
  onGenerate: () => void;
  numWords: number;
}) {
  return (
    <div className="generate-modal-footer">
      <button onClick={onCancel} className="generate-button cancel-button">
        Cancel
      </button>
      <button onClick={onGenerate} className="generate-button generate-button-primary">
        Generate {numWords} words
      </button>
    </div>
  );
}
