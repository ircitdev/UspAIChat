import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = getDB();
  const templates = db.prepare(
    'SELECT * FROM prompt_templates WHERE user_id = ? OR is_global = 1 ORDER BY sort_order ASC, name ASC'
  ).all(req.userId);
  res.json(templates);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { name, content, category = 'general' } = req.body;
  if (!name?.trim() || !content?.trim()) return res.status(400).json({ error: 'Name and content required' });
  const id = uuid();
  const now = Math.floor(Date.now() / 1000);
  const isGlobal = req.userRole === 'admin' && req.body.is_global ? 1 : 0;
  db.prepare(
    'INSERT INTO prompt_templates (id, user_id, name, content, category, is_global, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.userId, name.trim(), content.trim(), category, isGlobal, now, now);
  res.json(db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const tpl = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Not found' });
  if (tpl.user_id !== req.userId && req.userRole !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, content, category } = req.body;
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'UPDATE prompt_templates SET name = COALESCE(?, name), content = COALESCE(?, content), category = COALESCE(?, category), updated_at = ? WHERE id = ?'
  ).run(name, content, category, now, req.params.id);
  res.json(db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const tpl = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Not found' });
  if (tpl.user_id !== req.userId && req.userRole !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
