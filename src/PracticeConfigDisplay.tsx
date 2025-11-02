import type { PracticeDisplayConfig } from './game-config';
import './PracticeConfigDisplay.css';

interface PracticeConfigDisplayProps {
  config: PracticeDisplayConfig;
  onConfigChange: (config: PracticeDisplayConfig) => void;
}

export default function PracticeConfigDisplay({ config, onConfigChange }: PracticeConfigDisplayProps) {
  const handleDisplayModeChange = (mode: 'none' | 'previous' | 'all') => {
    onConfigChange({
      ...config,
      displayMode: mode,
    });
  };

  const handleHighlightCurrentWordChange = () => {
    onConfigChange({
      ...config,
      highlightCurrentWord: !config.highlightCurrentWord,
    });
  };

  const handleHintChange = () => {
    onConfigChange({
      ...config,
      hint: !config.hint,
    });
  };

  return (
    <div className="practice-config-display">
      <div className="practice-config-item">
        <div className="practice-config-radio-group">
          <label className="practice-config-radio-label">
            <input
              type="radio"
              name="displayMode"
              checked={config.displayMode === 'none'}
              onChange={() => handleDisplayModeChange('none')}
            />
            <span>Display no words</span>
          </label>
          <label className="practice-config-radio-label">
            <input
              type="radio"
              name="displayMode"
              checked={config.displayMode === 'previous'}
              onChange={() => handleDisplayModeChange('previous')}
            />
            <span>Display previous words</span>
          </label>
          <label className="practice-config-radio-label">
            <input
              type="radio"
              name="displayMode"
              checked={config.displayMode === 'all'}
              onChange={() => handleDisplayModeChange('all')}
            />
            <span>Display all words</span>
          </label>
        </div>
        
        <div className="practice-config-sub-items">
          <label className={`practice-config-checkbox-label ${config.displayMode !== 'all' ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={config.highlightCurrentWord}
              onChange={handleHighlightCurrentWordChange}
            />
            <span>Highlight current word</span>
          </label>
          <label className={`practice-config-checkbox-label ${config.displayMode !== 'all' ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={config.hint}
              onChange={handleHintChange}
            />
            <span>Hint</span>
          </label>
        </div>
      </div>
    </div>
  );
}

