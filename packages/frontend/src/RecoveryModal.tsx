/**
 * Recovery modal.
 * Configure grid before starting password recovery.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import { useConfigForm } from './hooks/useConfigForm';
import { parseConfigFromJson, ConfigParseError } from './config-json';
import { CloseConfirmModal } from './shared';
import {
  GridSettingsSection,
  HashSettingsSection,
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
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleRecover = () => {
    setConfig(form.toConfig());
    setSubpassword([]);
    navigate('/recovery');
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
      <div className="recovery-modal-overlay" onClick={handleCloseAttempt}>
        <div className="recovery-modal-content" onClick={(e) => e.stopPropagation()}>
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
              useRecommended={form.useRecommendedHash}
              onUseRecommendedChange={form.setUseRecommendedHash}
              includeSalt={form.includeSalt}
              onIncludeSaltChange={form.setIncludeSalt}
              saltMode="recovery"
              salt={form.salt}
              onSaltChange={form.setSalt}
            />
          </div>

          <ModalFooter onCancel={handleCloseAttempt} onRecover={handleRecover} />
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
// Sub-components
// ============================================================

function ModalHeader({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  return (
    <div className="recovery-modal-header">
      <h2>Recover Password</h2>
      <div className="recovery-modal-header-buttons">
        <button className="recovery-import-button" onClick={onImport} title="Import configuration from JSON file">
          ↑ Import JSON
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
