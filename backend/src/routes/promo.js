import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── User: check promo code ───────────────────────────────────────────

router.get('/check/:code', (req, res) => {
  const db = getDB();
  const code = req.params.code.toUpperCase().trim();
  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1').get(code);

  if (!promo) return res.json({ valid: false, error: 'Промо-код не найден' });

  const now = Math.floor(Date.now() / 1000);
  if (promo.valid_from && now < promo.valid_from) return res.json({ valid: false, error: 'Промо-код ещё не активен' });
  if (promo.valid_until && now > promo.valid_until) return res.json({ valid: false, error: 'Промо-код истёк' });
  if (promo.max_uses && promo.uses_count >= promo.max_uses) return res.json({ valid: false, error: 'Лимит использований исчерпан' });

  const userUses = db.prepare('SELECT COUNT(*) as cnt FROM promo_uses WHERE promo_id = ? AND user_id = ?').get(promo.id, req.userId);
  if (userUses.cnt >= promo.per_user_limit) return res.json({ valid: false, error: 'Вы уже использовали этот промо-код' });

  let description = '';
  switch (promo.type) {
    case 'bonus': description = `+${promo.value}% кредитов к пополнению`; break;
    case 'discount': description = `Скидка ${promo.value}% на пополнение`; break;
    case 'fixed': description = `+${promo.value} бесплатных кредитов`; break;
  }

  res.json({
    valid: true,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    description,
    min_amount: promo.min_amount,
  });
});

// ─── Admin: CRUD ──────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// List all promo codes
router.get('/', requireAdmin, (req, res) => {
  const db = getDB();
  const promos = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
  res.json(promos);
});

// Create promo code
router.post('/', requireAdmin, (req, res) => {
  const db = getDB();
  const {
    code,
    type = 'bonus',
    value,
    min_amount = 0,
    max_uses = null,
    per_user_limit = 1,
    valid_from = null,
    valid_until = null,
  } = req.body;

  if (!value || value <= 0) return res.status(400).json({ error: 'Value must be > 0' });

  const finalCode = (code || uuid().replace(/-/g, '').slice(0, 8)).toUpperCase();

  // Check uniqueness
  const existing = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(finalCode);
  if (existing) return res.status(400).json({ error: 'Код уже существует' });

  const id = uuid();
  db.prepare(`
    INSERT INTO promo_codes (id, code, type, value, min_amount, max_uses, per_user_limit, valid_from, valid_until, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, finalCode, type, value, min_amount, max_uses, per_user_limit, valid_from, valid_until, req.userId);

  res.json(db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id));
});

// Update promo code
router.put('/:id', requireAdmin, (req, res) => {
  const db = getDB();
  const promo = db.prepare('SELECT id FROM promo_codes WHERE id = ?').get(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Not found' });

  const { is_active, max_uses, per_user_limit, valid_until, value } = req.body;
  const fields = [];
  const values = [];
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }
  if (max_uses !== undefined) { fields.push('max_uses = ?'); values.push(max_uses); }
  if (per_user_limit !== undefined) { fields.push('per_user_limit = ?'); values.push(per_user_limit); }
  if (valid_until !== undefined) { fields.push('valid_until = ?'); values.push(valid_until); }
  if (value !== undefined) { fields.push('value = ?'); values.push(value); }

  if (fields.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE promo_codes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json(db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id));
});

// Delete promo code
router.delete('/:id', requireAdmin, (req, res) => {
  getDB().prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Promo stats
router.get('/:id/stats', requireAdmin, (req, res) => {
  const db = getDB();
  const uses = db.prepare(`
    SELECT pu.*, u.username, u.email
    FROM promo_uses pu
    JOIN users u ON u.id = pu.user_id
    WHERE pu.promo_id = ?
    ORDER BY pu.used_at DESC
  `).all(req.params.id);
  const totalBonus = uses.reduce((sum, u) => sum + (u.bonus_credits || 0), 0);
  res.json({ uses, total_uses: uses.length, total_bonus: totalBonus });
});

export default router;
