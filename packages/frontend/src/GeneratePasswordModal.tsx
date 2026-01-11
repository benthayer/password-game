/**
 * Generate password modal.
 * Configure grid and generate a new password with desired entropy.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord } from './generation-config';
import { generatePassword, generateSalt } from './crypto-utils';
import { useConfigForm } from './hooks/useConfigForm';
import {
  GridSettingsSection,
  HashSettingsSection,
  SecurityEstimate,
} from './config-modal';
import './GeneratePasswordModal.css';

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
    const saved = localStorage.getItem('desiredNumWords');
    return saved ? parseInt(saved) : 20;
  });

  useEffect(() => {
    localStorage.setItem('desiredNumWords', desiredNumWords.toString());
  }, [desiredNumWords]);

  if (!isOpen) return null;

  const entropyPerWord = calculateEntropyPerWord(form.toConfig());

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

function ModalFooter({
  onCancel,
  onGenerate,
  numWords,
}: {
  onCancel: () => void;
  onGenerate: () => void;
  numWords: number;
}) {
  return (
    <div className="generate-modal-footer">
      <button onClick={onCancel} className="generate-button cancel-button">
        Cancel
      </button>
      <button onClick={onGenerate} className="generate-button generate-button-primary">
        Generate {numWords} words
      </button>
    </div>
  );
}
