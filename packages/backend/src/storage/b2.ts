import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// =============================================================================
// CONFIG (lazy-loaded to allow dotenv to run first)
// =============================================================================

function getConfig() {
  const KEY_ID = process.env.B2_KEY_ID || process.env.B2_TEST_KEY_ID;
  const APP_KEY = process.env.B2_KEY || process.env.B2_TEST_KEY;
  const BUCKET_NAME = process.env.B2_BUCKET || process.env.B2_TEST_BUCKET;
  const ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
  
  if (!KEY_ID || !APP_KEY || !BUCKET_NAME) {
    throw new Error('B2 credentials not configured (B2_KEY_ID, B2_KEY, B2_BUCKET)');
  }
  
  return { KEY_ID, APP_KEY, BUCKET_NAME, ENDPOINT };
}

// =============================================================================
// CLIENT (lazy initialization)
// =============================================================================

let s3Client: S3Client | null = null;
let bucketName: string | null = null;

function getS3() {
  if (!s3Client) {
    const config = getConfig();
    bucketName = config.BUCKET_NAME;
    s3Client = new S3Client({
      endpoint: config.ENDPOINT,
      region: 'us-east-005',
      credentials: {
        accessKeyId: config.KEY_ID,
        secretAccessKey: config.APP_KEY,
      },
    });
  }
  return { s3: s3Client, bucket: bucketName! };
}

// =============================================================================
// BLOB OPERATIONS
// =============================================================================

export async function getBlobStream(addressHash: string): Promise<Readable | null> {
  const { s3, bucket } = getS3();
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: bucket,
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
  const { s3, bucket } = getS3();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: addressHash,
    Body: stream,
    ContentLength: contentLength,
    ContentType: 'application/octet-stream',
  }));
}

export async function deleteBlob(addressHash: string): Promise<void> {
  const { s3, bucket } = getS3();
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: bucket,
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
  const { s3, bucket } = getS3();
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: bucket,
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
  const { s3, bucket } = getS3();
  try {
    const response = await s3.send(new HeadObjectCommand({
      Bucket: bucket,
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
