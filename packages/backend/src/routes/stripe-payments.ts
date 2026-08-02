import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createPendingCharge, setPendingChargeId } from '../storage/db.js';

export const stripePaymentRoutes = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_API_URL = 'https://api.stripe.com/v1';

// =============================================================================
// TOKEN GENERATION
// =============================================================================

function generatePaymentToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// =============================================================================
// CREATE CHECKOUT SESSION
// =============================================================================

interface CreateChargeRequest {
  address: string;
  amountUsd: number;
}

async function createStripeCheckoutSession(
  token: string,
  amountUsd: number
): Promise<{ sessionUrl: string; sessionId: string }> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  
  const params = new URLSearchParams({
    'mode': 'payment',
    'success_url': 'https://passwordgame.apps.benthayer.com/?payment=success',
    'cancel_url': 'https://passwordgame.apps.benthayer.com/?payment=cancelled',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': 'Password Game Credits',
    'line_items[0][price_data][product_data][description]': `${amountUsd} credits for storage`,
    'line_items[0][price_data][unit_amount]': String(amountUsd * 100), // Stripe uses cents
    'line_items[0][quantity]': '1',
    'metadata[payment_token]': token,
  });
  
  const response = await fetch(`${STRIPE_API_URL}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Stripe API error:', errorText);
    throw new Error(`Stripe API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    sessionUrl: data.url,
    sessionId: data.id,
  };
}

// =============================================================================
// ROUTES
// =============================================================================

// POST /stripe/create-checkout
// Creates a Stripe Checkout Session for the user to pay
stripePaymentRoutes.post('/create-checkout', async (req: Request, res: Response) => {
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
    
    // Generate random token for privacy (Stripe never sees the address)
    const token = generatePaymentToken();
    
    // Store token → address mapping locally
    await createPendingCharge(token, address, amountUsd);
    
    // Create checkout session with only the token in metadata
    const session = await createStripeCheckoutSession(token, amountUsd);
    
    // Link the session ID back to our pending charge
    await setPendingChargeId(token, session.sessionId);
    
    console.log(`Created Stripe session ${session.sessionId} with token ${token}: $${amountUsd}`);
    
    res.json({
      checkoutUrl: session.sessionUrl,
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error('Create Stripe checkout error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});



