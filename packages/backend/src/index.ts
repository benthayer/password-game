import { config } from 'dotenv';
config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { accountRoutes } from './routes/account.js';
import { blobRoutes } from './routes/blob.js';
import { adminRoutes } from './routes/admin.js';
import { startTempCleanup } from './services/temp-cleanup.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

