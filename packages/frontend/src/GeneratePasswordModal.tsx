/**
 * Generate password modal.
 * Configure grid and generate a new password with desired entropy.
 * Includes obnoxious config download prompts at two stages.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord, PERSIST_DESIRED_NUM_WORDS } from './generation-config';
import { generatePassword, generateSalt } from './crypto-utils';
import { calculateCostToCrack } from './cost-calculation';
import { useConfigForm } from './hooks/useConfigForm';
import { downloadConfigAsJson } from './config-json';
import {
  GridSettingsSection,
  HashSettingsSection,
  SecurityEstimate,
} from './config-modal';
import './GeneratePasswordModal.css';

type ModalStage = 'configure' | 'confirm';

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

  // Two-stage flow: configure -> confirm
  const [stage, setStage] = useState<ModalStage>('configure');
  const [downloadOnGenerate, setDownloadOnGenerate] = useState(true);
  const [generatedConfig, setGeneratedConfig] = useState<GenerationConfig | null>(null);

  // Reset stage when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStage('configure');
      setDownloadOnGenerate(true);
      setGeneratedConfig(null);
    }
  }, [isOpen]);

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

  const handleGenerateClick = () => {
    const newConfig = form.toConfig();
    // Generate salt if enabled
    if (newConfig.includeSalt) {
      newConfig.salt = generateSalt();
    }
    
    // Download config if checkbox is checked (pre-generate)
    if (downloadOnGenerate) {
      downloadConfigAsJson(newConfig);
    }
    
    setGeneratedConfig(newConfig);
    setStage('confirm');
  };

  const handleConfirmContinue = () => {
    if (!generatedConfig) return;
    
    setConfig(generatedConfig);
    setSubpassword(generatePassword(desiredNumWords, generatedConfig));
    navigate('/practice');
    onClose();
  };

  const handleDownloadConfig = () => {
    if (generatedConfig) {
      downloadConfigAsJson(generatedConfig);
    }
  };

  const handleBack = () => {
    setStage('configure');
    setGeneratedConfig(null);
  };

  if (stage === 'confirm' && generatedConfig) {
    return (
      <div className="generate-modal-overlay" onClick={onClose}>
        <div className="generate-modal-content" onClick={(e) => e.stopPropagation()}>
          <ConfirmHeader onClose={onClose} />
          <ConfirmBody config={generatedConfig} onDownload={handleDownloadConfig} />
          <ConfirmFooter onBack={handleBack} onContinue={handleConfirmContinue} />
        </div>
      </div>
    );
  }

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
          onGenerate={handleGenerateClick}
          numWords={desiredNumWords}
          disabled={blockReason.blocked}
          disabledReason={blockReason.reason}
          downloadOnGenerate={downloadOnGenerate}
          onDownloadOnGenerateChange={setDownloadOnGenerate}
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
  downloadOnGenerate,
  onDownloadOnGenerateChange,
}: {
  onCancel: () => void;
  onGenerate: () => void;
  numWords: number;
  disabled?: boolean;
  disabledReason?: string | null;
  downloadOnGenerate: boolean;
  onDownloadOnGenerateChange: (value: boolean) => void;
}) {
  return (
    <div className="generate-modal-footer">
      <div className="generate-footer-options">
        <label className="download-checkbox">
          <input
            type="checkbox"
            checked={downloadOnGenerate}
            onChange={(e) => onDownloadOnGenerateChange(e.target.checked)}
          />
          <span>Download configuration file</span>
        </label>
      </div>
      <div className="generate-footer-buttons">
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
    </div>
  );
}

// ============================================================
// Confirmation Stage Components
// ============================================================

function ConfirmHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="generate-modal-header confirm-header">
      <h2>⚠️ Save Your Configuration</h2>
      <button className="generate-modal-close" onClick={onClose}>×</button>
    </div>
  );
}

function ConfirmBody({ 
  config, 
  onDownload 
}: { 
  config: GenerationConfig;
  onDownload: () => void;
}) {
  return (
    <div className="generate-modal-body confirm-body">
      <div className="confirm-warning">
        <p><strong>Your password has been generated!</strong></p>
        <p>
          Before continuing, make sure you have saved your configuration. 
          Without it, you will <strong>permanently lose access</strong> to any data 
          encrypted with this password.
        </p>
      </div>

      <div className="confirm-config-summary">
        <div className="config-summary-item">
          <span className="config-summary-label">Seed Phrase:</span>
          <span className="config-summary-value">{config.seedPhrase || '(none)'}</span>
        </div>
        <div className="config-summary-item">
          <span className="config-summary-label">Grid:</span>
          <span className="config-summary-value">{config.gridRows} × {config.gridCols}</span>
        </div>
        <div className="config-summary-item">
          <span className="config-summary-label">Salt:</span>
          <span className="config-summary-value">{config.includeSalt ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>

      <button className="confirm-download-button" onClick={onDownload}>
        Download Configuration (JSON)
      </button>
    </div>
  );
}

function ConfirmFooter({ 
  onBack, 
  onContinue 
}: { 
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="generate-modal-footer confirm-footer">
      <button onClick={onBack} className="generate-button cancel-button">
        ← Back
      </button>
      <button onClick={onContinue} className="generate-button generate-button-primary">
        I've Saved My Config → Continue
      </button>
    </div>
  );
}
