import { useState, useEffect } from 'react';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord } from './generation-config';
import ConfigDisplay from './ConfigDisplay';
import ConfigModal from './ConfigModal';
import './GeneratePasswordModal.css';

interface GeneratePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  onGenerate: (numWords: number) => void;
}

export default function GeneratePasswordModal({ 
  isOpen, 
  onClose, 
  config, 
  setConfig,
  onGenerate 
}: GeneratePasswordModalProps) {
  const [desiredBits, setDesiredBits] = useState<number>(80);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Default to 80 bits if modal is newly opened
      setDesiredBits(80);
    }
  }, [isOpen]);

  const entropyPerWord = calculateEntropyPerWord(config);
  const numWords = desiredBits / entropyPerWord;

  const handleGenerate = () => {
    onGenerate(Math.ceil(numWords));
    onClose();
  };

  return (
    <>
      {isOpen && (
      <div className="generate-modal-overlay" onClick={onClose}>
        <div className="generate-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="generate-modal-header">
            <h2>Generate Password</h2>
            <button className="generate-modal-close" onClick={onClose}>×</button>
          </div>
          <div className="generate-modal-body">
            <div className="current-config-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3>Your current config:</h3>
                <button 
                  onClick={() => setConfigModalOpen(true)}
                  style={{
                    background: '#6366f1',
                    color: 'white',
                    padding: '8px 16px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Edit Config
                </button>
              </div>
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
      )}
    <ConfigModal
      isOpen={configModalOpen}
      onClose={() => setConfigModalOpen(false)}
      config={config}
      onSave={setConfig}
    />
    </>
  );
}

