import { useState, useEffect } from 'react';
import type { GameConfig } from './game-config';
import { getGridSize, calculateEntropyPerWord, calculateWordsFor80Bits } from './game-config';
import './ConfigModal.css';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GameConfig;
  onSave: (config: GameConfig) => void;
}

export default function ConfigModal({ isOpen, onClose, config, onSave }: ConfigModalProps) {
  const [seedPhrase, setSeedPhrase] = useState(config.seedPhrase);
  const [gridRows, setGridRows] = useState(config.gridRows);
  const [gridCols, setGridCols] = useState(config.gridCols);

  useEffect(() => {
    if (isOpen) {
      setSeedPhrase(config.seedPhrase);
      setGridRows(config.gridRows);
      setGridCols(config.gridCols);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const currentConfig: GameConfig = { seedPhrase, gridRows, gridCols };
  const numOptions = getGridSize(currentConfig);
  const entropyPerWord = calculateEntropyPerWord(currentConfig);
  const wordsFor80Bits = calculateWordsFor80Bits(currentConfig);

  const handleSave = () => {
    onSave(currentConfig);
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
    <div className="config-modal-overlay" onClick={onClose}>
      <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="config-modal-header">
          <h2>Configuration</h2>
          <button className="config-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="config-modal-body">
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
            <div className="calculated-item">
              <span>Words for 80 bits:</span>
              <span className="calculated-value">{wordsFor80Bits.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="config-modal-footer">
          <button onClick={onClose} className="config-button cancel-button">Cancel</button>
          <button onClick={handleSave} className="config-button save-button">Save</button>
        </div>
      </div>
    </div>
  );
}

