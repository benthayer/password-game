/**
 * Security estimate display.
 * Shows cost-to-crack calculations.
 */

import { calculateCostToCrack } from '../cost-calculation';
import type { HashAlgorithmConfig } from '../generation-config';

interface SecurityEstimateProps {
  gridSize: number;
  wordCount: number;
  onWordCountChange?: (count: number) => void;
  entropyPerWord?: number;
  hashConfig: HashAlgorithmConfig;
}

export default function SecurityEstimate({
  gridSize,
  wordCount,
  onWordCountChange,
  entropyPerWord,
  hashConfig,
}: SecurityEstimateProps) {
  if (wordCount <= 0) return null;

  const result = calculateCostToCrack({
    gridSize,
    wordCount,
    hashConfig,
    userCount: 1,
  });

  const totalBits = entropyPerWord ? wordCount * entropyPerWord : null;

  return (
    <div className="cost-display">
      {onWordCountChange && (
        <WordCountInput 
          value={wordCount} 
          onChange={onWordCountChange} 
          totalBits={totalBits}
        />
      )}
      <h3>Security Information</h3>
      
      <div className="cost-items">
        <CostItem label="Password entropy" value={result.formatted.entropy} />
        <CostItem label="Password space" value={result.formatted.passwordSpace} />
      </div>

      <h4 className="cost-subsection-title">Estimated Cost to Crack</h4>
      <div className="cost-highlight-value">{result.formatted.singleTarget}</div>
    </div>
  );
}

function WordCountInput({
  value,
  onChange,
  totalBits,
}: {
  value: number;
  onChange: (value: number) => void;
  totalBits: number | null;
}) {
  const decrement = () => {
    if (value > 1) onChange(value - 1);
  };
  const increment = () => {
    onChange(value + 1);
  };

  return (
    <div className="word-count-input">
      <div className="word-count-left">
        <span className="word-count-label">Number of words</span>
        <div className="word-count-control">
          <button className="word-count-btn" onClick={decrement} disabled={value <= 1}>
            <span>‹</span>
          </button>
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const parsed = parseInt(e.target.value);
              if (!isNaN(parsed) && parsed > 0) {
                onChange(parsed);
              }
            }}
            min="1"
            step="1"
          />
          <button className="word-count-btn" onClick={increment}>
            <span>›</span>
          </button>
        </div>
      </div>
      {totalBits !== null && (
        <span className="word-count-bits">≈ {totalBits.toFixed(1)} bits</span>
      )}
    </div>
  );
}

function CostItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`cost-item${highlight ? ' highlight' : ''}`}>
      <span>{label}:</span>
      <span className="cost-value">{value}</span>
    </div>
  );
}
