/**
 * Configuration modal.
 * Orchestrates the config sections.
 */

import { useState, useEffect, useRef } from 'react';
import type { GenerationConfig } from './generation-config';
import { useConfigForm } from './hooks/useConfigForm';
import { parseConfigFromJson, ConfigParseError } from './config-json';
import { CloseConfirmModal, ImportedConfigBanner } from './shared';
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
  const [importError, setImportError] = useState<string | null>(null);
  const [boundToImport, setBoundToImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShowCloseConfirm(false);
      setImportError(null);
      setBoundToImport(!!config.importedFromJson);
    }
  }, [isOpen, config.importedFromJson]);

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
    onSave({ ...form.toConfig(), importedFromJson: boundToImport });
    onClose();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportError(null);
      const importedConfig = await parseConfigFromJson(file);
      form.loadFromConfig(importedConfig);
      setBoundToImport(true);
    } catch (err) {
      if (err instanceof ConfigParseError) {
        setImportError(err.message);
      } else {
        setImportError('Failed to read configuration file');
      }
    }

    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="config-modal-overlay" onClick={handleCloseAttempt}>
        <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
          <ModalHeader onClose={handleCloseAttempt} onImport={handleImportClick} />

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {importError && (
            <div className="import-error">
              <span className="import-error-icon">⚠</span>
              <span>{importError}</span>
              <button className="import-error-dismiss" onClick={() => setImportError(null)}>×</button>
            </div>
          )}

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
        <button className="config-import-button" onClick={onImport} title="Import configuration from JSON file">
          ↑ Import JSON
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
