/**
 * Signature auth middleware.
 *
 * The account address IS an Ed25519 public key (hex). Every protected
 * operation must present a signature over `${ts}:${nonce}`, proving
 * possession of the corresponding secret key — knowing the address alone
 * grants no capabilities, and the server stores no credentials.
 *
 * Replay protection: nonces are single-use within a ±WINDOW_SECONDS
 * timestamp window. Outside the window the timestamp check rejects;
 * inside it the seen-nonce set rejects. The set is in-memory — a restart
 * reopens the window briefly, which is acceptable for this threat model.
 */

import sodium from 'libsodium-wrappers';
import type { Request, Response, NextFunction } from 'express';

const WINDOW_SECONDS = 300;

const ADDRESS_RE = /^[0-9a-f]{64}$/;   // 32-byte Ed25519 pubkey
const TIMESTAMP_RE = /^\d{1,12}$/;     // unix seconds
const NONCE_RE = /^[0-9a-f]{32}$/;     // 16 random bytes
const SIGNATURE_RE = /^[0-9a-f]{128}$/; // 64-byte detached signature

// nonce -> expiry (unix seconds). Bounded in practice by the global rate
// limit (10 req/s * 300s window ≈ 3k entries max).
const seenNonces = new Map<string, number>();

function sweepExpired(now: number): void {
  for (const [nonce, expiry] of seenNonces) {
    if (expiry <= now) seenNonces.delete(nonce);
  }
}

export async function requireSignature(req: Request, res: Response, next: NextFunction) {
  await sodium.ready;

  const address = (req.params.address ?? '').toLowerCase();
  if (!ADDRESS_RE.test(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  const ts = req.header('x-auth-timestamp') ?? '';
  const nonce = (req.header('x-auth-nonce') ?? '').toLowerCase();
  const signature = (req.header('x-auth-signature') ?? '').toLowerCase();
  const now = Math.floor(Date.now() / 1000);

  if (!TIMESTAMP_RE.test(ts) || !NONCE_RE.test(nonce) || !SIGNATURE_RE.test(signature)) {
    return res.status(401).json({ error: 'Missing or malformed auth headers', serverTime: now });
  }

  if (Math.abs(now - Number(ts)) > WINDOW_SECONDS) {
    // Include server time so clients can correct clock skew and retry.
    return res.status(401).json({ error: 'Timestamp outside acceptance window', serverTime: now });
  }

  if (seenNonces.has(nonce)) {
    return res.status(401).json({ error: 'Nonce already used' });
  }

  const valid = sodium.crypto_sign_verify_detached(
    sodium.from_hex(signature),
    `${ts}:${nonce}`,
    sodium.from_hex(address)
  );
  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  sweepExpired(now);
  seenNonces.set(nonce, Number(ts) + WINDOW_SECONDS);
  next();
}
