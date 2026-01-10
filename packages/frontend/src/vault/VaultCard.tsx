import { useState, useEffect } from 'react';
import VaultModal from './VaultModal';
import ErrorModal from './ErrorModal';
import StatusModal from './StatusModal';
import { getAddressHash, encrypt, decrypt } from './vault-crypto';
import { getBlob, setBlob } from './vault-api';
import type { FullHashConfig } from '../hash-config';
import { DEFAULT_FULL_HASH_CONFIG } from '../hash-config';
import './VaultCard.css';

interface VaultCardProps {
  password: string[];
  hashConfig?: FullHashConfig;
}

export default function VaultCard({ password, hashConfig = DEFAULT_FULL_HASH_CONFIG }: VaultCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [addressHash, setAddressHash] = useState<string | null>(null);

  // Compute address hash when password or config changes
  useEffect(() => {
    if (password.length === 0) {
      setAddressHash(null);
      return;
    }
    
    let cancelled = false;
    getAddressHash(password, hashConfig).then((hash) => {
      if (!cancelled) {
        setAddressHash(hash);
      }
    });
    
    return () => { cancelled = true; };
  }, [password, hashConfig]);

  const handleUpload = async () => {
    if (!addressHash) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setStatusMessage('Encrypting...');
      const text = await file.text();
      const encrypted = await encrypt(text, password, hashConfig);
      
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
      const decrypted = await decrypt(encrypted, password, hashConfig);
      
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
        <button onClick={handleUpload} className="vault-button" disabled={!addressHash}>Upload</button>
        <button onClick={handleDownload} className="vault-button" disabled={!addressHash}>Download</button>
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
