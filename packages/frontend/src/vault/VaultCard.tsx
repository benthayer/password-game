import { useState } from 'react';
import VaultModal from './VaultModal';
import ErrorModal from './ErrorModal';
import StatusModal from './StatusModal';
import ConfirmModal from './ConfirmModal';
import TextUploadModal from './TextUploadModal';
import TextDisplayModal from './TextDisplayModal';
import AddCreditsModal from './AddCreditsModal';
import { encryptFile, decryptDownloadedFile } from './vault-crypto-streaming';
import { getBlob, setBlob, deleteBlob, getAccountInfo } from './vault-api';
import { getVaultKeys, hasVaultKeysCached, type VaultKeys } from './vault-keys-cache';
import type { GenerationConfig } from '../generation-config';
import { getHashConfig } from '../generation-config';
import './VaultCard.css';

interface VaultCardProps {
  password: string[];
  fullConfig: GenerationConfig;
}

/**
 * Vault card for upload/download operations.
 * 
 * Key optimization: Vault keys are computed in the background on word selection,
 * so operations are instant when the user clicks. Uses promise-based caching
 * keyed by identity hash.
 */
export default function VaultCard({ 
  password, 
  fullConfig,
}: VaultCardProps) {
  const hashConfig = getHashConfig(fullConfig);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [textUploadModalOpen, setTextUploadModalOpen] = useState(false);
  const [textDisplayModalOpen, setTextDisplayModalOpen] = useState(false);
  const [addCreditsModalOpen, setAddCreditsModalOpen] = useState(false);
  const [accountHasCredits, setAccountHasCredits] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [keys, setKeys] = useState<VaultKeys | null>(null);
  const [lastDecryptedData, setLastDecryptedData] = useState<{ filename: string; mimetype: string; content: Uint8Array } | null>(null);

  const handleUpload = () => {
    if (password.length === 0) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      performUpload({ type: 'file', file });
    };
    input.click();
  };

  const handleUploadText = (text: string) => {
    if (password.length === 0) return;
    setTextUploadModalOpen(false);
    performUpload({ type: 'text', text });
  };

  const performUpload = async (upload: { type: 'file'; file: File } | { type: 'text'; text: string }) => {
    try {
      if (!hasVaultKeysCached(password, fullConfig)) {
        setStatusMessage('Preparing...');
      }
      const keys = await getVaultKeys(password, fullConfig);
      setKeys(keys);

      const file = upload.type === 'file'
        ? upload.file
        : new File([upload.text], 'text.txt', { type: 'text/plain' });

      setStatusMessage('Encrypting...');
      const encrypted = await encryptFile(file, password, hashConfig);

      setStatusMessage('Uploading...');
      await setBlob(keys, encrypted, keys.secondaryKey);
      setStatusMessage(null);
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleDownload = async () => {
    if (password.length === 0) return;
    
    try {
      if (!hasVaultKeysCached(password, fullConfig)) {
        setStatusMessage('Preparing...');
      }
      const keys = await getVaultKeys(password, fullConfig);
      setKeys(keys);
      
      setStatusMessage('Downloading...');
      const data = await getBlob(keys);
      if (!data) {
        setStatusMessage(null);
        setErrorMessage('No file found at this address');
        return;
      }
      
      setStatusMessage('Decrypting...');
      const { metadata, content } = await decryptDownloadedFile(new Uint8Array(data), password, hashConfig);
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
      if (!hasVaultKeysCached(password, fullConfig)) {
        setStatusMessage('Preparing...');
      }
      const keys = await getVaultKeys(password, fullConfig);
      setKeys(keys);
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
      if (!hasVaultKeysCached(password, fullConfig)) {
        setStatusMessage('Preparing...');
      }
      const keys = await getVaultKeys(password, fullConfig);
      setKeys(keys);
      // Skip the acknowledgment flow if the account already has credits
      const info = await getAccountInfo(keys).catch(() => null);
      setAccountHasCredits(!!info && (info.gbYearsRemaining > 0 || info.egressGbRemaining > 0));
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
      if (!hasVaultKeysCached(password, fullConfig)) {
        setStatusMessage('Preparing...');
      }
      const keys = await getVaultKeys(password, fullConfig);
      setKeys(keys);
      setStatusMessage(null);
      setConfirmDeleteOpen(true);
    } catch (err: unknown) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to compute address');
    }
  };

  const confirmDelete = async () => {
    if (!keys) return;
    setConfirmDeleteOpen(false);
    
    try {
      setStatusMessage('Deleting...');
      await deleteBlob(keys);
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
        keys={keys}
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
      {keys && (
        <AddCreditsModal
          isOpen={addCreditsModalOpen}
          onClose={() => setAddCreditsModalOpen(false)}
          address={keys.address}
          authKeys={keys}
          includeSalt={hashConfig.includeSalt}
          fullConfig={fullConfig}
          skipAcknowledgment={accountHasCredits}
        />
      )}
    </>
  );
}
