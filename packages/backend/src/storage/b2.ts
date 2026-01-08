import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// =============================================================================
// CONFIG
// =============================================================================

const KEY_ID = process.env.B2_KEY_ID || process.env.B2_TEST_KEY_ID;
const APP_KEY = process.env.B2_KEY || process.env.B2_TEST_KEY;
const BUCKET_NAME = process.env.B2_BUCKET || process.env.B2_TEST_BUCKET;
const ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';

if (!KEY_ID || !APP_KEY || !BUCKET_NAME) {
  console.warn('B2 credentials not configured. Blob storage will fail.');
}

// =============================================================================
// CLIENT
// =============================================================================

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: 'us-east-005',
  credentials: {
    accessKeyId: KEY_ID!,
    secretAccessKey: APP_KEY!,
  },
});

// =============================================================================
// BLOB OPERATIONS
// =============================================================================

export async function getBlobStream(addressHash: string): Promise<Readable | null> {
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: addressHash,
    }));
    
    return response.Body as Readable;
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function setBlobStream(addressHash: string, stream: Readable, contentLength: number): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: addressHash,
    Body: stream,
    ContentLength: contentLength,
    ContentType: 'application/octet-stream',
  }));
}

export async function deleteBlob(addressHash: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: addressHash,
    }));
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return;
    }
    throw err;
  }
}

export async function blobExists(addressHash: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: addressHash,
    }));
    return true;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

export async function getBlobSize(addressHash: string): Promise<number | null> {
  try {
    const response = await s3.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: addressHash,
    }));
    return response.ContentLength ?? null;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}
