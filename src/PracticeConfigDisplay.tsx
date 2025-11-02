import type { PracticeDisplayConfig } from './game-config';
import './PracticeConfigDisplay.css';

interface PracticeConfigDisplayProps {
  config: PracticeDisplayConfig;
  onConfigChange: (config: PracticeDisplayConfig) => void;
}

export default function PracticeConfigDisplay({ config, onConfigChange }: PracticeConfigDisplayProps) {
  const handleDisplayChange = () => {
    onConfigChange({
      ...config,
      display: !config.display,
    });
  };

  const handleDisplayCurrentWordChange = () => {
    // Can toggle, but only has effect if display is enabled
    onConfigChange({
      ...config,
      displayCurrentWord: !config.displayCurrentWord,
    });
  };

  const handleHighlightCurrentWordChange = () => {
    // Can toggle, but only has effect if display and display current word are enabled
    // Note: highlight state is retained even when displayCurrentWord is disabled
    onConfigChange({
      ...config,
      highlightCurrentWord: !config.highlightCurrentWord,
    });
  };

  const handleDisplayFutureWordsChange = () => {
    // Can toggle, but only has effect if display and display current word are enabled
    onConfigChange({
      ...config,
      displayFutureWords: !config.displayFutureWords,
    });
  };

  return (
    <div className="practice-config-display">
      <div className="practice-config-item">
        <label className="practice-config-checkbox-label">
          <input
            type="checkbox"
            checked={config.display}
            onChange={handleDisplayChange}
          />
          <span>Display words</span>
        </label>
        
        <div className="practice-config-sub-items">
          <div className="practice-config-item practice-config-sub-item">
            <label className={`practice-config-checkbox-label ${!config.display ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={config.displayCurrentWord}
                onChange={handleDisplayCurrentWordChange}
              />
              <span>Display current word</span>
            </label>
            
            <div className="practice-config-sub-items">
              <div className="practice-config-item practice-config-sub-item">
                <label className={`practice-config-checkbox-label ${!config.display || !config.displayCurrentWord ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={config.highlightCurrentWord}
                    onChange={handleHighlightCurrentWordChange}
                  />
                  <span>Highlight current word</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="practice-config-item practice-config-sub-item">
            <label className={`practice-config-checkbox-label ${!config.display || !config.displayCurrentWord ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={config.displayFutureWords}
                onChange={handleDisplayFutureWordsChange}
              />
              <span>Display future words</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

