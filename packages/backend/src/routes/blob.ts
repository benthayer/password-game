import { Router, Request } from 'express';
import { BlobService } from '../services/blob-service.js';
import { CreditService } from '../services/credit-service.js';
import { hasSpaceForUpload } from '../services/disk-space.js';
import { calculateSecretstreamSize } from '../services/encryption-validation.js';
import { getAccount } from '../storage/db.js';

export const blobRoutes = Router();

const blobService = new BlobService();
const creditService = new CreditService();

// =============================================================================
// HELPERS
// =============================================================================

function getContentLength(req: Request): number | null {
  const value = parseInt(req.headers['content-length'] || '', 10);
  return value > 0 ? value : null;
}

function getSecondaryKey(req: Request): string | null {
  const key = req.headers['x-secondary-key'];
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  return null;
}

// =============================================================================
// ROUTES
// =============================================================================

blobRoutes.get('/:addressHash', async (req, res) => {
  const { addressHash } = req.params;
  
  // Get file size from account (stored on upload)
  const account = await getAccount(addressHash);
  const fileSize = account?.fileSize ?? 0;
  
  if (fileSize === 0) {
    return res.status(404).json({ error: 'No file found' });
  }
  
  const canDownload = await creditService.canDownload(addressHash, fileSize);
  if (!canDownload) {
    return res.status(402).json({ error: 'Insufficient egress credits' });
  }
  
  const stream = await blobService.getStream(addressHash);
  if (!stream) {
    return res.status(404).json({ error: 'No file found' });
  }
  
  await creditService.chargeDownload(addressHash, fileSize);
  res.set('Content-Type', 'application/octet-stream');
  stream.pipe(res);
});

/**
 * Upload endpoint - streams directly from request body.
 * 
 * Required headers:
 * - Content-Length: size of the encrypted payload
 * - X-Secondary-Key: hex-encoded secondary encryption key
 */
blobRoutes.put('/:addressHash', async (req, res) => {
  const { addressHash } = req.params;
  
  const canUpload = await creditService.canUpload(addressHash);
  if (!canUpload) {
    return res.status(402).json({ error: 'Insufficient credits' });
  }
  
  if (await blobService.exists(addressHash)) {
    return res.status(409).json({ error: 'File already exists at this address' });
  }
  
  const contentLength = getContentLength(req);
  if (!contentLength) {
    return res.status(400).json({ error: 'Content-Length header required' });
  }
  
  if (!await hasSpaceForUpload(contentLength)) {
    return res.status(507).json({ error: 'Insufficient storage space' });
  }
  
  const secondaryKey = getSecondaryKey(req);
  if (!secondaryKey) {
    return res.status(400).json({ error: 'X-Secondary-Key header required' });
  }
  
  try {
    const validation = await blobService.upload(addressHash, req, contentLength, secondaryKey);
    const storedSize = calculateSecretstreamSize(contentLength);
    res.json({ 
      success: true, 
      storedSize,
      validation
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('VALIDATION_FAILED:')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

blobRoutes.delete('/:addressHash', async (req, res) => {
  const { addressHash } = req.params;
  
  if (!await blobService.exists(addressHash)) {
    return res.status(404).json({ error: 'No file found' });
  }
  
  await blobService.delete(addressHash);
  res.json({ success: true });
});
