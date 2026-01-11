import { useState } from 'react';
import VaultModal from './VaultModal';
import ErrorModal from './ErrorModal';
import StatusModal from './StatusModal';
import { getAddressHash, getSecondaryKey, encrypt, decrypt, decryptOuterLayer } from './vault-crypto';
import { getBlob, setBlob } from './vault-api';
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
export default function VaultCard({ password, hashConfig = DEFAULT_FULL_HASH_CONFIG }: VaultCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cachedAddressHash, setCachedAddressHash] = useState<string | null>(null);

  // Compute address hash lazily - only when user triggers an action
  const computeAddressHash = async (): Promise<string> => {
    setStatusMessage('Computing address...');
    const hash = await getAddressHash(password, hashConfig);
    setCachedAddressHash(hash);
    return hash;
  };

  const handleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setStatusMessage('Computing keys...');
      const addressHash = await getAddressHash(password, hashConfig);
      setCachedAddressHash(addressHash);
      const secondaryKeyHex = await getSecondaryKey(password, hashConfig);
      
      setStatusMessage('Encrypting...');
      const text = await file.text();
      // Encrypt with primary key only - server will add outer layer
      const encrypted = await encrypt(text, password, hashConfig);
      
      setStatusMessage('Uploading...');
      try {
        await setBlob(addressHash, new TextEncoder().encode(encrypted), secondaryKeyHex);
        setStatusMessage(null);
      } catch (err: any) {
        setStatusMessage(null);
        setErrorMessage(err.message);
      }
    };
    input.click();
  };

  const handleDownload = async () => {
    setStatusMessage('Computing address...');
    const addressHash = await getAddressHash(password, hashConfig);
    setCachedAddressHash(addressHash);
    
    setStatusMessage('Downloading...');
    try {
      const doublyEncrypted = await getBlob(addressHash);
      if (!doublyEncrypted) {
        setStatusMessage(null);
        setErrorMessage('No file found at this address');
        return;
      }
      
      setStatusMessage('Decrypting...');
      // Strip outer layer (server-added encryption with secondary key)
      const primaryEncrypted = await decryptOuterLayer(
        new Uint8Array(doublyEncrypted), 
        password, 
        hashConfig
      );
      // Decrypt inner layer (our primary encryption)
      const decrypted = await decrypt(primaryEncrypted, password, hashConfig);
      
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

  const handleInfoClick = async () => {
    // Compute address hash when user wants to see info
    await computeAddressHash();
    setModalOpen(true);
    setStatusMessage(null);
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
      </div>
      <VaultModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        addressHash={cachedAddressHash}
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
