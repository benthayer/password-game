import './VaultModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

export default function ConfirmModal({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  title, 
  message 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  // No click-outside dismiss - user must explicitly choose
  return (
    <div className="vault-modal-overlay">
      <div className="vault-modal">
        <h2>{title}</h2>
        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>{message}</p>
        <div className="vault-modal-buttons">
          <button className="vault-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="vault-modal-confirm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

