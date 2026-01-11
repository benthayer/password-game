/**
 * Security estimate display.
 * Shows cost-to-crack calculations with salt toggle.
 */

import { useState } from 'react';
import { calculateCostToCrack, type CostToCrackResult } from '../cost-calculation';
import type { HashAlgorithmConfig } from '../generation-config';
import SaltInfoModal from './SaltInfoModal';

interface SecurityEstimateProps {
  gridSize: number;
  wordCount: number;
  onWordCountChange?: (count: number) => void;
  entropyPerWord?: number;
  hashConfig: HashAlgorithmConfig;
  includeSalt: boolean;
  onIncludeSaltChange: (include: boolean) => void;
}

export default function SecurityEstimate({
  gridSize,
  wordCount,
  onWordCountChange,
  entropyPerWord,
  hashConfig,
  includeSalt,
  onIncludeSaltChange,
}: SecurityEstimateProps) {
  const [infoModalOpen, setInfoModalOpen] = useState(false);

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
      <h3>Security Estimate</h3>
      
      <SaltToggle checked={includeSalt} onChange={onIncludeSaltChange} />
      
      <SaltStatus enabled={includeSalt} onLearnMore={() => setInfoModalOpen(true)} />

      {onWordCountChange && (
        <WordCountInput 
          value={wordCount} 
          onChange={onWordCountChange} 
          totalBits={totalBits}
        />
      )}
      
      <div className="cost-items">
        <CostItem label="Password entropy" value={result.formatted.entropy} />
        <CostItem label="Password space" value={result.formatted.passwordSpace} />
        <CostItem label="Hash algorithm" value={result.costPerHashDescription} />
        <CostItem 
          label="Estimated cost to crack" 
          value={result.formatted.singleTarget}
          highlight
        />
      </div>

      <SaltInfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
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

function SaltToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="salt-toggle">
      <label>
        <span>Include salt</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
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

function SaltStatus({ enabled, onLearnMore }: { enabled: boolean; onLearnMore: () => void }) {
  return (
    <div className={`salt-status ${enabled ? 'salt-status-enabled' : 'salt-status-warning'}`}>
      <span className="salt-status-icon">{enabled ? '✓' : '⚠️'}</span>
      <span className="salt-status-text">
        {enabled 
          ? 'Salt enabled — you cannot be compromised in a multi-target attack' 
          : 'Salt disabled — you might be compromised in a multi-target attack'}
      </span>
      <button className="salt-status-learn-more" onClick={onLearnMore}>
        Learn more
      </button>
    </div>
  );
}

