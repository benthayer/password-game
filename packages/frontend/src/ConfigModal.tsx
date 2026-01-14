/**
 * Configuration modal.
 * Orchestrates the config sections.
 */

import { useState, useEffect } from 'react';
import type { GenerationConfig } from './generation-config';
import { useConfigForm } from './hooks/useConfigForm';
import { CloseConfirmModal } from './shared';
import {
  GridSettingsSection,
  HashSettingsSection,
} from './config-modal';
import './ConfigModal.css';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  onSave: (config: GenerationConfig) => void;
  wordCount?: number;
}

export default function ConfigModal({
  isOpen,
  onClose,
  config,
  onSave,
}: ConfigModalProps) {
  const form = useConfigForm(config, isOpen);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowCloseConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCloseAttempt = () => {
    setShowCloseConfirm(true);
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  const handleSave = () => {
    onSave(form.toConfig());
    onClose();
  };

  return (
    <>
      <div className="config-modal-overlay" onClick={handleCloseAttempt}>
        <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
          <ModalHeader onClose={handleCloseAttempt} />
          
          <div className="config-modal-body">
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
          </div>

          <ModalFooter onCancel={handleCloseAttempt} onSave={handleSave} />
        </div>
      </div>
      <CloseConfirmModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
}

// ============================================================
// Modal Chrome Components
// ============================================================

function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="config-modal-header">
      <h2>Configuration</h2>
      <button className="config-modal-close" onClick={onClose}>×</button>
    </div>
  );
}

function ModalFooter({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="config-modal-footer">
      <button onClick={onCancel} className="config-button cancel-button">
        Cancel
      </button>
      <button onClick={onSave} className="config-button save-button">
        Save
      </button>
    </div>
  );
}
