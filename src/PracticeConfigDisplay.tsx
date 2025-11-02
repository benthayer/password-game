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
    const newDisplayCurrentWord = !config.displayCurrentWord;
    const newConfig: PracticeDisplayConfig = {
      ...config,
      displayCurrentWord: newDisplayCurrentWord,
    };
    
    // If disabling display current word, also disable display future words and highlight
    if (!newDisplayCurrentWord) {
      newConfig.displayFutureWords = false;
      newConfig.highlightCurrentWord = false;
    }
    
    onConfigChange(newConfig);
  };

  const handleHighlightCurrentWordChange = () => {
    // Can only enable highlight if display and display current word are enabled
    if (config.display && config.displayCurrentWord) {
      onConfigChange({
        ...config,
        highlightCurrentWord: !config.highlightCurrentWord,
      });
    }
  };

  const handleDisplayFutureWordsChange = () => {
    // Can only enable display future words if display and display current word are enabled
    if (config.display && config.displayCurrentWord) {
      onConfigChange({
        ...config,
        displayFutureWords: !config.displayFutureWords,
      });
    }
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
            <label className="practice-config-checkbox-label">
              <input
                type="checkbox"
                checked={config.displayCurrentWord}
                onChange={handleDisplayCurrentWordChange}
                disabled={!config.display}
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
                    disabled={!config.display || !config.displayCurrentWord}
                  />
                  <span>Highlight current word</span>
                </label>
              </div>
            </div>
            
            <div className="practice-config-sub-items">
              <div className="practice-config-item practice-config-sub-item">
                <label className={`practice-config-checkbox-label ${!config.display || !config.displayCurrentWord ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={config.displayFutureWords}
                    onChange={handleDisplayFutureWordsChange}
                    disabled={!config.display || !config.displayCurrentWord}
                  />
                  <span>Display future words</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

