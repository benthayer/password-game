/**
 * Hash algorithm settings section.
 * Algorithm selection + per-algorithm parameter controls.
 */

import type { HashAlgorithm, HashAlgorithmConfig } from '../generation-config';
import { AVAILABLE_ALGORITHMS, ALGORITHM_META } from '../generation-config';
import type { Argon2idConfig, ScryptConfig, BcryptConfig, Pbkdf2Config } from '../hash-config';
import { kbToUnit, unitToKb, inferUnit, type MemoryUnit } from '../memory-units';

interface HashSettingsSectionProps {
  algorithm: HashAlgorithmConfig;
  onAlgorithmChange: (algorithm: HashAlgorithm) => void;
  onConfigChange: (config: HashAlgorithmConfig) => void;
}

export default function HashSettingsSection({
  algorithm,
  onAlgorithmChange,
  onConfigChange,
}: HashSettingsSectionProps) {
  return (
    <div className="config-section">
      <h3>Hash Settings</h3>
      
      <AlgorithmSelector
        selected={algorithm.algorithm}
        onChange={onAlgorithmChange}
      />
      
      <div className="algorithm-params">
        <AlgorithmParams algorithm={algorithm} onChange={onConfigChange} />
      </div>
    </div>
  );
}

// ============================================================
// Algorithm Selector
// ============================================================

function AlgorithmSelector({
  selected,
  onChange,
}: {
  selected: HashAlgorithm;
  onChange: (algorithm: HashAlgorithm) => void;
}) {
  const meta = ALGORITHM_META[selected];
  
  return (
    <div className="config-field">
      <label htmlFor="algorithm">Algorithm</label>
      <select
        id="algorithm"
        value={selected}
        onChange={(e) => onChange(e.target.value as HashAlgorithm)}
      >
        {AVAILABLE_ALGORITHMS.map((alg) => (
          <option key={alg} value={alg}>
            {ALGORITHM_META[alg].name}
            {ALGORITHM_META[alg].recommended ? ' (Recommended)' : ''}
          </option>
        ))}
      </select>
      <div className="field-hint algorithm-description">
        {meta.description}
      </div>
    </div>
  );
}

// ============================================================
// Algorithm-Specific Parameters
// ============================================================

function AlgorithmParams({
  algorithm,
  onChange,
}: {
  algorithm: HashAlgorithmConfig;
  onChange: (config: HashAlgorithmConfig) => void;
}) {
  switch (algorithm.algorithm) {
    case 'argon2id':
      return <Argon2idParams config={algorithm} onChange={onChange} />;
    case 'scrypt':
      return <ScryptParams config={algorithm} onChange={onChange} />;
    case 'bcrypt':
      return <BcryptParams config={algorithm} onChange={onChange} />;
    case 'pbkdf2':
      return <Pbkdf2Params config={algorithm} onChange={onChange} />;
    case 'sha256':
      return <Sha256Warning />;
  }
}

// ============================================================
// Argon2id Parameters
// ============================================================

function Argon2idParams({
  config,
  onChange,
}: {
  config: Argon2idConfig;
  onChange: (config: Argon2idConfig) => void;
}) {
  const updateField = <K extends keyof Argon2idConfig>(
    field: K, 
    value: Argon2idConfig[K]
  ) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <>
      <MemoryCostField
        valueKb={config.memoryCost}
        onChange={(kb) => updateField('memoryCost', kb)}
      />
      <NumberField
        label="Time Cost (iterations)"
        value={config.timeCost}
        onChange={(v) => updateField('timeCost', v)}
        min={1}
      />
      <NumberField
        label="Parallelism"
        value={config.parallelism}
        onChange={(v) => updateField('parallelism', v)}
        min={1}
      />
    </>
  );
}

// ============================================================
// Scrypt Parameters
// ============================================================

function ScryptParams({
  config,
  onChange,
}: {
  config: ScryptConfig;
  onChange: (config: ScryptConfig) => void;
}) {
  const updateField = <K extends keyof ScryptConfig>(
    field: K, 
    value: ScryptConfig[K]
  ) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <>
      <NumberField
        label="N (CPU/memory cost)"
        value={config.N}
        onChange={(v) => updateField('N', v)}
        min={16384}
        step={16384}
        hint={`2^${Math.log2(config.N).toFixed(0)}`}
      />
      <NumberField
        label="r (block size)"
        value={config.r}
        onChange={(v) => updateField('r', v)}
        min={1}
      />
      <NumberField
        label="p (parallelism)"
        value={config.p}
        onChange={(v) => updateField('p', v)}
        min={1}
      />
    </>
  );
}

// ============================================================
// Bcrypt Parameters
// ============================================================

function BcryptParams({
  config,
  onChange,
}: {
  config: BcryptConfig;
  onChange: (config: BcryptConfig) => void;
}) {
  return (
    <NumberField
      label="Cost (log2 iterations)"
      value={config.cost}
      onChange={(cost) => onChange({ ...config, cost })}
      min={4}
      max={31}
      hint={`${Math.pow(2, config.cost).toLocaleString()} iterations`}
    />
  );
}

// ============================================================
// PBKDF2 Parameters
// ============================================================

function Pbkdf2Params({
  config,
  onChange,
}: {
  config: Pbkdf2Config;
  onChange: (config: Pbkdf2Config) => void;
}) {
  return (
    <>
      <NumberField
        label="Iterations"
        value={config.iterations}
        onChange={(iterations) => onChange({ ...config, iterations })}
        min={10000}
        step={10000}
      />
      <div className="config-field">
        <label>Hash Function</label>
        <select
          value={config.hash}
          onChange={(e) => onChange({ 
            ...config, 
            hash: e.target.value as 'sha256' | 'sha512' 
          })}
        >
          <option value="sha256">SHA-256</option>
          <option value="sha512">SHA-512</option>
        </select>
      </div>
    </>
  );
}

// ============================================================
// SHA-256 Warning
// ============================================================

function Sha256Warning() {
  return (
    <div className="algorithm-warning">
      ⚠️ Raw SHA-256 provides no brute-force protection. 
      Only use for testing or if passwords have extremely high entropy.
    </div>
  );
}

// ============================================================
// Reusable Field Components
// ============================================================

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="config-field">
      <label>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min || 1)}
        min={min}
        max={max}
        step={step}
      />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

function MemoryCostField({
  valueKb,
  onChange,
}: {
  valueKb: number;
  onChange: (kb: number) => void;
}) {
  const unit = inferUnit(valueKb);
  const displayValue = kbToUnit(valueKb, unit);

  const handleValueChange = (newValue: number) => {
    onChange(unitToKb(newValue, unit));
  };

  const handleUnitChange = (newUnit: MemoryUnit) => {
    // Convert current value to new unit
    onChange(unitToKb(displayValue, newUnit));
  };

  return (
    <div className="config-field">
      <label>Memory Cost</label>
      <div className="memory-input-group">
        <input
          type="number"
          value={displayValue}
          onChange={(e) => handleValueChange(parseInt(e.target.value) || 64)}
          min={1}
        />
        <select
          value={unit}
          onChange={(e) => handleUnitChange(e.target.value as MemoryUnit)}
          className="memory-unit-select"
        >
          <option value="KB">KB</option>
          <option value="MB">MB</option>
          <option value="GB">GB</option>
        </select>
      </div>
    </div>
  );
}

