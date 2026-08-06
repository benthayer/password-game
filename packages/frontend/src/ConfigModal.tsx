/**
 * Configuration modal.
 * Orchestrates the config sections.
 */

import { useState, useEffect } from 'react';
import type { GenerationConfig } from './generation-config';
import { useConfigForm } from './hooks/useConfigForm';
import { CloseConfirmModal, ImportedConfigBanner } from './shared';
import { ImportConfigModal } from './config-io';
import {
  GridSettingsSection,
  HashSettingsSection,
} from './config-modal';
import './ConfigModal.css';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  configImportedFromJson: boolean;
  onSave: (config: GenerationConfig, importedFromJson: boolean) => void;
  wordCount?: number;
}

export default function ConfigModal({
  isOpen,
  onClose,
  config,
  configImportedFromJson,
  onSave,
}: ConfigModalProps) {
  const form = useConfigForm(config, isOpen);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [boundToImport, setBoundToImport] = useState(false);

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

  const handleSave = () => {
    onSave(form.toConfig(), boundToImport);
    onClose();
  };

  const handleImported = (importedConfig: GenerationConfig) => {
    form.loadFromConfig(importedConfig);
    setBoundToImport(true);
  };

  return (
    <>
      <div className="config-modal-overlay" onClick={handleCloseAttempt}>
        <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
          <ModalHeader onClose={handleCloseAttempt} onImport={() => setImportOpen(true)} />



          {boundToImport && (
            <ImportedConfigBanner onEditManually={() => setBoundToImport(false)} />
          )}

          <div className="config-modal-body">
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

          <ModalFooter onCancel={handleCloseAttempt} onSave={handleSave} />
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
// Modal Chrome Components
// ============================================================

function ModalHeader({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  return (
    <div className="config-modal-header">
      <h2>Configuration</h2>
      <div className="config-modal-header-buttons">
        <button className="config-import-button" onClick={onImport} title="Paste a config string or upload a file">
          ↑ Import
        </button>
        <button className="config-modal-close" onClick={onClose}>×</button>
      </div>
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
