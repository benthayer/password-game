import './VaultModal.css';

interface StatusModalProps {
  isOpen: boolean;
  message: string;
}

export default function StatusModal({ isOpen, message }: StatusModalProps) {
  if (!isOpen) return null;

  return (
    <div className="vault-modal-overlay">
      <div className="vault-modal" style={{ textAlign: 'center' }}>
        <div className="status-spinner" />
        <p style={{ marginTop: '16px', color: '#1a1a2e', fontSize: '1.1rem' }}>{message}</p>
      </div>
    </div>
  );
}

