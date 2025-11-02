import { useState, useEffect } from 'react';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord, getGridSize } from './generation-config';
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
  const [seedPhrase, setSeedPhrase] = useState(config.seedPhrase);
  const [gridRows, setGridRows] = useState(config.gridRows);
  const [gridCols, setGridCols] = useState(config.gridCols);

  useEffect(() => {
    if (isOpen) {
      // Default to 80 bits if modal is newly opened
      setDesiredBits(80);
      // Reset config fields to current config
      setSeedPhrase(config.seedPhrase);
      setGridRows(config.gridRows);
      setGridCols(config.gridCols);
    }
  }, [isOpen, config]);

  const currentConfig: GenerationConfig = { seedPhrase, gridRows, gridCols };
  const entropyPerWord = calculateEntropyPerWord(currentConfig);
  const numWords = desiredBits / entropyPerWord;
  const numOptions = getGridSize(currentConfig);

  const handleGenerate = () => {
    // Save config before generating
    setConfig(currentConfig);
    onGenerate(Math.ceil(numWords));
    onClose();
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
    <>
      {isOpen && (
      <div className="generate-modal-overlay" onClick={onClose}>
        <div className="generate-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="generate-modal-header">
            <h2>Generate Password</h2>
            <button className="generate-modal-close" onClick={onClose}>×</button>
          </div>
          <div className="generate-modal-body">
            <div className="config-section">
              <h3>Configuration</h3>
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

            <div className="config-calculated">
              <h3>Calculated numbers:</h3>
              <div className="calculated-item">
                <span>Number of words:</span>
                <span className="calculated-value">{numOptions}</span>
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
    </>
  );
}

