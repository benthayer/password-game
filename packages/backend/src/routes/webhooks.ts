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

export const webhookRoutes = Router();

const WEBHOOK_SECRET = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('COINBASE_COMMERCE_WEBHOOK_SECRET not configured');
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// =============================================================================
// CREDIT CALCULATION
// =============================================================================

// $1 = 1 gigabyte-year + 50 GB egress
// For now, we just track as "credits" where 1 credit = $1 worth
function calculateCreditsFromUsdc(amountUsdc: number): number {
  return Math.floor(amountUsdc); // 1 credit per dollar
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

interface CoinbaseWebhookEvent {
  id: string;
  type: string;
  data: {
    id: string;
    code: string;
    pricing: {
      local: { amount: string; currency: string };
    };
    payments: Array<{
      network: string;
      transaction_id: string;
      value: { local: { amount: string } };
      payer_addresses: string[];
    }>;
    metadata?: {
      payment_token?: string;  // Random token, not addressHash
    };
  };
}

webhookRoutes.post('/coinbase', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-cc-webhook-signature'] as string;
    
    if (!signature) {
      console.error('Missing webhook signature');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    // req.body is raw string because of express.raw() middleware
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const event: CoinbaseWebhookEvent = typeof req.body === 'string' 
      ? JSON.parse(req.body) 
      : req.body;
    
    console.log(`Received Coinbase webhook: ${event.type} for charge ${event.data.id}`);
    
    const chargeId = event.data.id;
    const chargeCode = event.data.code;
    const paymentToken = event.data.metadata?.payment_token;
    
    // Look up addressHash from token (for privacy, Coinbase only sees token)
    let addressHash: string | undefined;
    if (paymentToken) {
      const pendingCharge = await getPendingChargeByChargeId(chargeId);
      if (pendingCharge) {
        addressHash = pendingCharge.addressHash;
      }
    }
    
    // Get payment info from the charge
    const payment = event.data.payments?.[0];
    const chain = payment?.network || 'unknown';
    const txHash = payment?.transaction_id;
    const senderAddress = payment?.payer_addresses?.[0];
    const amountUsdc = parseFloat(event.data.pricing?.local?.amount || '0');
    
    // Check if we've already processed this charge
    const existingPayment = await getPaymentByChargeId(chargeId);
    
    switch (event.type) {
      case 'charge:pending': {
        if (existingPayment) {
          // Already processed, just update status
          await updatePaymentStatus(chargeId, 'pending');
          console.log(`Charge ${chargeId} already exists, updated to pending`);
        } else {
          // New payment - record and grant credits
          const creditsToGrant = calculateCreditsFromUsdc(amountUsdc);
          
          await recordPayment({
            chargeId,
            chargeCode,
            amountUsdc,
            chain,
            txHash,
            senderAddress,
            status: 'pending',
            accountAddressHash: addressHash,
            creditsGranted: creditsToGrant,
            rawWebhookPayload: rawBody,
          });
          
          // Grant credits to account if we have an address hash
          if (addressHash && creditsToGrant > 0) {
            await addCredits(addressHash, creditsToGrant);
            console.log(`Granted ${creditsToGrant} credits to ${addressHash}`);
          }
          
          console.log(`Recorded new payment: ${chargeId}, ${amountUsdc} USDC, ${creditsToGrant} credits`);
        }
        break;
      }
      
      case 'charge:confirmed': {
        if (existingPayment) {
          await updatePaymentStatus(chargeId, 'confirmed');
          console.log(`Charge ${chargeId} confirmed`);
        } else {
          // Rare case: confirmed without pending (shouldn't happen but handle it)
          const creditsToGrant = calculateCreditsFromUsdc(amountUsdc);
          
          await recordPayment({
            chargeId,
            chargeCode,
            amountUsdc,
            chain,
            txHash,
            senderAddress,
            status: 'confirmed',
            accountAddressHash: addressHash,
            creditsGranted: creditsToGrant,
            rawWebhookPayload: rawBody,
          });
          
          if (addressHash && creditsToGrant > 0) {
            await addCredits(addressHash, creditsToGrant);
            console.log(`Granted ${creditsToGrant} credits to ${addressHash} (confirmed)`);
          }
        }
        
        // Clean up pending charge record (payment complete)
        if (paymentToken) {
          await deletePendingCharge(paymentToken);
        }
        break;
      }
      
      case 'charge:failed': {
        if (existingPayment) {
          await updatePaymentStatus(chargeId, 'failed');
          console.log(`Charge ${chargeId} failed`);
          // Note: We don't revoke credits on failure after pending
          // This is intentional per architecture doc (<1 in a million failure rate)
        }
        break;
      }
      
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

