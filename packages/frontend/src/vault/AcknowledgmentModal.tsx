import { useState, useEffect } from 'react';
import type { GenerationConfig } from '../generation-config';
import { downloadConfigAsJson } from '../config-json';
import { CloseConfirmModal } from '../shared';
import './VaultModal.css';
import './AcknowledgmentModal.css';

type Stage = 'password' | 'config' | 'acknowledgments';

const ACKNOWLEDGMENTS = [
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
  const [stage, setStage] = useState<Stage>('password');
  const [passwordConfirmed, setPasswordConfirmed] = useState(false);
  const [configConfirmed, setConfigConfirmed] = useState(false);
  const [acknowledgmentChecks, setAcknowledgmentChecks] = useState<boolean[]>([]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const allAcknowledgments = includeSalt 
    ? ACKNOWLEDGMENTS 
    : [...ACKNOWLEDGMENTS, SALT_WARNING];

  useEffect(() => {
    if (isOpen) {
      setStage('password');
      setPasswordConfirmed(false);
      setConfigConfirmed(false);
      setAcknowledgmentChecks(new Array(allAcknowledgments.length).fill(false));
      setShowCloseConfirm(false);
    }
  }, [isOpen, allAcknowledgments.length]);

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

  const handleDownload = () => {
    if (fullConfig) {
      downloadConfigAsJson(fullConfig);
    }
  };

  const toggleAcknowledgment = (index: number) => {
    setAcknowledgmentChecks(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const allAcknowledged = acknowledgmentChecks.length === allAcknowledgments.length 
    && acknowledgmentChecks.every(Boolean);

  // Step 1: Password confirmation
  if (stage === 'password') {
    return (
      <>
        <div className="vault-modal-overlay" onClick={handleCloseAttempt}>
          <div className="vault-modal acknowledgment-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-x" onClick={handleCloseAttempt} aria-label="Close">×</button>
            <h2>{title}</h2>
            <div className="acknowledgment-stage-content">
              <div className="acknowledgment-checkbox-item">
                <input
                  type="checkbox"
                  checked={passwordConfirmed}
                  onChange={() => setPasswordConfirmed(!passwordConfirmed)}
                />
                <span>I have memorized my password</span>
              </div>
            </div>
            <div className="vault-modal-buttons single-button">
              <button 
                className="vault-modal-confirm"
                onClick={() => setStage('config')}
                disabled={!passwordConfirmed}
              >
                Continue
              </button>
            </div>
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

  // Step 2: Config confirmation
  if (stage === 'config') {
    return (
      <>
        <div className="vault-modal-overlay" onClick={handleCloseAttempt}>
          <div className="vault-modal acknowledgment-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-x" onClick={handleCloseAttempt} aria-label="Close">×</button>
            <h2>{title}</h2>
            <div className="acknowledgment-stage-content">
              <div className="acknowledgment-checkbox-item">
                <input
                  type="checkbox"
                  checked={configConfirmed}
                  onChange={() => setConfigConfirmed(!configConfirmed)}
                />
                <span>I have downloaded or written down my configuration and will be able to easily access it when I need to recover</span>
              </div>
            </div>
            {fullConfig && (
              <button className="acknowledgment-download-button" onClick={handleDownload}>
                Download Configuration (JSON)
              </button>
            )}
            <div className="vault-modal-buttons">
              <button className="vault-modal-cancel" onClick={() => setStage('password')}>
                Back
              </button>
              <button 
                className="vault-modal-confirm"
                onClick={() => setStage('acknowledgments')}
                disabled={!configConfirmed}
              >
                Continue
              </button>
            </div>
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

  // Step 3: Final acknowledgments
  return (
    <>
      <div className="vault-modal-overlay" onClick={handleCloseAttempt}>
        <div className="vault-modal acknowledgment-modal acknowledgments-stage" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-x" onClick={handleCloseAttempt} aria-label="Close">×</button>
          <h2>{title}</h2>
          <div className="acknowledgment-list">
            {allAcknowledgments.map((text, index) => (
              <div 
                key={index} 
                className={`acknowledgment-item ${index >= ACKNOWLEDGMENTS.length ? 'salt-warning' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={acknowledgmentChecks[index] || false}
                  onChange={() => toggleAcknowledgment(index)}
                />
                <span>{text}</span>
              </div>
            ))}
          </div>
          <div className="vault-modal-buttons">
            <button className="vault-modal-cancel" onClick={() => setStage('config')}>
              Back
            </button>
            <button 
              className="vault-modal-confirm"
              onClick={onConfirm}
              disabled={!allAcknowledged}
            >
              {confirmText}
            </button>
          </div>
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
