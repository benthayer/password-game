/**
 * Configuration modal.
 * Orchestrates the config sections.
 */

import type { GenerationConfig } from './generation-config';
import { useConfigForm } from './hooks/useConfigForm';
import {
  GridSettingsSection,
  HashSettingsSection,
  SaltSection,
  SecurityEstimate,
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
  wordCount = 8,
}: ConfigModalProps) {
  const form = useConfigForm(config, isOpen);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(form.toConfig());
    onClose();
  };

  return (
    <div className="config-modal-overlay" onClick={onClose}>
      <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader onClose={onClose} />
        
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
          />

          <SaltSection
            includeSalt={form.includeSalt}
            onIncludeSaltChange={form.setIncludeSalt}
            salt={form.salt}
            onSaltChange={form.setSalt}
          />

          <SecurityEstimate
            gridSize={form.gridSize}
            wordCount={wordCount}
            hashConfig={form.hashAlgorithm}
            includeSalt={form.includeSalt}
          />
        </div>

        <ModalFooter onCancel={onClose} onSave={handleSave} />
      </div>
    </div>
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
