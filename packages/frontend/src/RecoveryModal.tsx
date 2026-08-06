/**
 * Recovery modal.
 * Configure grid before starting password recovery.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import { useConfigForm } from './hooks/useConfigForm';
import { CloseConfirmModal, ImportedConfigBanner } from './shared';
import { ImportConfigModal } from './config-io';
import {
  GridSettingsSection,
  HashSettingsSection,
} from './config-modal';
import './RecoveryModal.css';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  configImportedFromJson: boolean;
  setConfig: (config: GenerationConfig, importedFromJson?: boolean) => void;
  setSubpassword: (password: string[]) => void;
}

export default function RecoveryModal({
  isOpen,
  onClose,
  config,
  configImportedFromJson,
  setConfig,
  setSubpassword,
}: RecoveryModalProps) {
  const navigate = useNavigate();
  const form = useConfigForm(config, isOpen);
  const [importOpen, setImportOpen] = useState(false);
  const [boundToImport, setBoundToImport] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowCloseConfirm(false);
      setImportOpen(false);
      setBoundToImport(configImportedFromJson);
    }
  }, [isOpen, configImportedFromJson]);

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

  const handleRecover = () => {
    setConfig(form.toConfig(), boundToImport);
    setSubpassword([]);
    navigate('/recovery');
    onClose();
  };

  const handleImported = (importedConfig: GenerationConfig) => {
    form.loadFromConfig(importedConfig);
    setBoundToImport(true);
  };

  return (
    <>
      <div className="recovery-modal-overlay" onClick={handleCloseAttempt}>
        <div className="recovery-modal-content" onClick={(e) => e.stopPropagation()}>
          <ModalHeader onClose={handleCloseAttempt} onImport={() => setImportOpen(true)} />



          {boundToImport && (
            <ImportedConfigBanner onEditManually={() => setBoundToImport(false)} />
          )}

          <div className="recovery-modal-body">
            <fieldset className="config-fieldset" disabled={boundToImport}>
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
                saltMode="recovery"
                salt={form.salt}
                onSaltChange={form.setSalt}
              />
            </fieldset>
          </div>

          <ModalFooter onCancel={handleCloseAttempt} onRecover={handleRecover} />
        </div>
      </div>
      <ImportConfigModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImported}
      />
      <CloseConfirmModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ModalHeader({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  return (
    <div className="recovery-modal-header">
      <h2>Recover Password</h2>
      <div className="recovery-modal-header-buttons">
        <button className="recovery-import-button" onClick={onImport} title="Paste a config string or upload a file">
          ↑ Import
        </button>
        <button className="recovery-modal-close" onClick={onClose}>×</button>
      </div>
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
