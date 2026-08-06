/**
 * "Import" — the import half of the config I/O pair.
 * Paste a string (either representation) or upload a file.
 */

import { useEffect, useRef, useState } from 'react';
import type { GenerationConfig } from '../generation-config';
import { parseConfigText, parseConfigFile, ConfigImportError } from '../config-transfer';
import './ConfigIOModal.css';

interface ImportConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (config: GenerationConfig) => void;
  title?: string;
}

export default function ImportConfigModal({
  isOpen,
  onClose,
  onImport,
  title = 'Import Config',
}: ImportConfigModalProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accept = (config: GenerationConfig) => {
    onImport(config);
    onClose();
  };

  const handlePasteImport = () => {
    try {
      setError(null);
      accept(parseConfigText(text));
    } catch (err) {
      setError(err instanceof ConfigImportError ? err.message : 'Could not read that configuration');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      accept(await parseConfigFile(file));
    } catch (err) {
      setError(err instanceof ConfigImportError ? err.message : 'Could not read that file');
    }
    // Reset so the same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="config-io-overlay" onClick={onClose}>
      <div
        className="config-io-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="config-io-header">
          <h2>{title}</h2>
          <button className="config-io-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="config-io-body">
          <p className="config-io-intro">
            Paste your configuration string, or upload a config file you saved earlier.
          </p>

          <label className="config-io-label" htmlFor="config-io-import-text">
            Configuration string
          </label>
          <textarea
            id="config-io-import-text"
            className="config-io-textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="v2:my seed:4x4:argon2id:65536:3:1:salt"
            rows={3}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />

          <div className="config-io-actions">
            <button className="config-io-primary" onClick={handlePasteImport} disabled={!text.trim()}>
              Import string
            </button>
          </div>

          <div className="config-io-divider">or</div>

          <div className="config-io-actions">
            <button className="config-io-secondary" onClick={() => fileInputRef.current?.click()}>
              Upload file
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {error && (
            <div className="config-io-error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <p className="config-io-hint">
            Older config files still work — they are upgraded automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
