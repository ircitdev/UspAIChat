import { Router } from 'express';
import { getDB } from '../db/database.js';
import { getBotUsername } from '../services/telegram.js';
import { JWT_SECRET } from './auth.js';
import { requireAuth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';

const router = Router();

const REFRESH_EXPIRES = 60 * 60 * 24 * 30;
const CODE_TTL = 10 * 60; // 10 minutes

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function makeTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = uuid();
  const db = getDB();
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_EXPIRES;
  db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .run(uuid(), userId, refreshToken, expiresAt);
  return { accessToken, refreshToken };
}

// POST /api/auth/telegram/init
// Returns { code, bot_username, expires_in }
router.post('/init', (req, res) => {
  const db = getDB();
  const code = makeCode();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + CODE_TTL;

  // Clean old pending codes (housekeeping)
  db.prepare(`DELETE FROM telegram_auth_codes WHERE expires_at < ?`).run(now);

  db.prepare(
    `INSERT INTO telegram_auth_codes (code, status, created_at, expires_at) VALUES (?, 'pending', ?, ?)`
  ).run(code, now, expiresAt);

  res.json({
    code,
    bot_username: getBotUsername(),
    expires_in: CODE_TTL,
  });
});

// GET /api/auth/telegram/poll/:code
// Returns { status: 'pending' | 'confirmed' | 'expired' } or JWT on confirmed
router.get('/poll/:code', (req, res) => {
  const db = getDB();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT * FROM telegram_auth_codes WHERE code = ?').get(req.params.code);

  if (!row) return res.json({ status: 'not_found' });

  if (row.expires_at < now && row.status === 'pending') {
    db.prepare(`UPDATE telegram_auth_codes SET status = 'expired' WHERE code = ?`).run(row.code);
    return res.json({ status: 'expired' });
  }

  if (row.status === 'confirmed' && row.user_id) {
    const user = db.prepare(
      'SELECT id, email, username, telegram_id, telegram_username, role, is_blocked, balance, avatar, created_at FROM users WHERE id = ?'
    ).get(row.user_id);

    if (!user || user.is_blocked) {
      return res.json({ status: 'blocked' });
    }

    // Delete used code
    db.prepare('DELETE FROM telegram_auth_codes WHERE code = ?').run(row.code);

    const tokens = makeTokens(user.id);
    return res.json({ status: 'confirmed', user, ...tokens });
  }

  res.json({ status: row.status });
});

// POST /api/auth/telegram/link/init  (requireAuth)
// Generates a link code for an already-logged-in user
router.post('/link/init', requireAuth, (req, res) => {
  const db = getDB();
  const code = makeCode();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + CODE_TTL;

  db.prepare(`DELETE FROM telegram_auth_codes WHERE expires_at < ?`).run(now);
  // Remove any existing pending link code for this user
  db.prepare(`DELETE FROM telegram_auth_codes WHERE user_id = ? AND type = 'link' AND status = 'pending'`).run(req.userId);

  db.prepare(
    `INSERT INTO telegram_auth_codes (code, user_id, status, type, created_at, expires_at) VALUES (?, ?, 'pending', 'link', ?, ?)`
  ).run(code, req.userId, now, expiresAt);

  res.json({ code, bot_username: getBotUsername(), expires_in: CODE_TTL });
});

// GET /api/auth/telegram/link/poll/:code  (requireAuth)
router.get('/link/poll/:code', requireAuth, (req, res) => {
  const db = getDB();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(`SELECT * FROM telegram_auth_codes WHERE code = ? AND type = 'link'`).get(req.params.code);

  if (!row) return res.json({ status: 'not_found' });
  if (row.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  if (row.expires_at < now && row.status === 'pending') {
    db.prepare(`UPDATE telegram_auth_codes SET status = 'expired' WHERE code = ?`).run(row.code);
    return res.json({ status: 'expired' });
  }

  if (row.status === 'confirmed') {
    db.prepare('DELETE FROM telegram_auth_codes WHERE code = ?').run(row.code);
    const user = db.prepare(
      'SELECT id, email, username, telegram_id, telegram_username, role, is_blocked, balance, avatar, created_at FROM users WHERE id = ?'
    ).get(req.userId);
    return res.json({ status: 'confirmed', user });
  }

  res.json({ status: row.status });
});

// DELETE /api/auth/telegram/unlink  (requireAuth)
router.delete('/unlink', requireAuth, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE users SET telegram_id = NULL, telegram_username = NULL WHERE id = ?').run(req.userId);
  res.json({ success: true });
});

export default router;
