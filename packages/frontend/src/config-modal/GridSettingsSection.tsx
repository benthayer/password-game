/**
 * Grid settings section of the config modal.
 * Handles seed phrase and grid dimensions.
 */

import { calculateEntropyPerWord, type GenerationConfig } from '../generation-config';

interface GridSettingsSectionProps {
  seedPhrase: string;
  onSeedPhraseChange: (value: string) => void;
  gridRows: number;
  gridCols: number;
  onIncrementRows: () => void;
  onDecrementRows: () => void;
  onIncrementCols: () => void;
  onDecrementCols: () => void;
  gridSize: number;
}

export default function GridSettingsSection({
  seedPhrase,
  onSeedPhraseChange,
  gridRows,
  gridCols,
  onIncrementRows,
  onDecrementRows,
  onIncrementCols,
  onDecrementCols,
  gridSize,
}: GridSettingsSectionProps) {
  // Calculate entropy for display
  const entropyPerWord = calculateEntropyPerWord({ 
    seedPhrase, 
    gridRows, 
    gridCols,
    // These don't affect entropy calculation
    hashAlgorithm: { algorithm: 'sha256' },
    includeSalt: true,
    salt: '',
  } as GenerationConfig);

  return (
    <div className="config-section">
      <h3>Grid Settings</h3>
      
      <SeedPhraseField value={seedPhrase} onChange={onSeedPhraseChange} />
      
      <div className="grid-fields-container">
        <GridDimensionControl
          label="Grid Rows"
          value={gridRows}
          onIncrement={onIncrementRows}
          onDecrement={onDecrementRows}
        />
        <GridDimensionControl
          label="Grid Columns"
          value={gridCols}
          onIncrement={onIncrementCols}
          onDecrement={onDecrementCols}
        />
      </div>

      <GridStats gridSize={gridSize} entropyPerWord={entropyPerWord} />
    </div>
  );
}

// ============================================================
// Sub-components (semantic atoms)
// ============================================================

function SeedPhraseField({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) {
  return (
    <div className="config-field">
      <label htmlFor="seed-phrase">Public Seed Phrase</label>
      <input
        id="seed-phrase"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter seed phrase"
      />
    </div>
  );
}

function GridDimensionControl({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="config-field">
      <label>{label}</label>
      <div className="grid-control">
        <button onClick={onDecrement} className="grid-button">-</button>
        <span className="grid-value">{value}</span>
        <button onClick={onIncrement} className="grid-button">+</button>
      </div>
    </div>
  );
}

function GridStats({ 
  gridSize, 
  entropyPerWord 
}: { 
  gridSize: number; 
  entropyPerWord: number;
}) {
  return (
    <div className="config-stats">
      <div className="stat-item">
        <span>Options per word:</span>
        <span className="stat-value">{gridSize}</span>
      </div>
      <div className="stat-item">
        <span>Entropy per word:</span>
        <span className="stat-value">{entropyPerWord.toFixed(2)} bits</span>
      </div>
    </div>
  );
}

