import { Router } from 'express';
import { getDB } from '../db/database.js';
import { requireAdmin } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { topupUser, DEFAULT_PRICES } from '../services/billing.js';

const router = Router();
router.use(requireAdmin);

const SAFE_FIELDS = 'id, email, username, role, is_blocked, balance, avatar, created_at, updated_at';

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const db = getDB();
  const totalUsers     = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const adminUsers     = db.prepare("SELECT COUNT(*) as n FROM users WHERE role='admin'").get().n;
  const blockedUsers   = db.prepare('SELECT COUNT(*) as n FROM users WHERE is_blocked=1').get().n;
  const totalConvs     = db.prepare('SELECT COUNT(*) as n FROM conversations').get().n;
  const totalMessages  = db.prepare('SELECT COUNT(*) as n FROM messages').get().n;
  const newToday       = db.prepare(
    "SELECT COUNT(*) as n FROM users WHERE created_at >= strftime('%s', 'now', 'start of day')"
  ).get().n;
  const totalTopup     = db.prepare("SELECT COALESCE(SUM(amount),0) as n FROM transactions WHERE type='topup'").get().n;
  const totalCharged   = db.prepare("SELECT COALESCE(SUM(ABS(amount)),0) as n FROM transactions WHERE type='charge'").get().n;
  const totalBalance   = db.prepare('SELECT COALESCE(SUM(balance),0) as n FROM users').get().n;
  res.json({ totalUsers, adminUsers, blockedUsers, totalConvs, totalMessages, newToday, totalTopup, totalCharged, totalBalance });
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const db = getDB();
  const { q } = req.query;
  let users;
  if (q) {
    users = db.prepare(
      `SELECT ${SAFE_FIELDS},
        (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) as conv_count
       FROM users WHERE email LIKE ? OR username LIKE ?
       ORDER BY created_at DESC`
    ).all(`%${q}%`, `%${q}%`);
  } else {
    users = db.prepare(
      `SELECT ${SAFE_FIELDS},
        (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) as conv_count
       FROM users ORDER BY created_at DESC`
    ).all();
  }
  res.json(users);
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role))
    return res.status(400).json({ error: 'role должен быть admin или user' });
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'Нельзя изменить свою собственную роль' });

  const db = getDB();
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, now, req.params.id);
  const user = db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`).get(req.params.id);
  res.json(user);
});

// PATCH /api/admin/users/:id/block
router.patch('/users/:id/block', (req, res) => {
  const { is_blocked } = req.body;
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });

  const db = getDB();
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET is_blocked = ?, updated_at = ? WHERE id = ?').run(is_blocked ? 1 : 0, now, req.params.id);
  // Revoke all sessions if blocking
  if (is_blocked) {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.params.id);
  }
  const user = db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`).get(req.params.id);
  res.json(user);
});

// PATCH /api/admin/users/:id/password  — сброс пароля
router.patch('/users/:id/password', async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });

  const db = getDB();
  const hash = await bcrypt.hash(new_password, 12);
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, req.params.id);
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'Нельзя удалить самого себя' });

  getDB().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/admin/conversations — все чаты всех пользователей
router.get('/conversations', (req, res) => {
  const db = getDB();
  const convs = db.prepare(`
    SELECT c.*, u.username, u.email,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.updated_at DESC
    LIMIT 200
  `).all();
  res.json(convs);
});

// GET /api/admin/global-keys — глобальные API ключи (используются если у юзера нет своего)
router.get('/global-keys', (req, res) => {
  const db = getDB();
  const keys = db.prepare(
    "SELECT provider, base_url, updated_at FROM api_keys WHERE user_id = '__global__'"
  ).all();
  const result = {};
  keys.forEach(k => result[k.provider] = { configured: true, base_url: k.base_url, updated_at: k.updated_at });
  res.json(result);
});

router.post('/global-keys', (req, res) => {
  const db = getDB();
  const { provider, api_key, base_url } = req.body;
  if (!provider || !api_key) return res.status(400).json({ error: 'provider и api_key обязательны' });
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT OR REPLACE INTO api_keys (user_id, provider, api_key, base_url, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('__global__', provider, api_key, base_url || null, now);
  res.json({ success: true });
});

router.delete('/global-keys/:provider', (req, res) => {
  getDB().prepare("DELETE FROM api_keys WHERE user_id = '__global__' AND provider = ?").run(req.params.provider);
  res.json({ success: true });
});

// ── BALANCE ──────────────────────────────────────────────

// POST /api/admin/balance/topup
router.post('/balance/topup', (req, res) => {
  const { user_id, amount, description } = req.body;
  if (!user_id || !amount) return res.status(400).json({ error: 'user_id и amount обязательны' });
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'amount должен быть положительным числом' });
  try {
    const result = topupUser(user_id, parsed, req.userId, description || '');
    const user = getDB().prepare('SELECT id, username, email, balance FROM users WHERE id = ?').get(user_id);
    res.json({ success: true, balance_after: result.balanceAfter, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/admin/balance/transactions?user_id=&limit=50
router.get('/balance/transactions', (req, res) => {
  const db = getDB();
  const { user_id, limit = 50 } = req.query;
  let txs;
  if (user_id) {
    txs = db.prepare(`
      SELECT t.*, u.username, u.email, a.username as admin_username
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN users a ON a.id = t.admin_id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC LIMIT ?
    `).all(user_id, parseInt(limit));
  } else {
    txs = db.prepare(`
      SELECT t.*, u.username, u.email, a.username as admin_username
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN users a ON a.id = t.admin_id
      ORDER BY t.created_at DESC LIMIT ?
    `).all(parseInt(limit));
  }
  res.json(txs);
});

// ── PRICING ──────────────────────────────────────────────

// GET /api/admin/pricing
router.get('/pricing', (req, res) => {
  const db = getDB();
  const overrides = {};
  db.prepare("SELECT key, value FROM settings WHERE key LIKE 'price_%'").all()
    .forEach(r => { overrides[r.key] = parseFloat(r.value); });
  res.json({ defaults: DEFAULT_PRICES, overrides });
});

// POST /api/admin/pricing  { key: 'price_openai_gpt-4o', value: 5.0 }
router.post('/pricing', (req, res) => {
  const { key, value } = req.body;
  if (!key?.startsWith('price_') || value === undefined)
    return res.status(400).json({ error: 'key (price_...) и value обязательны' });
  getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  res.json({ success: true });
});

router.delete('/pricing/:key', (req, res) => {
  getDB().prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);
  res.json({ success: true });
});

export default router;
