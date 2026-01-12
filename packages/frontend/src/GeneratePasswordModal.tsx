/**
 * Generate password modal.
 * Configure grid and generate a new password with desired entropy.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord, PERSIST_DESIRED_NUM_WORDS } from './generation-config';
import { generatePassword, generateSalt } from './crypto-utils';
import { calculateCostToCrack } from './cost-calculation';
import { useConfigForm } from './hooks/useConfigForm';
import {
  GridSettingsSection,
  HashSettingsSection,
  SecurityEstimate,
} from './config-modal';
import './GeneratePasswordModal.css';

// ============================================================
// Security Thresholds for Multi-Target Attack Protection
// ============================================================

const C2C_THRESHOLD_NO_SALT = 100e12;   // $100 trillion (~global GDP)

interface GenerationBlockReason {
  blocked: boolean;
  reason: string | null;
}

function getGenerationBlockReason(
  includeSalt: boolean,
  costToCrack: number
): GenerationBlockReason {
  // Salt allows any password strength
  if (includeSalt) {
    return { blocked: false, reason: null };
  }
  
  if (costToCrack < C2C_THRESHOLD_NO_SALT) {
    return {
      blocked: true,
      reason: `Cost to crack must exceed global GDP (~$100T) without salt`,
    };
  }
  
  return { blocked: false, reason: null };
}

interface GeneratePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  setSubpassword: (password: string[]) => void;
}

export default function GeneratePasswordModal({
  isOpen,
  onClose,
  config,
  setConfig,
  setSubpassword,
}: GeneratePasswordModalProps) {
  const navigate = useNavigate();
  const form = useConfigForm(config, isOpen);

  const [desiredNumWords, setDesiredNumWords] = useState<number>(() => {
    if (PERSIST_DESIRED_NUM_WORDS) {
      const saved = localStorage.getItem('desiredNumWords');
      return saved ? parseInt(saved) : 20;
    }
    return 20;
  });

  useEffect(() => {
    if (PERSIST_DESIRED_NUM_WORDS) {
      localStorage.setItem('desiredNumWords', desiredNumWords.toString());
    }
  }, [desiredNumWords]);

  if (!isOpen) return null;

  const entropyPerWord = calculateEntropyPerWord(form.toConfig());
  
  // Calculate cost to crack for validation
  const costResult = calculateCostToCrack({
    gridSize: form.gridSize,
    wordCount: desiredNumWords,
    hashConfig: form.hashAlgorithm,
    userCount: 1,
  });
  
  const blockReason = getGenerationBlockReason(
    form.includeSalt,
    costResult.singleTargetCostUsd
  );

  const handleGenerate = () => {
    const newConfig = form.toConfig();
    // Generate salt if enabled
    if (newConfig.includeSalt) {
      newConfig.salt = generateSalt();
    }
    setConfig(newConfig);
    setSubpassword(generatePassword(desiredNumWords, newConfig));
    navigate('/practice');
    onClose();
  };

  return (
    <div className="generate-modal-overlay" onClick={onClose}>
      <div className="generate-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader onClose={onClose} />

        <div className="generate-modal-body">
          <GridSettingsSection
            seedPhrase={form.seedPhrase}
            onSeedPhraseChange={form.setSeedPhrase}
            gridRows={form.gridRows}
            gridCols={form.gridCols}
            onIncrementRows={form.incrementRows}
            onDecrementRows={form.decrementRows}
            onIncrementCols={form.incrementCols}
            onDecrementCols={form.decrementCols}
            gridSize={form.gridSize}
          />

          <HashSettingsSection
            algorithm={form.hashAlgorithm}
            onAlgorithmChange={form.changeAlgorithm}
            onConfigChange={form.setHashAlgorithm}
            useRecommended={form.useRecommendedHash}
            onUseRecommendedChange={form.setUseRecommendedHash}
            includeSalt={form.includeSalt}
            onIncludeSaltChange={form.setIncludeSalt}
          />

          <SecurityEstimate
            gridSize={form.gridSize}
            wordCount={desiredNumWords}
            onWordCountChange={setDesiredNumWords}
            entropyPerWord={entropyPerWord}
            hashConfig={form.hashAlgorithm}
            includeSalt={form.includeSalt}
          />
        </div>

        <ModalFooter
          onCancel={onClose}
          onGenerate={handleGenerate}
          numWords={desiredNumWords}
          disabled={blockReason.blocked}
          disabledReason={blockReason.reason}
        />
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="generate-modal-header">
      <h2>Generate Password</h2>
      <button className="generate-modal-close" onClick={onClose}>×</button>
    </div>
  );
}

const WEAK_PASSWORD_TOOLTIP = `By default, we do not let you generate weak passwords due to the risk of multi-target attacks:

• Without salt, cost to crack must exceed global GDP (~$100 trillion)
• With salt, weak passwords are not blocked`;

function ModalFooter({
  onCancel,
  onGenerate,
  numWords,
  disabled,
  disabledReason,
}: {
  onCancel: () => void;
  onGenerate: () => void;
  numWords: number;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  return (
    <div className="generate-modal-footer">
      <button onClick={onCancel} className="generate-button cancel-button">
        Cancel
      </button>
      <div className="generate-button-wrapper">
        <button 
          onClick={onGenerate} 
          className={`generate-button generate-button-primary${disabled ? ' disabled' : ''}`}
          disabled={disabled}
        >
          Generate {numWords} words
        </button>
        {disabled && (
          <div className="generate-tooltip">
            <div className="generate-tooltip-header">
              ⚠️ {disabledReason}
            </div>
            <div className="generate-tooltip-body">
              {WEAK_PASSWORD_TOOLTIP}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
