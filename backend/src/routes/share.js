import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Create or update share link (requires auth)
router.post('/:conversationId', requireAuth, async (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(req.params.conversationId, req.userId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const { password } = req.body;

  // Check if already shared
  const existing = db.prepare('SELECT * FROM shared_conversations WHERE conversation_id = ? AND user_id = ?').get(req.params.conversationId, req.userId);

  if (existing) {
    // Update existing share
    const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
    db.prepare('UPDATE shared_conversations SET is_active = 1, password_hash = ? WHERE id = ?').run(passwordHash, existing.id);
    return res.json({ share_id: existing.id, has_password: !!password });
  }

  const id = uuid().replace(/-/g, '').slice(0, 12); // short share ID
  const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    'INSERT INTO shared_conversations (id, conversation_id, user_id, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.conversationId, req.userId, passwordHash, now);

  res.json({ share_id: id, has_password: !!password });
});

// Get share status for a conversation (requires auth)
router.get('/status/:conversationId', requireAuth, (req, res) => {
  const db = getDB();
  const share = db.prepare('SELECT id, is_active, password_hash IS NOT NULL as has_password, views, created_at FROM shared_conversations WHERE conversation_id = ? AND user_id = ?').get(req.params.conversationId, req.userId);
  if (!share) return res.json({ shared: false });
  res.json({ shared: share.is_active === 1, share_id: share.id, has_password: !!share.has_password, views: share.views });
});

// Disable share (requires auth)
router.delete('/:conversationId', requireAuth, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE shared_conversations SET is_active = 0 WHERE conversation_id = ? AND user_id = ?').run(req.params.conversationId, req.userId);
  res.json({ success: true });
});

// Public: view shared conversation (no auth needed)
router.get('/public/:shareId', (req, res) => {
  const db = getDB();
  const share = db.prepare('SELECT * FROM shared_conversations WHERE id = ? AND is_active = 1').get(req.params.shareId);
  if (!share) return res.status(404).json({ error: 'Share not found or expired' });

  // If password protected, require it
  if (share.password_hash) {
    const password = req.query.password || req.headers['x-share-password'];
    if (!password) return res.status(401).json({ error: 'Password required', needs_password: true });
    if (!bcrypt.compareSync(String(password), share.password_hash)) {
      return res.status(403).json({ error: 'Wrong password' });
    }
  }

  const conv = db.prepare('SELECT title, provider, model, system_prompt, created_at FROM conversations WHERE id = ?').get(share.conversation_id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.prepare('SELECT role, content, created_at, model, files FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(share.conversation_id);
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(share.user_id);

  // Increment views
  db.prepare('UPDATE shared_conversations SET views = views + 1 WHERE id = ?').run(req.params.shareId);

  res.json({
    title: conv.title,
    provider: conv.provider,
    model: conv.model,
    system_prompt: conv.system_prompt,
    created_at: conv.created_at,
    author: user?.username || 'Unknown',
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
      model: m.model,
      files: JSON.parse(m.files || '[]')
    }))
  });
});

export default router;
