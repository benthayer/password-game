/**
 * Security estimate display.
 * Shows cost-to-crack calculations with salt toggle.
 */

import { calculateCostToCrack, type CostToCrackResult } from '../cost-calculation';
import type { HashAlgorithmConfig } from '../generation-config';

interface SecurityEstimateProps {
  gridSize: number;
  wordCount: number;
  hashConfig: HashAlgorithmConfig;
  includeSalt: boolean;
  onIncludeSaltChange: (include: boolean) => void;
}

export default function SecurityEstimate({
  gridSize,
  wordCount,
  hashConfig,
  includeSalt,
  onIncludeSaltChange,
}: SecurityEstimateProps) {
  if (wordCount <= 0) return null;

  const result = calculateCostToCrack({
    gridSize,
    wordCount,
    hashConfig,
    userCount: 1,
  });

  return (
    <div className="cost-display">
      <h3>Security Estimate</h3>
      
      <SaltToggle checked={includeSalt} onChange={onIncludeSaltChange} />
      
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
      
      <BirthdayWarning visible={!includeSalt} />
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

function BirthdayWarning({ visible }: { visible: boolean }) {
  return (
    <div className={`cost-warning${visible ? '' : ' hidden'}`}>
      ⚠️ Without salt, multiple users share this cost (birthday attack).
    </div>
  );
}

