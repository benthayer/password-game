import { useState, useEffect } from 'react';
import './VaultModal.css';
import './UploadConfirmModal.css';

interface UploadConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  includeSalt: boolean;
}

const ACKNOWLEDGMENTS = [
  "I understand that the password should be private but the configuration can be public and should be accessible to me when I want to download my data",
  "I understand that if I lose the configuration information that my data will be unrecoverable",
  "I understand that if someone has access to my password and configuration information that they will be able to access my data",
  "I understand that anyone can run automated software to attempt to determine my password and that the only defense against this is a longer password",
];

const SALT_WARNING = "I understand that by not using a salt, I am at risk of being a victim in a multi-target attack";

export default function UploadConfirmModal({ 
  isOpen, 
  onConfirm, 
  onCancel,
  includeSalt,
}: UploadConfirmModalProps) {
  const [checked, setChecked] = useState<boolean[]>([]);

  const allAcknowledgments = includeSalt 
    ? ACKNOWLEDGMENTS 
    : [...ACKNOWLEDGMENTS, SALT_WARNING];

  // Reset checkboxes when modal opens
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

  const allChecked = checked.length === allAcknowledgments.length && checked.every(Boolean);

  return (
    <div className="vault-modal-overlay" onClick={onCancel}>
      <div className="vault-modal upload-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Confirm Upload</h2>
        <p className="upload-confirm-intro">
          Please acknowledge that you understand the following before uploading:
        </p>
        
        <div className="upload-confirm-list">
          {allAcknowledgments.map((text, index) => (
            <label 
              key={index} 
              className={`upload-confirm-item ${index >= ACKNOWLEDGMENTS.length ? 'salt-warning' : ''}`}
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

        <div className="vault-modal-buttons">
          <button className="vault-modal-cancel" onClick={onCancel}>Cancel</button>
          <button 
            className="vault-modal-confirm" 
            onClick={onConfirm}
            disabled={!allChecked}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}

