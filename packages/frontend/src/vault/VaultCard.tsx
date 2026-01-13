import { useState } from 'react';
import VaultModal from './VaultModal';
import ErrorModal from './ErrorModal';
import StatusModal from './StatusModal';
import ConfirmModal from './ConfirmModal';
import TextUploadModal from './TextUploadModal';
import TextDisplayModal from './TextDisplayModal';
import UploadConfirmModal from './UploadConfirmModal';
import AddCreditsModal from './AddCreditsModal';
import { 
  getAddressHash, 
  getSecondaryKey, 
  encryptFile, 
  decryptFile
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
  const [textUploadModalOpen, setTextUploadModalOpen] = useState(false);
  const [textDisplayModalOpen, setTextDisplayModalOpen] = useState(false);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const [addCreditsModalOpen, setAddCreditsModalOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ type: 'file'; file: File } | { type: 'text'; text: string } | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [addressHash, setAddressHash] = useState<string | null>(null);
  const [lastDecryptedData, setLastDecryptedData] = useState<{ filename: string; mimetype: string; content: Uint8Array } | null>(null);

  const handleUpload = () => {
    if (password.length === 0) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setPendingUpload({ type: 'file', file });
      setUploadConfirmOpen(true);
    };
    input.click();
  };

  const handleUploadText = (text: string) => {
    if (password.length === 0) return;
    setTextUploadModalOpen(false);
    setPendingUpload({ type: 'text', text });
    setUploadConfirmOpen(true);
  };

  const handleUploadConfirmed = async () => {
    if (!pendingUpload) return;
    setUploadConfirmOpen(false);
    
    try {
      setStatusMessage('Computing keys...');
      const [hash, secondaryKey] = await Promise.all([
        getAddressHash(password, hashConfig),
        getSecondaryKey(password, hashConfig),
      ]);
      setAddressHash(hash);
      
      const file = pendingUpload.type === 'file' 
        ? pendingUpload.file 
        : new File([pendingUpload.text], 'text.txt', { type: 'text/plain' });
      
      setStatusMessage('Encrypting...');
      const encrypted = await encryptFile(file, password, hashConfig);
      
      setStatusMessage('Uploading...');
      await setBlob(hash, encrypted, secondaryKey);
      setStatusMessage(null);
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPendingUpload(null);
    }
  };

  const handleUploadCancelled = () => {
    setUploadConfirmOpen(false);
    setPendingUpload(null);
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
      const { metadata, content } = await decryptFile(new Uint8Array(data), password, hashConfig);
      setStatusMessage(null);
      
      // If it's plaintext, show in modal
      if (metadata.mimetype === 'text/plain') {
        const text = new TextDecoder().decode(content);
        setDisplayedText(text);
        setLastDecryptedData({ filename: metadata.filename, mimetype: metadata.mimetype, content });
        setTextDisplayModalOpen(true);
      } else {
        // For other file types, trigger download
        triggerFileDownload(metadata.filename, metadata.mimetype, content);
      }
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const triggerFileDownload = (filename: string, mimetype: string, content: Uint8Array) => {
    const blob = new Blob([content as BlobPart], { type: mimetype });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAsFile = () => {
    if (!lastDecryptedData) return;
    triggerFileDownload(lastDecryptedData.filename, lastDecryptedData.mimetype, lastDecryptedData.content);
    setTextDisplayModalOpen(false);
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

  const handleAddCreditsClick = async () => {
    if (password.length === 0) return;
    
    try {
      setStatusMessage('Computing address...');
      const hash = await getAddressHash(password, hashConfig);
      setAddressHash(hash);
      setStatusMessage(null);
      setAddCreditsModalOpen(true);
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
        <button onClick={handleAddCreditsClick} className="vault-button">Add Credits</button>
        <button onClick={handleUpload} className="vault-button">Upload File</button>
        <button onClick={() => setTextUploadModalOpen(true)} className="vault-button">Upload Text</button>
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
      <TextUploadModal
        isOpen={textUploadModalOpen}
        onConfirm={handleUploadText}
        onCancel={() => setTextUploadModalOpen(false)}
      />
      <TextDisplayModal
        isOpen={textDisplayModalOpen}
        onClose={() => setTextDisplayModalOpen(false)}
        text={displayedText}
        onDownloadAsFile={handleDownloadAsFile}
      />
      <UploadConfirmModal
        isOpen={uploadConfirmOpen}
        onConfirm={handleUploadConfirmed}
        onCancel={handleUploadCancelled}
        includeSalt={hashConfig.includeSalt}
      />
      {addressHash && (
        <AddCreditsModal
          isOpen={addCreditsModalOpen}
          onClose={() => setAddCreditsModalOpen(false)}
          addressHash={addressHash}
        />
      )}
    </>
  );
}
