import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { 
  getPaymentByChargeId, 
  recordPayment, 
  updatePaymentStatus,
  addCredits,
  getPendingChargeByChargeId,
  deletePendingCharge,
} from '../storage/db.js';

export const stripeWebhookRoutes = Router();

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

function verifyStripeSignature(payload: string, signatureHeader: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return false;
  }
  
  // Parse the signature header
  const elements = signatureHeader.split(',');
  let timestamp: string | null = null;
  let signature: string | null = null;
  
  for (const element of elements) {
    const [key, value] = element.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }
  
  if (!timestamp || !signature) {
    console.error('Invalid Stripe signature header format');
    return false;
  }
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// =============================================================================
// CREDIT CALCULATION
// =============================================================================

function calculateCreditsFromUsd(amountUsd: number): number {
  return Math.floor(amountUsd); // 1 credit per dollar
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

interface StripeCheckoutSession {
  id: string;
  object: string;
  amount_total: number; // in cents
  currency: string;
  payment_status: string;
  metadata: {
    payment_token?: string;
  };
}

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession;
  };
}

stripeWebhookRoutes.post('/stripe', async (req: Request, res: Response) => {
  try {
    const signatureHeader = req.headers['stripe-signature'] as string;
    
    if (!signatureHeader) {
      console.error('Missing Stripe signature');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    // req.body is raw buffer/string because of express.raw() middleware
    const rawBody = Buffer.isBuffer(req.body) 
      ? req.body.toString('utf8') 
      : typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);
    
    if (!verifyStripeSignature(rawBody, signatureHeader)) {
      console.error('Invalid Stripe signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const event: StripeWebhookEvent = JSON.parse(rawBody);
    
    console.log(`Received Stripe webhook: ${event.type}`);
    
    if (event.type !== 'checkout.session.completed') {
      // Acknowledge other events but don't process
      return res.json({ received: true });
    }
    
    const session = event.data.object;
    const sessionId = session.id;
    const paymentToken = session.metadata?.payment_token;
    const amountUsd = (session.amount_total || 0) / 100; // Convert cents to dollars
    
    // Look up addressHash from token
    let addressHash: string | undefined;
    if (paymentToken) {
      const pendingCharge = await getPendingChargeByChargeId(sessionId);
      if (pendingCharge) {
        addressHash = pendingCharge.addressHash;
      }
    }
    
    // Check if already processed
    const existingPayment = await getPaymentByChargeId(sessionId);
    
    if (existingPayment) {
      console.log(`Stripe session ${sessionId} already processed`);
      return res.json({ received: true });
    }
    
    // Record payment and grant credits
    const creditsToGrant = calculateCreditsFromUsd(amountUsd);
    
    await recordPayment({
      chargeId: sessionId,
      chargeCode: null,
      amountUsdc: amountUsd, // Reusing field for USD amount
      chain: 'stripe',
      txHash: null,
      senderAddress: null,
      status: 'confirmed',
      accountAddressHash: addressHash,
      creditsGranted: creditsToGrant,
      rawWebhookPayload: rawBody,
    });
    
    if (addressHash && creditsToGrant > 0) {
      await addCredits(addressHash, creditsToGrant);
      console.log(`Granted ${creditsToGrant} credits to ${addressHash} via Stripe`);
    }
    
    // Clean up pending charge
    if (paymentToken) {
      await deletePendingCharge(paymentToken);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

