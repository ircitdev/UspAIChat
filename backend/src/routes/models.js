import { Router } from 'express';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const MODELS = {
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', context: 200000 },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', context: 200000 },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', context: 200000 },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', context: 200000 },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', context: 200000 },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', context: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', context: 128000 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', context: 128000 },
    { id: 'o1', name: 'o1', context: 200000 },
    { id: 'o1-mini', name: 'o1 Mini', context: 128000 },
  ],
  gemini: [
    { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', context: 1048576 },
    { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', context: 2097152 },
    { id: 'gemini-1.5-flash-8b-latest', name: 'Gemini 1.5 Flash 8B', context: 1048576 },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (exp)', context: 1048576 },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3', context: 64000 },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', context: 64000 },
  ],
  kimi: [
    { id: 'moonshot-v1-8k', name: 'Kimi 8K', context: 8000 },
    { id: 'moonshot-v1-32k', name: 'Kimi 32K', context: 32000 },
    { id: 'moonshot-v1-128k', name: 'Kimi 128K', context: 128000 },
  ],
};

router.get('/', (req, res) => res.json(MODELS));

router.get('/keys', requireAuth, (req, res) => {
  const db = getDB();
  const keys = db.prepare('SELECT provider, base_url, updated_at FROM api_keys WHERE user_id = ?').all(req.userId);
  const result = {};
  keys.forEach(k => result[k.provider] = { configured: true, base_url: k.base_url, updated_at: k.updated_at });
  res.json(result);
});

router.post('/keys', requireAuth, (req, res) => {
  const db = getDB();
  const { provider, api_key, base_url } = req.body;
  if (!provider || !api_key) return res.status(400).json({ error: 'provider and api_key required' });
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT OR REPLACE INTO api_keys (user_id, provider, api_key, base_url, updated_at) VALUES (?, ?, ?, ?, ?)
  `).run(req.userId, provider, api_key, base_url || null, now);
  res.json({ success: true });
});

router.delete('/keys/:provider', requireAuth, (req, res) => {
  getDB().prepare('DELETE FROM api_keys WHERE user_id = ? AND provider = ?').run(req.userId, req.params.provider);
  res.json({ success: true });
});

export default router;
