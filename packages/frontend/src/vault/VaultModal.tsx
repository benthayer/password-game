import { useEffect, useState } from 'react';
import { getAccountInfo, type AccountInfo } from './vault-api';
import './VaultModal.css';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  addressHash: string | null;
}

export default function VaultModal({ isOpen, onClose, addressHash }: VaultModalProps) {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && addressHash) {
      setLoading(true);
      getAccountInfo(addressHash)
        .then(setInfo)
        .finally(() => setLoading(false));
    }
  }, [isOpen, addressHash]);

  if (!isOpen) return null;

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Vault Info</h2>
        
        {loading && <p>Loading...</p>}
        
        {info && !loading && (
          <div className="vault-info">
            <div className="vault-info-row">
              <span>Credits:</span>
              <span>{info.credits}</span>
            </div>
            <div className="vault-info-row">
              <span>File:</span>
              <span>{info.exists ? `${info.fileSize} bytes` : 'None'}</span>
            </div>
            <div className="vault-verification">
              <span>Address:</span>
              <code>{addressHash}</code>
            </div>
            <div className="vault-verification">
              <span>Payment memo:</span>
              <code>{info.verificationMessage}</code>
            </div>
          </div>
        )}
        
        <button className="vault-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

