/**
 * Public coupon endpoints. Unauthenticated by design — minting a token needs no
 * account, since the token can be handed to someone else to redeem.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface CouponGates {
  mintOpen: boolean;
  redeemOpen: boolean;
}

export async function getCouponGates(): Promise<CouponGates> {
  const res = await fetch(`${API_URL}/coupon/status`);
  if (!res.ok) throw new Error('Could not reach the server');
  return res.json();
}

export interface MintedToken {
  token: string;
  credits: number;
}

export async function mintCouponToken(code: string): Promise<MintedToken> {
  const res = await fetch(`${API_URL}/coupon/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not mint a token');
  }
  return res.json();
}
