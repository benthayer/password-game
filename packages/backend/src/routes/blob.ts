import { Router } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { BlobService } from '../services/blob-service.js';
import { CreditService } from '../services/credit-service.js';

export const blobRoutes = Router();

const blobService = new BlobService();
const creditService = new CreditService();
const upload = multer({ storage: multer.memoryStorage() });

blobRoutes.get('/:addressHash', async (req, res) => {
  const { addressHash } = req.params;
  
  const canDownload = await creditService.canDownload(addressHash);
  if (!canDownload) {
    await blobService.deleteIfExists(addressHash);
    return res.status(402).json({ error: 'Insufficient credits' });
  }
  
  const stream = await blobService.getStream(addressHash);
  if (!stream) {
    return res.status(404).json({ error: 'No file found' });
  }
  
  await creditService.chargeDownload(addressHash);
  res.set('Content-Type', 'application/octet-stream');
  stream.pipe(res);
});

blobRoutes.put('/:addressHash', upload.single('file'), async (req, res) => {
  const { addressHash } = req.params;
  
  const canUpload = await creditService.canUpload(addressHash);
  if (!canUpload) {
    return res.status(402).json({ error: 'Insufficient credits' });
  }
  
  if (await blobService.exists(addressHash)) {
    return res.status(409).json({ error: 'File already exists at this address' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'File required' });
  }
  
  const secondaryKey = req.body.secondaryKey;
  if (!secondaryKey || typeof secondaryKey !== 'string') {
    return res.status(400).json({ error: 'secondaryKey field required' });
  }
  
  try {
    const stream = Readable.from(req.file.buffer);
    const validation = await blobService.upload(addressHash, stream, req.file.size, secondaryKey);
    // Don't send dataToStore buffer in response
    const { dataToStore, ...validationResponse } = validation;
    res.json({ 
      success: true, 
      storedSize: dataToStore?.length ?? 0,
      validation: validationResponse 
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
