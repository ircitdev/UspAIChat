import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = getDB();
  const conversations = db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    WHERE c.user_id = ?
    ORDER BY c.is_pinned DESC, c.updated_at DESC
  `).all(req.userId);
  res.json(conversations);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { title, provider = 'openai', model = 'gpt-4o', system_prompt = '' } = req.body;
  const id = uuid();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO conversations (id, user_id, title, provider, model, system_prompt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, title || 'New Chat', provider, model, system_prompt, now, now);
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  res.json(conversation);
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const { title, system_prompt, provider, model, is_pinned } = req.body;
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE conversations SET
      title = COALESCE(?, title),
      system_prompt = COALESCE(?, system_prompt),
      provider = COALESCE(?, provider),
      model = COALESCE(?, model),
      is_pinned = COALESCE(?, is_pinned),
      updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(title, system_prompt, provider, model, is_pinned, now, req.params.id, req.userId);
  res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

router.get('/:id/messages', (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(messages.map(m => ({ ...m, files: JSON.parse(m.files || '[]') })));
});

router.get('/search/query', (req, res) => {
  const db = getDB();
  const { q } = req.query;
  if (!q) return res.json([]);
  try {
    const results = db.prepare(`
      SELECT m.*, c.title as conversation_title
      FROM messages_fts f
      JOIN messages m ON m.id = f.message_id
      JOIN conversations c ON c.id = m.conversation_id
      WHERE messages_fts MATCH ? AND c.user_id = ?
      ORDER BY rank LIMIT 50
    `).all(q + '*', req.userId);
    res.json(results);
  } catch {
    const results = db.prepare(`
      SELECT m.*, c.title as conversation_title
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE m.content LIKE ? AND c.user_id = ? LIMIT 50
    `).all(`%${q}%`, req.userId);
    res.json(results);
  }
});

export default router;
