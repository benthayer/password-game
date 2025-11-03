import { useState, useEffect } from 'react';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord, getGridSize } from './generation-config';
import './RecoveryModal.css';
import { useNavigate } from 'react-router-dom';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  setSubpassword: (password: string[]) => void;
}

export default function RecoveryModal({ 
  isOpen, 
  onClose, 
  config, 
  setConfig,
  setSubpassword,
}: RecoveryModalProps) {
  const navigate = useNavigate();
  const [seedPhrase, setSeedPhrase] = useState(config.seedPhrase);
  const [gridRows, setGridRows] = useState(config.gridRows);
  const [gridCols, setGridCols] = useState(config.gridCols);

  useEffect(() => {
    if (isOpen) {
      // Reset config fields to current config
      setSeedPhrase(config.seedPhrase);
      setGridRows(config.gridRows);
      setGridCols(config.gridCols);
    }
  }, [isOpen, config]);

  const currentConfig: GenerationConfig = { seedPhrase, gridRows, gridCols };
  const entropyPerWord = calculateEntropyPerWord(currentConfig);
  const numOptions = getGridSize(currentConfig);

  const handleRecover = () => {
    // Save config before starting recovery
    setConfig(currentConfig);
    // Initialize to blank password
    setSubpassword([]);
    navigate('/recovery');
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
      <div className="recovery-modal-overlay" onClick={onClose}>
        <div className="recovery-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="recovery-modal-header">
            <h2>Recover Password</h2>
            <button className="recovery-modal-close" onClick={onClose}>×</button>
          </div>
          <div className="recovery-modal-body">
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
          </div>
          <div className="recovery-modal-footer">
            <button onClick={onClose} className="recovery-button cancel-button">Cancel</button>
            <button onClick={handleRecover} className="recovery-button recovery-button-primary">
              Start Recovery
            </button>
          </div>
        </div>
      </div>
      )}
    </>
  );
}

