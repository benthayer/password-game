import { statfs } from 'fs/promises';

const MIN_RESERVED_BYTES = 75 * 1024 * 1024; // 75 MB
const DATA_PATH = './data';

export async function getAvailableUploadSpace(): Promise<number> {
  const stats = await statfs(DATA_PATH);
  const available = stats.bavail * stats.bsize;
  return Math.max(0, available - MIN_RESERVED_BYTES);
}

export async function hasSpaceForUpload(contentLength: number): Promise<boolean> {
  const available = await getAvailableUploadSpace();
  return contentLength <= available;
}



