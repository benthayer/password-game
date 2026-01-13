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

  useEffect(() => {
    if (isOpen && addressHash) {
      setInfo(null); // Clear immediately so loading shows on first render
      getAccountInfo(addressHash).then(setInfo);
    }
  }, [isOpen, addressHash]);

  if (!isOpen) return null;

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Vault Info</h2>
        
        {!info && <p>Loading...</p>}
        
        {info && (
          <div className="vault-info">
            <div className="vault-info-row">
              <span>Storage:</span>
              <span>{info.gbYearsRemaining.toFixed(2)} GB-years</span>
            </div>
            <div className="vault-info-row">
              <span>Egress:</span>
              <span>{info.egressGbRemaining.toFixed(2)} GB</span>
            </div>
            <div className="vault-info-row">
              <span>File:</span>
              <span>{info.exists ? `${info.fileSize} bytes` : 'None'}</span>
            </div>
            <div className="vault-verification">
              <span>Address:</span>
              <code>{addressHash}</code>
            </div>
          </div>
        )}
        
        <button className="vault-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

