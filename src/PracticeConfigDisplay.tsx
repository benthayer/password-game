import type { PracticeDisplayConfig } from './game-config';
import './PracticeConfigDisplay.css';

interface PracticeConfigDisplayProps {
  config: PracticeDisplayConfig;
  onConfigChange: (config: PracticeDisplayConfig) => void;
}

export default function PracticeConfigDisplay({ config, onConfigChange }: PracticeConfigDisplayProps) {
  const handleCheckboxChange = (key: keyof PracticeDisplayConfig) => {
    onConfigChange({
      ...config,
      [key]: !config[key],
    });
  };

  return (
    <div className="practice-config-display">
      <div className="practice-config-item">
        <label className="practice-config-checkbox-label">
          <input
            type="checkbox"
            checked={config.displayPreviousWord}
            onChange={() => handleCheckboxChange('displayPreviousWord')}
          />
          <span>Display previous words</span>
        </label>
      </div>
      <div className="practice-config-item">
        <label className="practice-config-checkbox-label">
          <input
            type="checkbox"
            checked={config.displayCurrentWord}
            onChange={() => handleCheckboxChange('displayCurrentWord')}
          />
          <span>Display current word</span>
        </label>
      </div>
      <div className="practice-config-item">
        <label className="practice-config-checkbox-label">
          <input
            type="checkbox"
            checked={config.highlightCurrentWord}
            onChange={() => handleCheckboxChange('highlightCurrentWord')}
          />
          <span>Highlight current word</span>
        </label>
      </div>
      <div className="practice-config-item">
        <label className="practice-config-checkbox-label">
          <input
            type="checkbox"
            checked={config.displayFutureWords}
            onChange={() => handleCheckboxChange('displayFutureWords')}
          />
          <span>Display future words</span>
        </label>
      </div>
    </div>
  );
}

