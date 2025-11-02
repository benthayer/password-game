import type { GenerationConfig } from './generation-config';
import { getGridSize, calculateEntropyPerWord, calculateWordsFor80Bits } from './generation-config';
import './ConfigDisplay.css';

interface ConfigDisplayProps {
  config: GenerationConfig;
}

export default function ConfigDisplay({ config }: ConfigDisplayProps) {
  const numOptions = getGridSize(config);
  const entropyPerWord = calculateEntropyPerWord(config);
  const wordsFor80Bits = calculateWordsFor80Bits(config);

  return (
    <div className="config-display">
      <div className="config-display-item">
        <span className="config-label">Seed phrase:</span>
        <span className="config-value config-seed-phrase">"{config.seedPhrase || ''}"</span>
      </div>
      <div className="config-display-item">
        <span className="config-label">Grid:</span>
        <span className="config-value">{config.gridCols} × {config.gridRows}</span>
      </div>
      <div className="config-display-item">
        <span className="config-label">Entropy per word:</span>
        <span className="config-value">{entropyPerWord.toFixed(2)}</span>
      </div>
      <div className="config-display-item">
        <span className="config-label">Words for 80 bits:</span>
        <span className="config-value">{wordsFor80Bits.toFixed(2)}</span>
      </div>
    </div>
  );
}

