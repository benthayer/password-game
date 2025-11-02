import { useState, useEffect } from 'react';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord } from './generation-config';
import ConfigDisplay from './ConfigDisplay';
import './GeneratePasswordModal.css';

interface GeneratePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  onGenerate: (numWords: number) => void;
}

export default function GeneratePasswordModal({ 
  isOpen, 
  onClose, 
  config, 
  onGenerate 
}: GeneratePasswordModalProps) {
  const [desiredBits, setDesiredBits] = useState<number>(80);

  useEffect(() => {
    if (isOpen) {
      // Default to 80 bits if modal is newly opened
      setDesiredBits(80);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const entropyPerWord = calculateEntropyPerWord(config);
  const numWords = desiredBits / entropyPerWord;

  const handleGenerate = () => {
    onGenerate(Math.ceil(numWords));
    onClose();
  };

  return (
    <div className="generate-modal-overlay" onClick={onClose}>
      <div className="generate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="generate-modal-header">
          <h2>Generate Password</h2>
          <button className="generate-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="generate-modal-body">
          <div className="current-config-section">
            <h3>Your current config:</h3>
            <ConfigDisplay config={config} />
          </div>

          <div className="bits-input-section">
            <label htmlFor="desired-bits">Desired Bits of Security:</label>
            <input
              id="desired-bits"
              type="number"
              value={desiredBits}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value > 0) {
                  setDesiredBits(value);
                }
              }}
              min="1"
              step="1"
              placeholder="Enter bits"
            />
          </div>

          <div className="conversion-display">
            <span className="conversion-text">
              {desiredBits} bits ≈ {numWords.toFixed(2)} words
            </span>
          </div>
        </div>
        <div className="generate-modal-footer">
          <button onClick={onClose} className="generate-button cancel-button">Cancel</button>
          <button onClick={handleGenerate} className="generate-button generate-button-primary">
            Generate {Math.ceil(numWords)} words
          </button>
        </div>
      </div>
    </div>
  );
}

