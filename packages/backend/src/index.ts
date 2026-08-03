import { config } from 'dotenv';
config(); // Load .env
config({ path: '.env.local', override: true }); // Optional local overrides

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { accountRoutes } from './routes/account.js';
import { blobRoutes } from './routes/blob.js';
import { adminRoutes } from './routes/admin.js';
import { paymentRoutes } from './routes/payments.js';
import { webhookRoutes } from './routes/webhooks.js';
import { stripePaymentRoutes } from './routes/stripe-payments.js';
import { stripeWebhookRoutes } from './routes/stripe-webhooks.js';
import { couponRoutes } from './routes/coupons.js';
import { startTempCleanup } from './services/temp-cleanup.js';
import { startTelegramBot } from './services/telegram-bot.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust nginx proxy for real IP (X-Forwarded-For)
app.set('trust proxy', 1);

// Global rate limit: one shared bucket for all traffic, keyed to a constant
// rather than the client IP. This caps total load on the server; it does not
// isolate clients from each other.
const globalLimiter = rateLimit({
  windowMs: 1000, // 1 second
  limit: 10,
  standardHeaders: true,
  keyGenerator: () => 'global',
  message: { error: 'Server busy, try again shortly' }
});

app.use(cors());

// Webhooks need raw body for signature verification - must be before express.json()
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes, stripeWebhookRoutes);

// Health check sits above the limiter so a traffic burst can't make the
// service look down to the deploy check or an uptime monitor.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.json());
app.use(globalLimiter);

// Routes
app.use('/account', accountRoutes);
app.use('/blob', blobRoutes);
app.use('/admin', adminRoutes);
app.use('/payments', paymentRoutes);
app.use('/stripe', stripePaymentRoutes);
app.use('/coupon', couponRoutes);

startTempCleanup();
startTelegramBot();

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

