import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = getDB();
  const folders = db.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY sort_order ASC, name ASC').all(req.userId);
  res.json(folders);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { name, color = '#8b5cf6' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const id = uuid();
  const now = Math.floor(Date.now() / 1000);
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM folders WHERE user_id = ?').get(req.userId);
  db.prepare('INSERT INTO folders (id, user_id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.userId, name.trim(), color, (maxOrder?.m || 0) + 1, now);
  res.json(db.prepare('SELECT * FROM folders WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const folder = db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!folder) return res.status(404).json({ error: 'Not found' });
  const { name, color, sort_order } = req.body;
  db.prepare('UPDATE folders SET name = COALESCE(?, name), color = COALESCE(?, color), sort_order = COALESCE(?, sort_order) WHERE id = ?').run(name, color, sort_order, req.params.id);
  res.json(db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE conversations SET folder_id = NULL WHERE folder_id = ? AND user_id = ?').run(req.params.id, req.userId);
  db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

export default router;
