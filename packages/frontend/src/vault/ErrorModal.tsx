import './VaultModal.css';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

export default function ErrorModal({ isOpen, onClose, message }: ErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Error</h2>
        <p style={{ color: '#ef4444', marginBottom: '20px' }}>{message}</p>
        <button className="vault-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}



