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

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.listen(PORT, () => {
  console.log(`UspAIChat backend running on http://localhost:${PORT}`);
});
