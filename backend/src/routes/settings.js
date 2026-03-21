import { Router } from 'express';
import { getDB } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  res.json({ success: true });
});

export default router;
