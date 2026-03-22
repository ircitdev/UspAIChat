import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { createPayment, getPayment, isYookassaIP } from '../services/yookassa.js';
import { topupUser } from '../services/billing.js';

const router = Router();

// ─── Payment packages ──────────────────────────────────────────────────

function getPackages() {
  const db = getDB();
  const custom = db.prepare("SELECT value FROM settings WHERE key = 'payment_packages'").get();
  if (custom) {
    try { return JSON.parse(custom.value); } catch {}
  }
  return [
    { amount: 100,  credits: 100,  bonus: 0,    label: '100 ₽' },
    { amount: 500,  credits: 500,  bonus: 25,   label: '500 ₽' },
    { amount: 1000, credits: 1000, bonus: 100,  label: '1 000 ₽' },
    { amount: 5000, credits: 5000, bonus: 1000, label: '5 000 ₽' },
  ];
}

function getCreditsPerRuble() {
  const db = getDB();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'credits_per_ruble'").get();
  return row ? parseFloat(row.value) : parseFloat(process.env.CREDITS_PER_RUBLE || '1');
}

// ─── Calculate credits with promo ──────────────────────────────────────

function calculateCredits(amount, packageBonus, promoCode, userId) {
  const db = getDB();
  const rate = getCreditsPerRuble();
  let baseCredits = amount * rate;
  let promoBonus = 0;
  let promoId = null;

  if (promoCode) {
    const code = promoCode.toUpperCase().trim();
    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1').get(code);

    if (promo) {
      const now = Math.floor(Date.now() / 1000);
      const valid = (!promo.valid_from || now >= promo.valid_from)
                 && (!promo.valid_until || now <= promo.valid_until)
                 && (!promo.max_uses || promo.uses_count < promo.max_uses)
                 && amount >= promo.min_amount;

      if (valid) {
        // Check per-user limit
        const userUses = db.prepare('SELECT COUNT(*) as cnt FROM promo_uses WHERE promo_id = ? AND user_id = ?').get(promo.id, userId);
        if (userUses.cnt < promo.per_user_limit) {
          promoId = promo.id;
          switch (promo.type) {
            case 'bonus':
              promoBonus = baseCredits * (promo.value / 100);
              break;
            case 'discount':
              // Discount on price → more credits for same money
              promoBonus = baseCredits * (promo.value / 100);
              break;
            case 'fixed':
              promoBonus = promo.value;
              break;
          }
        }
      }
    }
  }

  return {
    baseCredits,
    packageBonus: packageBonus || 0,
    promoBonus,
    promoId,
    totalCredits: baseCredits + (packageBonus || 0) + promoBonus,
  };
}

// ─── Endpoints ─────────────────────────────────────────────────────────

// Get available packages
router.get('/packages', (req, res) => {
  res.json(getPackages());
});

// Create payment
router.post('/create', requireAuth, async (req, res) => {
  const { amount, promo_code } = req.body;
  if (!amount || amount < 10) return res.status(400).json({ error: 'Минимальная сумма 10 ₽' });

  const db = getDB();
  const packages = getPackages();
  const pkg = packages.find(p => p.amount === amount);
  const packageBonus = pkg?.bonus || 0;

  const calc = calculateCredits(amount, packageBonus, promo_code, req.userId);

  try {
    const paymentId = uuid();

    const yookassaPayment = await createPayment({
      amount,
      description: `Пополнение UspAIChat: ${calc.totalCredits.toFixed(0)} кредитов`,
      metadata: {
        payment_id: paymentId,
        user_id: req.userId,
      },
    });

    // Save pending payment
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO payments (id, yookassa_id, user_id, amount, credits, status, source, promo_code, promo_bonus, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', 'web', ?, ?, ?, ?)
    `).run(
      paymentId,
      yookassaPayment.id,
      req.userId,
      amount,
      calc.totalCredits,
      promo_code || null,
      calc.promoBonus,
      JSON.stringify({ package_bonus: packageBonus, promo_id: calc.promoId }),
      now
    );

    res.json({
      payment_id: paymentId,
      confirmation_url: yookassaPayment.confirmation.confirmation_url,
      credits: calc.totalCredits,
      base_credits: calc.baseCredits,
      package_bonus: calc.packageBonus,
      promo_bonus: calc.promoBonus,
    });
  } catch (err) {
    console.error('Payment create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Check payment status
router.get('/:id/status', requireAuth, (req, res) => {
  const db = getDB();
  const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json({
    status: payment.status,
    amount: payment.amount,
    credits: payment.credits,
    paid_at: payment.paid_at,
  });
});

// Payment history
router.get('/history', requireAuth, (req, res) => {
  const db = getDB();
  const limit = parseInt(req.query.limit) || 50;
  const payments = db.prepare(
    'SELECT id, amount, credits, status, source, promo_code, promo_bonus, created_at, paid_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(req.userId, limit);
  res.json(payments);
});

// ─── YooKassa Webhook ──────────────────────────────────────────────────

router.post('/webhook', (req, res) => {
  // Verify IP
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (!isYookassaIP(ip)) {
    console.warn('Webhook from unknown IP:', ip);
    // Still process in dev, but log warning
  }

  const { event, object } = req.body;
  if (!event || !object) return res.status(400).send('Bad request');

  const db = getDB();

  if (event === 'payment.succeeded') {
    const yookassaId = object.id;

    // Idempotency: check if already processed
    const payment = db.prepare('SELECT * FROM payments WHERE yookassa_id = ?').get(yookassaId);
    if (!payment) {
      console.warn('Webhook: payment not found:', yookassaId);
      return res.status(200).send('OK');
    }
    if (payment.status === 'succeeded') {
      return res.status(200).send('OK'); // Already processed
    }

    // Process payment
    db.transaction(() => {
      const now = Math.floor(Date.now() / 1000);

      // Update payment status
      db.prepare('UPDATE payments SET status = ?, paid_at = ? WHERE id = ?')
        .run('succeeded', now, payment.id);

      // Topup user balance
      topupUser(payment.user_id, payment.credits, null, `Пополнение ${payment.amount}₽ → ${payment.credits} кр.`);

      // Record promo use
      const meta = JSON.parse(payment.metadata || '{}');
      if (meta.promo_id) {
        db.prepare('INSERT INTO promo_uses (id, promo_id, user_id, payment_id, bonus_credits, used_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(uuid(), meta.promo_id, payment.user_id, payment.id, payment.promo_bonus, now);
        db.prepare('UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = ?').run(meta.promo_id);
      }

      // Referral bonus on first payment
      const user = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(payment.user_id);
      if (user?.referred_by) {
        const referral = db.prepare('SELECT * FROM referrals WHERE referred_id = ? AND bonus_paid = 0').get(payment.user_id);
        if (referral) {
          const referrerBonus = parseFloat(process.env.REFERRAL_BONUS_REFERRER || '50');
          const referralPercent = parseFloat(process.env.REFERRAL_PERCENT || '10');
          const percentBonus = payment.amount * (referralPercent / 100);
          const totalReferrerBonus = referrerBonus + percentBonus;

          // Pay referrer
          topupUser(referral.referrer_id, totalReferrerBonus, null, `Реферальный бонус (${payment.user_id})`);
          db.prepare('UPDATE users SET referral_earnings = referral_earnings + ? WHERE id = ?')
            .run(totalReferrerBonus, referral.referrer_id);

          // Mark as paid
          db.prepare('UPDATE referrals SET bonus_paid = 1, referrer_bonus = ? WHERE id = ?')
            .run(totalReferrerBonus, referral.id);
        }
      }
    })();

    console.log(`Payment succeeded: ${payment.id}, ${payment.credits} credits for user ${payment.user_id}`);
  } else if (event === 'payment.canceled') {
    const yookassaId = object.id;
    db.prepare('UPDATE payments SET status = ? WHERE yookassa_id = ? AND status = ?')
      .run('canceled', yookassaId, 'pending');
  }

  res.status(200).send('OK');
});

export default router;
