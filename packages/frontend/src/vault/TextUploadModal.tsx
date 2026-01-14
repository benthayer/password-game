import { useState, useEffect } from 'react';
import { CloseConfirmModal } from '../shared';
import './VaultModal.css';

interface TextUploadModalProps {
  isOpen: boolean;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export default function TextUploadModal({ 
  isOpen, 
  onConfirm, 
  onCancel 
}: TextUploadModalProps) {
  const [text, setText] = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setShowCloseConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(text);
    setText('');
  };

  const handleCloseAttempt = () => {
    setShowCloseConfirm(true);
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    setText('');
    onCancel();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  return (
    <>
      <div className="vault-modal-overlay" onClick={handleCloseAttempt}>
        <div className="vault-modal text-upload-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Upload Text</h2>
          <textarea
            className="text-upload-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text here..."
            autoFocus
          />
          <div className="vault-modal-buttons">
            <button className="vault-modal-cancel" onClick={handleCloseAttempt}>Cancel</button>
            <button 
              className="vault-modal-confirm" 
              onClick={handleConfirm}
              disabled={text.trim().length === 0}
            >
              Upload
            </button>
          </div>
        </div>
      </div>
      <CloseConfirmModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        message="Are you sure? The text you entered will be lost."
      />
    </>
  );
}

