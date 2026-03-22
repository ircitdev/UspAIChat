import { Router } from 'express';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { topupUser } from '../services/billing.js';

const router = Router();
router.use(requireAuth);

// Get referral info + stats
router.get('/info', (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT referral_code, referral_earnings FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_referred,
      SUM(CASE WHEN bonus_paid = 1 THEN 1 ELSE 0 END) as paid_referrals,
      SUM(referrer_bonus) as total_earned
    FROM referrals WHERE referrer_id = ?
  `).get(req.userId);

  const referralBonusReferrer = parseFloat(process.env.REFERRAL_BONUS_REFERRER || '50');
  const referralBonusReferred = parseFloat(process.env.REFERRAL_BONUS_REFERRED || '25');
  const referralPercent = parseFloat(process.env.REFERRAL_PERCENT || '10');

  res.json({
    referral_code: user.referral_code,
    referral_link: `https://app.aifuturenow.ru/?ref=${user.referral_code}`,
    telegram_link: `https://t.me/UspAIChatbot?start=ref_${user.referral_code}`,
    total_referred: stats.total_referred || 0,
    paid_referrals: stats.paid_referrals || 0,
    total_earned: stats.total_earned || 0,
    available_earnings: user.referral_earnings || 0,
    bonus_referrer: referralBonusReferrer,
    bonus_referred: referralBonusReferred,
    bonus_percent: referralPercent,
  });
});

// Referral history
router.get('/history', (req, res) => {
  const db = getDB();
  const referrals = db.prepare(`
    SELECT r.*, u.username, u.created_at as user_registered_at
    FROM referrals r
    JOIN users u ON u.id = r.referred_id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
  `).all(req.userId);
  res.json(referrals);
});

// Withdraw referral earnings to main balance
router.post('/withdraw', (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT referral_earnings FROM users WHERE id = ?').get(req.userId);
  if (!user || !user.referral_earnings || user.referral_earnings <= 0) {
    return res.status(400).json({ error: 'Нет доступных средств для вывода' });
  }

  const amount = user.referral_earnings;

  db.transaction(() => {
    topupUser(req.userId, amount, null, 'Вывод реферальных бонусов');
    db.prepare('UPDATE users SET referral_earnings = 0 WHERE id = ?').run(req.userId);
  })();

  const updated = db.prepare('SELECT balance, referral_earnings FROM users WHERE id = ?').get(req.userId);
  res.json({
    success: true,
    withdrawn: amount,
    balance: updated.balance,
    referral_earnings: updated.referral_earnings,
  });
});

export default router;
