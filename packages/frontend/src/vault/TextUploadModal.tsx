import { useState } from 'react';
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

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(text);
    setText('');
  };

  const handleCancel = () => {
    setText('');
    onCancel();
  };

  return (
    <div className="vault-modal-overlay" onClick={handleCancel}>
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
          <button className="vault-modal-cancel" onClick={handleCancel}>Cancel</button>
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
  );
}

