const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface AccountInfo {
  credits: number;
  fileSize: number | null;
  exists: boolean;
  verificationMessage: string;
}

export async function getAccountInfo(addressHash: string): Promise<AccountInfo> {
  const res = await fetch(`${API_URL}/account/${addressHash}`);
  return res.json();
}

export async function getBlob(addressHash: string): Promise<ArrayBuffer | null> {
  const res = await fetch(`${API_URL}/blob/${addressHash}`);
  if (res.status === 404) return null;
  if (res.status === 402) throw new Error('Insufficient credits');
  return res.arrayBuffer();
}

export async function setBlob(addressHash: string, data: Uint8Array): Promise<void> {
  // Create a proper Blob from the data
  const blob = new Blob([data], { type: 'application/octet-stream' });
  
  const res = await fetch(`${API_URL}/blob/${addressHash}`, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  });
  if (res.status === 409) throw new Error('File already exists');
  if (!res.ok) throw new Error('Upload failed');
}

export async function deleteBlob(addressHash: string): Promise<void> {
  const res = await fetch(`${API_URL}/blob/${addressHash}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Delete failed');
}

