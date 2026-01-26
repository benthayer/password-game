import './VaultModal.css';

interface TextDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  onDownloadAsFile: () => void;
}

export default function TextDisplayModal({ 
  isOpen, 
  onClose, 
  text,
  onDownloadAsFile
}: TextDisplayModalProps) {
  if (!isOpen) return null;

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal text-display-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Stored Text</h2>
        <div className="text-display-content">
          {text}
        </div>
        <div className="vault-modal-buttons">
          <button className="vault-modal-cancel" onClick={onClose}>Close</button>
          <button className="vault-modal-confirm" onClick={onDownloadAsFile}>
            Download as File
          </button>
        </div>
      </div>
    </div>
  );
}



