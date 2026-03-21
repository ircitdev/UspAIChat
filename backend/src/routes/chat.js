import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { streamClaude } from '../services/claude.js';
import { streamOpenAI } from '../services/openai.js';
import { streamGemini } from '../services/gemini.js';
import { requireAuth } from '../middleware/auth.js';
import { chargeUser, computeCost, getPricePer1k } from '../services/billing.js';

const router = Router();
router.use(requireAuth);

router.post('/stream', async (req, res) => {
  const { conversation_id, message, provider, model, system_prompt, files = [] } = req.body;
  const db = getDB();

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (res.flush) res.flush();
  };

  try {
    // Get API key
    // Try user's own key first, then fall back to global admin key
    const apiKeyRow =
      db.prepare('SELECT api_key, base_url FROM api_keys WHERE user_id = ? AND provider = ?').get(req.userId, provider) ||
      db.prepare("SELECT api_key, base_url FROM api_keys WHERE user_id = '__global__' AND provider = ?").get(provider);
    if (!apiKeyRow) {
      send({ type: 'error', error: `API ключ для ${provider} не настроен. Перейдите в Настройки модели.` });
      res.end();
      return;
    }

    // Pre-flight balance check (only if user is not admin)
    const userRow = db.prepare('SELECT balance, role FROM users WHERE id = ?').get(req.userId);
    const isAdmin = userRow?.role === 'admin';
    if (!isAdmin) {
      const estimatedCost = computeCost(200, provider, model); // min estimate
      if ((userRow?.balance ?? 0) < estimatedCost) {
        send({ type: 'error', error: `Недостаточно средств на балансе. Пополните баланс у администратора.` });
        res.end();
        return;
      }
    }

    // Send current price per 1K so frontend can show it
    send({ type: 'price', pricePer1k: getPricePer1k(provider, model) });

    // Save user message
    const userMsgId = uuid();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, provider, model, files)
      VALUES (?, ?, 'user', ?, ?, ?, ?, ?)
    `).run(userMsgId, conversation_id, message, now, provider, model, JSON.stringify(files));

    // Index in FTS
    try {
      db.prepare('INSERT INTO messages_fts (content, conversation_id, message_id, role) VALUES (?, ?, ?, ?)').run(message, conversation_id, userMsgId, 'user');
    } catch {}

    // Get conversation history
    const history = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ? AND role != 'system'
      ORDER BY created_at ASC
    `).all(conversation_id);

    // Get conversation system prompt
    const conv = db.prepare('SELECT system_prompt FROM conversations WHERE id = ?').get(conversation_id);
    const finalSystemPrompt = system_prompt || conv?.system_prompt || '';

    send({ type: 'start', message_id: userMsgId });

    let fullResponse = '';
    let tokenCount = 0;

    const onChunk = (chunk) => {
      fullResponse += chunk;
      send({ type: 'chunk', content: chunk });
    };

    const onTokens = (count) => {
      tokenCount = count;
      send({ type: 'tokens', count });
    };

    // Stream based on provider
    if (provider === 'anthropic') {
      await streamClaude({ apiKey: apiKeyRow.api_key, model, history, message, systemPrompt: finalSystemPrompt, files, onChunk, onTokens });
    } else if (provider === 'openai') {
      await streamOpenAI({ apiKey: apiKeyRow.api_key, baseURL: apiKeyRow.base_url, model, history, message, systemPrompt: finalSystemPrompt, files, onChunk, onTokens });
    } else if (provider === 'gemini') {
      await streamGemini({ apiKey: apiKeyRow.api_key, model, history, message, systemPrompt: finalSystemPrompt, files, onChunk, onTokens });
    } else if (provider === 'deepseek') {
      await streamOpenAI({ apiKey: apiKeyRow.api_key, baseURL: 'https://api.deepseek.com/v1', model, history, message, systemPrompt: finalSystemPrompt, files, onChunk, onTokens });
    } else if (provider === 'kimi') {
      await streamOpenAI({ apiKey: apiKeyRow.api_key, baseURL: 'https://api.moonshot.cn/v1', model, history, message, systemPrompt: finalSystemPrompt, files, onChunk, onTokens });
    }

    // Save assistant message
    const asstMsgId = uuid();
    const now2 = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, provider, model, token_count)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)
    `).run(asstMsgId, conversation_id, fullResponse, now2, provider, model, tokenCount);

    try {
      db.prepare('INSERT INTO messages_fts (content, conversation_id, message_id, role) VALUES (?, ?, ?, ?)').run(fullResponse, conversation_id, asstMsgId, 'assistant');
    } catch {}

    // Update conversation
    db.prepare('UPDATE conversations SET updated_at = ?, provider = ?, model = ? WHERE id = ?')
      .run(now2, provider, model, conversation_id);

    // Auto-title if first message
    const msgCount = db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ?').get(conversation_id);
    if (msgCount.cnt <= 2) {
      const title = message.slice(0, 50).replace(/\n/g, ' ');
      db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conversation_id);
    }

    // Charge balance (skip for admin)
    let balanceAfter = null;
    if (!isAdmin && tokenCount > 0) {
      const charge = chargeUser(req.userId, tokenCount, provider, model, `Ответ ${model}`);
      if (!charge.ok) {
        // Response already sent, just log — partial charge handled gracefully
        console.warn('Charge failed after response:', charge.reason);
      } else {
        balanceAfter = charge.balanceAfter;
      }
    }

    send({ type: 'done', message_id: asstMsgId, full_content: fullResponse, balance_after: balanceAfter });
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    send({ type: 'error', error: err.message || 'Ошибка при получении ответа от AI' });
    res.end();
  }
});

export default router;
