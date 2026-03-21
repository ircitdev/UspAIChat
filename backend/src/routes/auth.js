import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../db/database.js';

const router = Router();

export const JWT_SECRET = process.env.JWT_SECRET || 'uspaichat_secret_change_in_production';
const JWT_EXPIRES = '15m';
const REFRESH_EXPIRES = 60 * 60 * 24 * 30;

const SAFE_USER_FIELDS = 'id, email, username, role, is_blocked, avatar, created_at';

function makeTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = uuid();
  const db = getDB();
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_EXPIRES;
  db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .run(uuid(), userId, refreshToken, expiresAt);
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password)
    return res.status(400).json({ error: 'email, username и password обязательны' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing)
    return res.status(409).json({ error: 'Email уже используется' });

  // First user ever becomes admin
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  const role = userCount.cnt === 0 ? 'admin' : 'user';

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuid();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase().trim(), username.trim(), passwordHash, role, now, now);

  const user = db.prepare(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ?`).get(id);
  const tokens = makeTokens(id);

  if (role === 'admin') console.log(`👑 First user "${username}" registered as ADMIN`);

  res.json({ user, ...tokens });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email и password обязательны' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user)
    return res.status(401).json({ error: 'Неверный email или пароль' });

  if (user.is_blocked)
    return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'Неверный email или пароль' });

  const tokens = makeTokens(user.id);
  const { password_hash, ...safeUser } = user;
  safeUser.has_password = !!password_hash;
  res.json({ user: safeUser, ...tokens });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: 'refreshToken обязателен' });

  const db = getDB();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?').get(refreshToken, now);
  if (!row)
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });

  const user = db.prepare(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ?`).get(row.user_id);
  if (!user || user.is_blocked) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    return res.status(403).json({ error: 'Аккаунт заблокирован или не существует' });
  }

  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
  const tokens = makeTokens(row.user_id);
  res.json({ user, ...tokens });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) getDB().prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  res.json({ success: true });
});

// POST /api/auth/set-password — set or change password (for OAuth users)
router.post('/set-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });

    // If user already has a password, require current password
    if (user.password_hash) {
      if (!currentPassword) return res.status(400).json({ error: 'Введите текущий пароль' });
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Неверный текущий пароль' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, Math.floor(Date.now() / 1000), user.id);

    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'Токен недействителен' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const fullUser = getDB().prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
    if (!fullUser) return res.status(401).json({ error: 'Пользователь не найден' });
    const { password_hash, ...user } = fullUser;
    user.has_password = !!password_hash;
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Токен недействителен' });
  }
});

export default router;
