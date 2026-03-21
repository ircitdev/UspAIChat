import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../routes/auth.js';
import { getDB } from '../db/database.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Не авторизован' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getDB().prepare('SELECT id, role, is_blocked FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    if (user.is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ error: 'Токен недействителен или истёк' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.userRole !== 'admin')
      return res.status(403).json({ error: 'Доступ только для администраторов' });
    next();
  });
}
