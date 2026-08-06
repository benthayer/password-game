/**
 * "Save Config" — the export half of the config I/O pair.
 * Copy a string (preferred) or download a file.
 */

import { useEffect, useRef, useState } from 'react';
import type { GenerationConfig } from '../generation-config';
import { configToString, downloadConfigAsJson, copyToClipboard } from '../config-transfer';
import './ConfigIOModal.css';

interface SaveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  /** Fired once the user has actually saved (copied or downloaded). */
  onSaved?: (() => void) | undefined;
  title?: string;
}

export default function SaveConfigModal({
  isOpen,
  onClose,
  config,
  onSaved,
  title = 'Save Config',
}: SaveConfigModalProps) {
  const [status, setStatus] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) setStatus('');
  }, [isOpen]);

  // Escape always closes — this modal has nothing to lose.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const configString = configToString(config);

  const handleCopy = async () => {
    const ok = await copyToClipboard(configString);
    if (ok) {
      setStatus('Copied to clipboard');
      onSaved?.();
    } else {
      // Clipboard blocked (insecure context, permissions): select it so the
      // user can copy manually rather than leaving them stuck.
      textareaRef.current?.select();
      setStatus('Press Ctrl/Cmd+C to copy the selected text');
    }
  };

  const handleDownload = () => {
    downloadConfigAsJson(config);
    setStatus('File downloaded');
    onSaved?.();
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
            This is everything needed to recover your password — except the password itself.
            It does not need to be private, but you must not lose it.
          </p>

          <label className="config-io-label" htmlFor="config-io-save-text">
            Configuration string
          </label>
          <textarea
            id="config-io-save-text"
            ref={textareaRef}
            className="config-io-textarea readonly"
            value={configString}
            readOnly
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
          />

          <div className="config-io-actions">
            <button className="config-io-primary" onClick={handleCopy}>
              Copy string
            </button>
            <button className="config-io-secondary" onClick={handleDownload}>
              Download file
            </button>
          </div>

          <div className="config-io-status" role="status" aria-live="polite">
            {status}
          </div>

          <p className="config-io-hint">
            The string is the easier one to keep — paste it into your notes or password
            manager. Either form can be pasted back in via Import.
          </p>
        </div>
      </div>
    </div>
  );
}
