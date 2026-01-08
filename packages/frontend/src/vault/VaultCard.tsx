import { useState } from 'react';
import VaultModal from './VaultModal';
import ErrorModal from './ErrorModal';
import StatusModal from './StatusModal';
import { getAddressHash, encrypt, decrypt } from './vault-crypto';
import { getBlob, setBlob } from './vault-api';
import './VaultCard.css';

interface VaultCardProps {
  password: string[];
}

export default function VaultCard({ password }: VaultCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const addressHash = password.length > 0 ? getAddressHash(password) : null;

  const handleUpload = async () => {
    if (!addressHash) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setStatusMessage('Encrypting...');
      const text = await file.text();
      const encrypted = encrypt(text, password);
      
      setStatusMessage('Uploading...');
      try {
        await setBlob(addressHash, new TextEncoder().encode(encrypted));
        setStatusMessage(null);
      } catch (err: any) {
        setStatusMessage(null);
        setErrorMessage(err.message);
      }
    };
    input.click();
  };

  const handleDownload = async () => {
    if (!addressHash) return;
    
    setStatusMessage('Downloading...');
    try {
      const data = await getBlob(addressHash);
      if (!data) {
        setStatusMessage(null);
        setErrorMessage('No file found at this address');
        return;
      }
      
      setStatusMessage('Decrypting...');
      const encrypted = new TextDecoder().decode(data);
      const decrypted = decrypt(encrypted, password);
      
      const blob = new Blob([decrypted], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vault-file.txt';
      a.click();
      URL.revokeObjectURL(url);
      
      setStatusMessage(null);
    } catch (err: any) {
      setStatusMessage(null);
      setErrorMessage(err.message);
    }
  };

  if (password.length === 0) {
    return null;
  }

  return (
    <>
      <div className="vault-card">
        <button onClick={() => setModalOpen(true)} className="vault-button">Info</button>
        <button onClick={handleUpload} className="vault-button">Upload</button>
        <button onClick={handleDownload} className="vault-button">Download</button>
      </div>
      <VaultModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        addressHash={addressHash}
      />
      <ErrorModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        message={errorMessage || ''}
      />
      <StatusModal
        isOpen={!!statusMessage}
        message={statusMessage || ''}
      />
    </>
  );
}
