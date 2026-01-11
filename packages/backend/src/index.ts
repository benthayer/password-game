import { config } from 'dotenv';
config(); // Load .env
config({ path: '.env.local', override: true }); // Optional local overrides

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { accountRoutes } from './routes/account.js';
import { blobRoutes } from './routes/blob.js';
import { adminRoutes } from './routes/admin.js';
import { startTempCleanup } from './services/temp-cleanup.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust nginx proxy for real IP (X-Forwarded-For)
app.set('trust proxy', 1);

const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 500,
  standardHeaders: true,
  message: { error: 'Too many requests, try again tomorrow' }
});

app.use(cors());
app.use(express.json());
app.use(dailyLimiter);

// Routes
app.use('/account', accountRoutes);
app.use('/blob', blobRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

startTempCleanup();

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

