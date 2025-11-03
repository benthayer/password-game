import { useState, useEffect } from 'react';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord, getGridSize } from './generation-config';
import './GeneratePasswordModal.css';
import { generatePassword } from './crypto-utils';
import { useNavigate } from 'react-router-dom';

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
  const [desiredSecurityBits, setDesiredSecurityBits] = useState<number>(() => {
    const saved = localStorage.getItem('desiredSecurityBits');
    if (saved) {
      return parseInt(saved);
    }
    return 80;
  });
  useEffect(() => {
    localStorage.setItem('desiredSecurityBits', desiredSecurityBits.toString());
  }, [desiredSecurityBits]);

  const entropyPerWord = calculateEntropyPerWord(config);
  const numWords = desiredSecurityBits / entropyPerWord;
  const numOptions = getGridSize(config);
  const [seedPhrase, setSeedPhrase] = useState(config.seedPhrase);
  const [gridRows, setGridRows] = useState(config.gridRows);
  const [gridCols, setGridCols] = useState(config.gridCols);

  useEffect(() => {
    setConfig({ seedPhrase, gridRows, gridCols });
  }, [seedPhrase, gridRows, gridCols]);

  const handleGenerate = () => {
    setSubpassword(generatePassword(Math.ceil(numWords), numOptions, seedPhrase));
    navigate('/practice');
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
                <label htmlFor="seed-phrase">Public Seed Phrase<br/>Optionally used to randomize the grid. Does not affect security.</label>
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
                value={desiredSecurityBits}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value > 0) {
                    setDesiredSecurityBits(value);
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
                  {desiredSecurityBits} bits ≈ {numWords.toFixed(2)} words
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

