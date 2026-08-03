import sodium from 'libsodium-wrappers';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TIMESTAMP_HEADER = 'X-Auth-Timestamp';
const NONCE_HEADER = 'X-Auth-Nonce';
const SIGNATURE_HEADER = 'X-Auth-Signature';

/** The subset of vault keys needed to authenticate a request. */
export interface AuthKeys {
  address: string;
  signingSecretKeyHex: string;
}

// Correction applied to the local clock when the server reports our
// timestamp is outside its acceptance window. Learned from 401 responses.
let clockOffsetSeconds = 0;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000) + clockOffsetSeconds;
}

/**
 * Build signed auth headers: an Ed25519 signature over `${ts}:${nonce}`.
 * The nonce is single-use server-side; the timestamp bounds its lifetime.
 */
async function authHeaders(keys: AuthKeys): Promise<Record<string, string>> {
  await sodium.ready;
  const ts = String(nowSeconds());
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = sodium.to_hex(nonceBytes);
  const signature = sodium.crypto_sign_detached(
    `${ts}:${nonce}`,
    sodium.from_hex(keys.signingSecretKeyHex)
  );
  return {
    [TIMESTAMP_HEADER]: ts,
    [NONCE_HEADER]: nonce,
    [SIGNATURE_HEADER]: sodium.to_hex(signature),
  };
}

/**
 * Fetch with signed auth headers. If the server rejects our timestamp,
 * it returns its own time in the 401 body — adopt the offset and retry once.
 */
async function signedFetch(
  path: string,
  keys: AuthKeys,
  init: RequestInit = {}
): Promise<Response> {
  const doFetch = async () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), ...(await authHeaders(keys)) },
    });

  const res = await doFetch();
  if (res.status !== 401) return res;

  const body = await res.clone().json().catch(() => null);
  if (typeof body?.serverTime !== 'number') return res;

  clockOffsetSeconds = body.serverTime - Math.floor(Date.now() / 1000);
  return doFetch();
}

export interface AccountInfo {
  gbYearsRemaining: number;
  egressGbRemaining: number;
  fileSize: number | null;
  exists: boolean;
  verificationMessage: string;
}

export async function getAccountInfo(keys: AuthKeys): Promise<AccountInfo> {
  const res = await signedFetch(`/account/${keys.address}`, keys);
  return res.json();
}

export async function getBlob(keys: AuthKeys): Promise<ArrayBuffer | null> {
  const res = await signedFetch(`/blob/${keys.address}`, keys);
  if (res.status === 404) return null;
  if (res.status === 402) throw new Error('Insufficient credits');
  return res.arrayBuffer();
}

export async function setBlob(
  keys: AuthKeys,
  data: Uint8Array,
  secondaryKeyHex: string
): Promise<void> {
  const res = await signedFetch(`/blob/${keys.address}`, keys, {
    method: 'PUT',
    body: new Blob([data as BlobPart], { type: 'application/octet-stream' }),
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Secondary-Key': secondaryKeyHex,
    },
  });
  if (res.status === 402) throw new Error('Insufficient credits');
  if (res.status === 409) throw new Error('File already exists');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Upload failed');
  }
}

export async function deleteBlob(keys: AuthKeys): Promise<void> {
  const res = await signedFetch(`/blob/${keys.address}`, keys, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Delete failed');
}

export interface RedeemResult {
  credits: number;
  gbYearsRemaining: number;
  egressGbRemaining: number;
}

/**
 * Redeem a coupon token into this account. Signed like every other account
 * operation, so holding a token isn't enough to decide whose balance it lands in.
 */
export async function redeemCoupon(keys: AuthKeys, token: string): Promise<RedeemResult> {
  const res = await signedFetch(`/coupon/redeem/${keys.address}`, keys, {
    method: 'POST',
    body: JSON.stringify({ token }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not redeem that token');
  }
  return res.json();
}
