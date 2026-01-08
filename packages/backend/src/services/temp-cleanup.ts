import { readdir, stat, unlink, mkdir } from 'fs/promises';
import path from 'path';

const TEMP_DIR = process.env.TEMP_DIR || './data/temp';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function cleanupStaleTempFiles(): Promise<void> {
  try {
    await mkdir(TEMP_DIR, { recursive: true });
    const files = await readdir(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.tmp')) continue;
      await deleteIfStale(path.join(TEMP_DIR, file), now);
    }
  } catch (err) {
    console.error('Temp cleanup error:', err);
  }
}

async function deleteIfStale(filePath: string, now: number): Promise<void> {
  try {
    const { mtimeMs } = await stat(filePath);
    if (now - mtimeMs > MAX_AGE_MS) {
      await unlink(filePath);
      console.log(`Cleaned up stale temp file: ${path.basename(filePath)}`);
    }
  } catch {
    // File might have been deleted already
  }
}

export function startTempCleanup(): void {
  cleanupStaleTempFiles();
  setInterval(cleanupStaleTempFiles, INTERVAL_MS);
}

