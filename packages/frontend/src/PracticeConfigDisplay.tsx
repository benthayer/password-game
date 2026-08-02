import type { PracticeDisplayConfig } from './generation-config';
import './PracticeConfigDisplay.css';

interface PracticeConfigControlProps {
  config: PracticeDisplayConfig;
  onConfigChange: (config: PracticeDisplayConfig) => void;
}

export function DisplayModeSelect({ config, onConfigChange }: PracticeConfigControlProps) {
  return (
    <select
      className="practice-config-select"
      value={config.displayMode}
      onChange={(e) =>
        onConfigChange({
          ...config,
          displayMode: e.target.value as 'none' | 'previous' | 'all',
        })
      }
    >
      <option value="none">Display no words</option>
      <option value="previous">Display previous words</option>
      <option value="all">Display all words</option>
    </select>
  );
}

export function HighlightCurrentWordCheckbox({ config, onConfigChange }: PracticeConfigControlProps) {
  return (
    <div className={`practice-config-checkbox-label ${config.displayMode !== 'all' ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={config.highlightCurrentWord}
        onChange={() =>
          onConfigChange({ ...config, highlightCurrentWord: !config.highlightCurrentWord })
        }
      />
      <span>Highlight next word</span>
    </div>
  );
}

export function HintCheckbox({ config, onConfigChange }: PracticeConfigControlProps) {
  return (
    <div className={`practice-config-checkbox-label ${config.displayMode !== 'all' ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={config.hint}
        onChange={() => onConfigChange({ ...config, hint: !config.hint })}
      />
      <span>Highlight next word</span>
    </div>
  );
}
