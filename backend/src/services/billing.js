import { getDB } from '../db/database.js';
import { v4 as uuid } from 'uuid';

// ══════════════════════════════════════════════════════════════════════
// Pricing: credits per 1K OUTPUT tokens
// 1 кредит = 1 рубль (при пополнении)
//
// Цена включает стоимость input-токенов (заложена в наценку).
// Расчёт: (API output ₽ + API input ₽ × 2.5) × наценка ~2.5x
// Курс: 90 ₽/$
//
// Admin может переопределить через settings: price_{provider}_{model}
// ══════════════════════════════════════════════════════════════════════
export const DEFAULT_PRICES = {
  anthropic: {
    //                            API out/1K   API in/1K   Effective₽   Price   Markup
    'claude-opus-4-6':            25.0,   // $0.075       $0.015       10.13    25.0    x2.5
    'claude-sonnet-4-6':           5.0,   // $0.015       $0.003        2.03     5.0    x2.5
    'claude-haiku-4-5-20251001':   1.5,   // $0.005       $0.001        0.68     1.5    x2.2
    'claude-3-5-sonnet-20241022':  5.0,   // $0.015       $0.003        2.03     5.0    x2.5
    'claude-3-5-haiku-20241022':   1.2,   // $0.004       $0.0008       0.54     1.2    x2.2
    _default:                      5.0,
  },
  openai: {
    'o3':           25.0,  // $0.080       $0.020       11.25    25.0    x2.2
    'o3-mini':       5.0,  // $0.014       $0.0028       1.89     5.0    x2.6
    'o4-mini':       5.0,  // $0.014       $0.0028       1.89     5.0    x2.6
    'gpt-4.1':       4.0,  // $0.008       $0.002        1.17     4.0    x3.4
    'gpt-4.1-mini':  0.6,  // $0.0016      $0.0004       0.23     0.6    x2.6
    'gpt-4.1-nano':  0.2,  // $0.0004      $0.0001       0.06     0.2    x3.3
    'gpt-4o':        4.0,  // $0.010       $0.0025       1.46     4.0    x2.7
    'gpt-4o-mini':   0.3,  // $0.0006      $0.00015      0.09     0.3    x3.3
    _default:        4.0,
  },
  gemini: {
    'gemini-2.5-pro-preview-05-06':   3.0,  // $0.010   $0.00125   1.18   3.0   x2.5
    'gemini-2.5-flash-preview-05-20': 0.3,  // $0.0006  $0.00015   0.09   0.3   x3.3
    'gemini-2.0-flash':               0.15, // $0.0004  $0.0001    0.06   0.15  x2.5
    _default:                         0.3,
  },
  deepseek: {
    'deepseek-chat':      0.4,   // $0.0011      $0.00027      0.16     0.4    x2.5
    'deepseek-reasoner':  0.8,   // $0.0022      $0.00055      0.32     0.8    x2.5
    _default:             0.4,
  },
  kimi: {
    'moonshot-v1-8k':    1.3,   // ¥12/1M in+out               0.53     1.3    x2.5
    'moonshot-v1-32k':   2.5,   // ¥24/1M in+out               1.05     2.5    x2.4
    'moonshot-v1-128k':  6.5,   // ¥60/1M in+out               2.63     6.5    x2.5
    _default:            1.3,
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
