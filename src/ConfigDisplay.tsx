import type { GenerationConfig } from './generation-config';
import { getGridSize, calculateEntropyPerWord, calculateWordsFor80Bits } from './generation-config';
import './ConfigDisplay.css';

interface ConfigDisplayProps {
  config: GenerationConfig;
  numWords?: number;
}

export default function ConfigDisplay({ config, numWords }: ConfigDisplayProps) {
  const numOptions = getGridSize(config);
  const entropyPerWord = calculateEntropyPerWord(config);
  const wordsFor80Bits = calculateWordsFor80Bits(config);
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
        <span className="config-value">{config.gridCols} × {config.gridRows}</span>
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