import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createPendingCharge, setPendingChargeId } from '../storage/db.js';

export const paymentRoutes = Router();

const COINBASE_API_KEY = process.env.COINBASE_COMMERCE_API_KEY;
const COINBASE_API_URL = 'https://api.commerce.coinbase.com';

// =============================================================================
// TOKEN GENERATION
// =============================================================================

function generatePaymentToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// =============================================================================
// CREATE CHARGE
// =============================================================================

interface CreateChargeRequest {
  address: string;
  amountUsd: number;
}

interface CoinbaseChargeResponse {
  data: {
    id: string;
    code: string;
    hosted_url: string;
  };
}

async function createCoinbaseCharge(
  token: string,
  amountUsd: number
): Promise<{ chargeUrl: string; chargeId: string; chargeCode: string }> {
  if (!COINBASE_API_KEY) {
    throw new Error('COINBASE_COMMERCE_API_KEY not configured');
  }
  
  const response = await fetch(`${COINBASE_API_URL}/charges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CC-Api-Key': COINBASE_API_KEY,
      'X-CC-Version': '2018-03-22',
    },
    body: JSON.stringify({
      name: 'Password Game Credits',
      description: `${amountUsd} credits for storage`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: amountUsd.toFixed(2),
        currency: 'USD',
      },
      metadata: {
        payment_token: token,  // Random token, not the account address
      },
      redirect_url: 'https://passwordgame.apps.benthayer.com/?payment=success',
      cancel_url: 'https://passwordgame.apps.benthayer.com/?payment=cancelled',
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Coinbase API error:', errorText);
    throw new Error(`Coinbase API error: ${response.status}`);
  }
  
  const data: CoinbaseChargeResponse = await response.json();
  
  return {
    chargeUrl: data.data.hosted_url,
    chargeId: data.data.id,
    chargeCode: data.data.code,
  };
}

// =============================================================================
// ROUTES
// =============================================================================

// POST /payments/create-charge
// Creates a Coinbase Commerce charge for the user to pay
paymentRoutes.post('/create-charge', async (req: Request, res: Response) => {
  try {
    const { address, amountUsd } = req.body as CreateChargeRequest;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'address is required' });
    }
    
    if (!amountUsd || typeof amountUsd !== 'number' || amountUsd <= 0) {
      return res.status(400).json({ error: 'amountUsd must be a positive number' });
    }
    
    // Minimum $1, maximum $100 per transaction
    if (amountUsd < 1 || amountUsd > 100) {
      return res.status(400).json({ error: 'amountUsd must be between 1 and 100' });
    }
    
    // Generate random token for privacy (Coinbase never sees the address)
    const token = generatePaymentToken();
    
    // Store token → address mapping locally
    await createPendingCharge(token, address, amountUsd);
    
    // Create charge with only the token in metadata
    const charge = await createCoinbaseCharge(token, amountUsd);
    
    // Link the charge ID back to our pending charge
    await setPendingChargeId(token, charge.chargeId);
    
    console.log(`Created charge ${charge.chargeId} with token ${token}: $${amountUsd}`);
    
    res.json({
      chargeUrl: charge.chargeUrl,
      chargeId: charge.chargeId,
      chargeCode: charge.chargeCode,
    });
  } catch (error) {
    console.error('Create charge error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

