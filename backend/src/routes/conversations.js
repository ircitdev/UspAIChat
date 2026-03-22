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
  const { title, provider = 'auto', model = 'auto', system_prompt = '' } = req.body;
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
  const { title, system_prompt, provider, model, is_pinned, folder_id } = req.body;
  const now = Math.floor(Date.now() / 1000);
  // Build dynamic update to handle folder_id (which can be explicitly set to null)
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (system_prompt !== undefined) { fields.push('system_prompt = ?'); values.push(system_prompt); }
  if (provider !== undefined) { fields.push('provider = ?'); values.push(provider); }
  if (model !== undefined) { fields.push('model = ?'); values.push(model); }
  if (is_pinned !== undefined) { fields.push('is_pinned = ?'); values.push(is_pinned); }
  if (folder_id !== undefined) { fields.push('folder_id = ?'); values.push(folder_id); }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(req.params.id, req.userId);
  db.prepare(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
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
  res.json(messages.map(m => ({
    ...m,
    files: JSON.parse(m.files || '[]'),
    routing_info: m.routing_info ? JSON.parse(m.routing_info) : null,
  })));
});

// Export conversation
router.get('/:id/export', (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);
  const format = req.query.format || 'md';

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${conv.title}.json"`);
    return res.json({
      title: conv.title,
      provider: conv.provider,
      model: conv.model,
      system_prompt: conv.system_prompt,
      created_at: conv.created_at,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        model: m.model,
        created_at: m.created_at,
        token_count: m.token_count
      }))
    });
  }

  if (format === 'txt') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${conv.title}.txt"`);
    let text = `${conv.title}\n${'='.repeat(conv.title.length)}\n\n`;
    if (conv.system_prompt) text += `[System]: ${conv.system_prompt}\n\n`;
    messages.forEach(m => {
      const date = new Date(m.created_at * 1000).toLocaleString();
      const role = m.role === 'user' ? 'You' : 'Assistant';
      text += `[${role}] (${date}):\n${m.content}\n\n`;
    });
    return res.send(text);
  }

  // Default: markdown
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${conv.title}.md"`);
  let md = `# ${conv.title}\n\n`;
  md += `**Provider:** ${conv.provider} | **Model:** ${conv.model}\n\n`;
  if (conv.system_prompt) md += `> **System:** ${conv.system_prompt}\n\n`;
  md += `---\n\n`;
  messages.forEach(m => {
    const date = new Date(m.created_at * 1000).toLocaleString();
    const role = m.role === 'user' ? '**You**' : '**Assistant**';
    md += `### ${role} <sub>${date}</sub>\n\n${m.content}\n\n---\n\n`;
  });
  res.send(md);
});

// Delete message
router.delete('/:convId/messages/:msgId', (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(req.params.convId, req.userId);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM messages WHERE id = ? AND conversation_id = ?').run(req.params.msgId, req.params.convId);
  try { db.prepare('DELETE FROM messages_fts WHERE message_id = ?').run(req.params.msgId); } catch {}
  res.json({ success: true });
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
