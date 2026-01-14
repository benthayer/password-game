import { useState, useEffect } from 'react';
import type { GenerationConfig } from '../generation-config';
import { downloadConfigAsJson } from '../config-json';
import './VaultModal.css';
import './AcknowledgmentModal.css';

const ACKNOWLEDGMENTS = [
  "I have written down my configuration information",
  "I have memorized my password",
  "I understand that the password should be private but the configuration can be public and should be accessible to me when I want to download my data",
  "I understand that if I lose the configuration information or forget my password that my data will be unrecoverable",
  "I understand that my payment only applies to this password and configuration and cannot be transferred, even if I forget my password or lose my configuration information",
  "I understand that if someone has access to my password and configuration information that they will be able to access my data",
  "I understand that anyone can run automated software to attempt to determine my password and that the only defense against this is a longer password",
];

const SALT_WARNING = "I understand that by not using a salt, I am at risk of being a victim in a multi-target attack";

interface AcknowledgmentModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
  includeSalt: boolean;
  title?: string;
  confirmText?: string;
  fullConfig?: GenerationConfig;
}

export default function AcknowledgmentModal({ 
  isOpen, 
  onConfirm, 
  onClose,
  includeSalt,
  title = "Confirm",
  confirmText = "Continue",
  fullConfig,
}: AcknowledgmentModalProps) {
  const [checked, setChecked] = useState<boolean[]>([]);

  const allAcknowledgments = includeSalt 
    ? ACKNOWLEDGMENTS 
    : [...ACKNOWLEDGMENTS, SALT_WARNING];

  useEffect(() => {
    if (isOpen) {
      setChecked(new Array(allAcknowledgments.length).fill(false));
    }
  }, [isOpen, allAcknowledgments.length]);

  if (!isOpen) return null;

  const toggleCheckbox = (index: number) => {
    setChecked(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleDownloadConfig = () => {
    if (fullConfig) {
      downloadConfigAsJson(fullConfig);
    }
  };

  const allChecked = checked.length === allAcknowledgments.length && checked.every(Boolean);

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal acknowledgment-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{title}</h2>
        <p className="acknowledgment-intro">
          Please acknowledge that you understand the following:
        </p>
        
        <div className="acknowledgment-list">
          {allAcknowledgments.map((text, index) => (
            <label 
              key={index} 
              className={`acknowledgment-item ${index >= ACKNOWLEDGMENTS.length ? 'salt-warning' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked[index] || false}
                onChange={() => toggleCheckbox(index)}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>

        {fullConfig && (
          <button className="acknowledgment-download-button" onClick={handleDownloadConfig}>
            Download Configuration (JSON)
          </button>
        )}

        <div className="vault-modal-buttons single-button">
          <button 
            className="vault-modal-confirm" 
            onClick={onConfirm}
            disabled={!allChecked}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

