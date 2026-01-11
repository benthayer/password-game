import { useState } from 'react';
import VaultModal from './VaultModal';
import ErrorModal from './ErrorModal';
import StatusModal from './StatusModal';
import ConfirmModal from './ConfirmModal';
import { 
  getAddressHash, 
  getSecondaryKey, 
  encryptFile, 
  decryptAndDownload 
} from './vault-crypto-streaming';
import { getBlob, setBlob, deleteBlob } from './vault-api';
import type { FullHashConfig } from '../hash-config';
import { DEFAULT_FULL_HASH_CONFIG } from '../hash-config';
import './VaultCard.css';

interface VaultCardProps {
  password: string[];
  hashConfig?: FullHashConfig;
}

/**
 * Vault card for upload/download operations.
 * 
 * Key optimization: Address hash is computed LAZILY when needed,
 * not on every password change. This avoids running expensive
 * Argon2id (~2.5s) on every word selection.
 */
export default function VaultCard({ 
  password, 
  hashConfig = DEFAULT_FULL_HASH_CONFIG 
}: VaultCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [addressHash, setAddressHash] = useState<string | null>(null);

  const handleUpload = async () => {
    if (password.length === 0) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        setStatusMessage('Computing keys...');
        const [hash, secondaryKey] = await Promise.all([
          getAddressHash(password, hashConfig),
          getSecondaryKey(password, hashConfig),
        ]);
        setAddressHash(hash);
        
        setStatusMessage('Encrypting...');
        const encrypted = await encryptFile(file, password, hashConfig);
        
        setStatusMessage('Uploading...');
        await setBlob(hash, encrypted, secondaryKey);
        setStatusMessage(null);
      } catch (err: unknown) {
        setStatusMessage(null);
        setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      }
    };
    input.click();
  };

  const handleDownload = async () => {
    if (password.length === 0) return;
    
    try {
      setStatusMessage('Computing address...');
      const hash = await getAddressHash(password, hashConfig);
      setAddressHash(hash);
      
      setStatusMessage('Downloading...');
      const data = await getBlob(hash);
      if (!data) {
        setStatusMessage(null);
        setErrorMessage('No file found at this address');
        return;
      }
      
      setStatusMessage('Decrypting...');
      await decryptAndDownload(data, password, hashConfig);
      setStatusMessage(null);
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleInfoClick = async () => {
    if (password.length === 0) return;
    
    try {
      setStatusMessage('Computing address...');
      const hash = await getAddressHash(password, hashConfig);
      setAddressHash(hash);
      setStatusMessage(null);
      setModalOpen(true);
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to compute address');
    }
  };

  const handleDeleteClick = async () => {
    if (password.length === 0) return;
    
    try {
      setStatusMessage('Computing address...');
      const hash = await getAddressHash(password, hashConfig);
      setAddressHash(hash);
      setStatusMessage(null);
      setConfirmDeleteOpen(true);
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to compute address');
    }
  };

  const confirmDelete = async () => {
    if (!addressHash) return;
    setConfirmDeleteOpen(false);
    
    try {
      setStatusMessage('Deleting...');
      await deleteBlob(addressHash);
      setStatusMessage(null);
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (password.length === 0) {
    return null;
  }

  return (
    <>
      <div className="vault-card">
        <button onClick={handleInfoClick} className="vault-button">Info</button>
        <button onClick={handleUpload} className="vault-button">Upload</button>
        <button onClick={handleDownload} className="vault-button">Download</button>
        <button onClick={handleDeleteClick} className="vault-button">Delete</button>
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
      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
        title="Delete Vault File"
        message="Are you sure you want to delete this file? This action cannot be undone."
      />
    </>
  );
}
