import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { initDB } from './db/database.js';
import authRoutes from './routes/auth.js';
import authTelegramRoutes from './routes/authTelegram.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import conversationRoutes from './routes/conversations.js';
import modelRoutes from './routes/models.js';
import fileRoutes from './routes/files.js';
import settingsRoutes from './routes/settings.js';
import authOAuthRoutes from './routes/authOAuth.js';
import folderRoutes from './routes/folders.js';
import promptTemplateRoutes from './routes/promptTemplates.js';
import shareRoutes from './routes/share.js';
import paymentRoutes from './routes/payments.js';
import promoRoutes from './routes/promo.js';
import referralRoutes from './routes/referral.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(join(__dirname, '../../uploads')));

initDB();

// Start Telegram bot
import('./services/telegram.js').then(m => m.startBot()).catch(e => console.error('Bot start error:', e));

app.use('/api/auth', authRoutes);
app.use('/api/auth/telegram', authTelegramRoutes);
app.use('/api/auth/oauth', authOAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/prompt-templates', promptTemplateRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/referral', referralRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// Serve frontend (production)
import { existsSync } from 'fs';
const frontendDist = join(__dirname, '../../frontend/dist');
// Privacy policy page
app.get('/privacy', (req, res) => res.sendFile(join(__dirname, '../../frontend/public/privacy.html')));
app.get('/terms', (req, res) => res.sendFile(join(__dirname, '../../frontend/public/privacy.html')));

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: serve index.html for client-side routes
  app.get('/shared/*', (req, res) => res.sendFile(join(frontendDist, 'index.html')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`UspAIChat backend running on http://localhost:${PORT}`);
});
