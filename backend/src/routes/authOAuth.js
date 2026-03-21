import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDB } from '../db/database.js';
import { JWT_SECRET } from './auth.js';

const router = Router();

const JWT_EXPIRES = '15m';
const REFRESH_EXPIRES = 60 * 60 * 24 * 30;
const SAFE_USER_FIELDS = 'id, email, username, role, is_blocked, avatar, google_id, apple_id, created_at';

function makeTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = uuid();
  const db = getDB();
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_EXPIRES;
  db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .run(uuid(), userId, refreshToken, expiresAt);
  return { accessToken, refreshToken };
}

// GET /api/auth/oauth/config — return OAuth client IDs to frontend (no secrets)
router.get('/config', (req, res) => {
  res.json({
    google_client_id: process.env.GOOGLE_CLIENT_ID || null,
    apple_client_id: process.env.APPLE_CLIENT_ID || null,
  });
});

// ── Google Sign-In ──
// Accepts { credential } — the Google ID token from Google Identity Services
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential обязателен' });

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID не настроен на сервере' });

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || payload.email?.split('@')[0] || 'User';
    const picture = payload.picture || null;

    const db = getDB();

    // 1. Find by google_id
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);

    if (!user && email) {
      // 2. Find by email — link Google to existing account
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
      if (user) {
        db.prepare('UPDATE users SET google_id = ?, updated_at = ? WHERE id = ?')
          .run(googleId, Math.floor(Date.now() / 1000), user.id);
        user.google_id = googleId;
      }
    }

    if (!user) {
      // 3. Create new user
      const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
      const role = userCount.cnt === 0 ? 'admin' : 'user';
      const id = uuid();
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        'INSERT INTO users (id, email, username, google_id, avatar, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, email ? email.toLowerCase() : null, name, googleId, picture, role, now, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (role === 'admin') console.log(`First user "${name}" registered as ADMIN via Google`);
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
    }

    // Update avatar from Google if not set
    if (!user.avatar && picture) {
      db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(picture, user.id);
      user.avatar = picture;
    }

    const tokens = makeTokens(user.id);
    const safeUser = db.prepare(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ?`).get(user.id);
    res.json({ user: safeUser, ...tokens });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Не удалось подтвердить Google аккаунт' });
  }
});

// ── Apple Sign-In ──
// Accepts { id_token, user? } — Apple sends id_token as JWT; user object on first sign-in only
router.post('/apple', async (req, res) => {
  const { id_token, user: appleUser } = req.body;
  if (!id_token) return res.status(400).json({ error: 'id_token обязателен' });

  try {
    // Decode Apple JWT (header to get kid)
    const parts = id_token.split('.');
    if (parts.length !== 3) return res.status(400).json({ error: 'Невалидный токен' });

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    // Verify Apple JWT using Apple's public keys
    const appleKeysRes = await fetch('https://appleid.apple.com/auth/keys');
    const { keys } = await appleKeysRes.json();
    const key = keys.find(k => k.kid === header.kid);
    if (!key) return res.status(401).json({ error: 'Невалидный ключ Apple' });

    // Convert JWK to PEM
    const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
    // Verify signature
    jwt.verify(id_token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_CLIENT_ID,
    });

    const appleId = payload.sub;
    const email = payload.email || appleUser?.email || null;
    const name = appleUser?.name
      ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
      : null;

    const db = getDB();

    // 1. Find by apple_id
    let user = db.prepare('SELECT * FROM users WHERE apple_id = ?').get(appleId);

    if (!user && email) {
      // 2. Find by email — link Apple to existing account
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
      if (user) {
        db.prepare('UPDATE users SET apple_id = ?, updated_at = ? WHERE id = ?')
          .run(appleId, Math.floor(Date.now() / 1000), user.id);
        user.apple_id = appleId;
      }
    }

    if (!user) {
      // 3. Create new user
      const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
      const role = userCount.cnt === 0 ? 'admin' : 'user';
      const id = uuid();
      const now = Math.floor(Date.now() / 1000);
      const username = name || (email ? email.split('@')[0] : 'Apple User');
      db.prepare(
        'INSERT INTO users (id, email, username, apple_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, email ? email.toLowerCase() : null, username, appleId, role, now, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (role === 'admin') console.log(`First user "${username}" registered as ADMIN via Apple`);
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
    }

    const tokens = makeTokens(user.id);
    const safeUser = db.prepare(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ?`).get(user.id);
    res.json({ user: safeUser, ...tokens });
  } catch (err) {
    console.error('Apple auth error:', err.message);
    res.status(401).json({ error: 'Не удалось подтвердить Apple аккаунт' });
  }
});

export default router;
