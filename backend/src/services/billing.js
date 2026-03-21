import { getDB } from '../db/database.js';
import { v4 as uuid } from 'uuid';

// Cost per 1000 output tokens in "credits" (1 credit = $0.001 by default)
// Admin can override via settings key "price_{provider}_{model}" or "price_{provider}"
export const DEFAULT_PRICES = {
  anthropic: {
    'claude-opus-4-6':            15.0,
    'claude-sonnet-4-6':           3.0,
    'claude-haiku-4-5-20251001':   0.25,
    'claude-3-5-sonnet-20241022':  3.0,
    'claude-3-5-haiku-20241022':   0.8,
    _default:                      3.0,
  },
  openai: {
    'gpt-4o':      5.0,
    'gpt-4o-mini': 0.6,
    'gpt-4-turbo': 10.0,
    'o1':          60.0,
    'o1-mini':     3.0,
    _default:       5.0,
  },
  gemini: {
    'gemini-2.0-flash': 0.4,
    'gemini-1.5-pro':   3.5,
    'gemini-1.5-flash': 0.35,
    _default:            1.0,
  },
};

/** Get cost per 1K tokens for a model (checks DB overrides first) */
export function getPricePer1k(provider, model) {
  const db = getDB();
  // Check DB override: price_openai_gpt-4o  or  price_openai
  const modelKey = `price_${provider}_${model}`;
  const providerKey = `price_${provider}`;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(modelKey)
            || db.prepare('SELECT value FROM settings WHERE key = ?').get(providerKey);
  if (row) return parseFloat(row.value);

  const map = DEFAULT_PRICES[provider] || {};
  return map[model] ?? map._default ?? 1.0;
}

/** Compute charge for N tokens */
export function computeCost(tokens, provider, model) {
  return (tokens / 1000) * getPricePer1k(provider, model);
}

/**
 * Deduct balance atomically.
 * Returns { ok: true, balanceAfter } or { ok: false, reason }
 */
export function chargeUser(userId, tokens, provider, model, description = '') {
  const db = getDB();
  const cost = computeCost(tokens, provider, model);
  if (cost <= 0) return { ok: true, cost: 0, balanceAfter: null };

  // Atomic: read + check + update in one transaction
  const result = db.transaction(() => {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    if (!user) return { ok: false, reason: 'Пользователь не найден' };
    if (user.balance < cost) {
      return { ok: false, reason: `Недостаточно средств. Нужно ${cost.toFixed(4)} кр., доступно ${user.balance.toFixed(4)} кр.` };
    }
    const balanceAfter = user.balance - cost;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(balanceAfter, userId);
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, balance_after, description, provider, model, tokens, created_at)
                VALUES (?, ?, 'charge', ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuid(), userId, -cost, balanceAfter, description || `${provider}/${model}`, provider, model, tokens, Math.floor(Date.now() / 1000));
    return { ok: true, cost, balanceAfter };
  })();

  return result;
}

/**
 * Top up user balance (admin action).
 */
export function topupUser(userId, amount, adminId, description = '') {
  const db = getDB();
  if (amount <= 0) throw new Error('Сумма должна быть больше нуля');

  return db.transaction(() => {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('Пользователь не найден');
    const balanceAfter = user.balance + amount;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(balanceAfter, userId);
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, balance_after, description, admin_id, created_at)
                VALUES (?, ?, 'topup', ?, ?, ?, ?, ?)`)
      .run(uuid(), userId, amount, balanceAfter, description || 'Пополнение администратором', adminId, Math.floor(Date.now() / 1000));
    return { balanceAfter };
  })();
}
