/**
 * Recovery modal.
 * Configure grid before starting password recovery.
 */

import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import { useConfigForm } from './hooks/useConfigForm';
import {
  GridSettingsSection,
  HashSettingsSection,
  SaltSection,
} from './config-modal';
import './RecoveryModal.css';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  setSubpassword: (password: string[]) => void;
}

export default function RecoveryModal({
  isOpen,
  onClose,
  config,
  setConfig,
  setSubpassword,
}: RecoveryModalProps) {
  const navigate = useNavigate();
  const form = useConfigForm(config, isOpen);

  if (!isOpen) return null;

  const handleRecover = () => {
    setConfig(form.toConfig());
    setSubpassword([]);
    navigate('/recovery');
    onClose();
  };

  return (
    <div className="recovery-modal-overlay" onClick={onClose}>
      <div className="recovery-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader onClose={onClose} />

        <div className="recovery-modal-body">
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
        </div>

        <ModalFooter onCancel={onClose} onRecover={handleRecover} />
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="recovery-modal-header">
      <h2>Recover Password</h2>
      <button className="recovery-modal-close" onClick={onClose}>×</button>
    </div>
  );
}

function ModalFooter({
  onCancel,
  onRecover,
}: {
  onCancel: () => void;
  onRecover: () => void;
}) {
  return (
    <div className="recovery-modal-footer">
      <button onClick={onCancel} className="recovery-button cancel-button">
        Cancel
      </button>
      <button onClick={onRecover} className="recovery-button recovery-button-primary">
        Start Recovery
      </button>
    </div>
  );
}
