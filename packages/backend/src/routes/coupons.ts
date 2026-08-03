import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireSignature } from '../auth.js';
import {
  CouponError,
  type CouponErrorCode,
  allGates,
  mintFromCoupon,
  redeemToken,
} from '../services/coupon-service.js';

export const couponRoutes = Router();

// Per-IP so one actor can't drain the global mint budget alone. In memory only —
// never written to disk, which keeps it consistent with the project's no-logs
// posture while still bounding a single client.
const mintLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  message: { error: 'Too many attempts, try again shortly' },
});

const STATUS_BY_CODE: Record<CouponErrorCode, number> = {
  coupon_gate_closed: 503,
  redemption_gate_closed: 503,
  invalid_code: 400,
  limit_exceeded: 429,
  invalid_token: 400,
  token_already_used: 409,
  token_revoked: 403,
  bad_request: 400,
};

/**
 * Only `message` ever reaches the client. `detail` explains which rule blocked a
 * mint, or that a coupon exists but is inert — both of which would leak whether a
 * guessed code is real, so they stay server-side.
 */
function sendCouponError(res: Response, err: unknown): void {
  if (err instanceof CouponError) {
    if (err.detail) console.log(`[coupon] ${err.code}: ${err.detail}`);
    res.status(STATUS_BY_CODE[err.code]).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[coupon] unexpected error', err);
  res.status(500).json({ error: 'Something went wrong' });
}

// GET /coupon/status - is minting/redemption open? Reveals no coupon codes.
couponRoutes.get('/status', (req, res) => {
  const gates = allGates();
  res.json({ mintOpen: gates.coupon, redeemOpen: gates.redemption });
});

// POST /coupon/mint - exchange a coupon code for a single-use token.
couponRoutes.post('/mint', mintLimiter, (req: Request, res: Response) => {
  const { code } = req.body ?? {};
  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'That code is not valid', code: 'invalid_code' });
  }

  try {
    const minted = mintFromCoupon(code);
    res.json({ token: minted.token, credits: minted.credits });
  } catch (err) {
    sendCouponError(res, err);
  }
});

// POST /coupon/redeem/:address - credit an account from a token.
// Signed like every other account operation: the token alone shouldn't let a
// third party decide whose balance it lands in.
couponRoutes.post('/redeem/:address', requireSignature, async (req: Request, res: Response) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'That token is not valid', code: 'invalid_token' });
  }

  try {
    const result = await redeemToken(token, req.params.address.toLowerCase());
    res.json({
      credits: result.credits,
      gbYearsRemaining: result.gbYearsRemaining,
      egressGbRemaining: result.egressGbRemaining,
    });
  } catch (err) {
    sendCouponError(res, err);
  }
});
