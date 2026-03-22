import TelegramBot from 'node-telegram-bot-api';
import { getDB } from '../db/database.js';
import { topupUser } from './billing.js';
import { v4 as uuid } from 'uuid';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8768536572:AAFxkoZkQ1XucpfHkT1WMYRasCmaH7gMIwY';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'UspAIChatbot';
const PAYMENT_TOKEN = process.env.TELEGRAM_PAYMENT_TOKEN || '';

// Payment packages (amount in RUB, credits)
const PACKAGES = [
  { amount: 100,  credits: 100,  bonus: 0,    label: '100 ₽ → 100 кр.' },
  { amount: 500,  credits: 500,  bonus: 25,   label: '500 ₽ → 525 кр.' },
  { amount: 1000, credits: 1000, bonus: 100,  label: '1000 ₽ → 1100 кр.' },
  { amount: 5000, credits: 5000, bonus: 1000, label: '5000 ₽ → 6000 кр.' },
];

let bot = null;

// Per-user active promo code (in-memory, for Telegram payment flow)
const userPromos = new Map();

export function getBot() { return bot; }
export function getBotUsername() { return BOT_USERNAME; }

function findUserByTelegramId(telegramId) {
  return getDB().prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

function generateReferralCode(userId) {
  return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

// ─── Process referral on registration ─────────────────────────────────

function processReferral(newUserId, referralCode) {
  const db = getDB();
  if (!referralCode) return;
  const code = referralCode.toUpperCase();
  const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ? AND id != ?').get(code, newUserId);
  if (!referrer) return;

  // Check not already referred
  const existing = db.prepare('SELECT id FROM referrals WHERE referred_id = ?').get(newUserId);
  if (existing) return;

  const referredBonus = parseFloat(process.env.REFERRAL_BONUS_REFERRED || '25');

  db.transaction(() => {
    db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, newUserId);
    db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, referred_bonus, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), referrer.id, newUserId, referredBonus, Math.floor(Date.now() / 1000));

    // Give bonus to referred user
    if (referredBonus > 0) {
      topupUser(newUserId, referredBonus, null, 'Бонус за регистрацию по реферальной ссылке');
    }
  })();
}

export { processReferral };

export function startBot() {
  if (bot) return bot;

  bot = new TelegramBot(TOKEN, { polling: true });

  // ─── /start ─────────────────────────────────────────────────────────

  bot.on('message', async (msg) => {
    // Skip non-text messages and payment-related messages
    if (!msg.text) return;
    if (msg.successful_payment) return;

    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text.trim();

    // ── /start with referral deep-link ──
    if (text.startsWith('/start ref_')) {
      const refCode = text.slice(11).trim();
      const user = findUserByTelegramId(telegramId);
      if (user) {
        await bot.sendMessage(chatId, '👋 Вы уже зарегистрированы! Используйте /pay для пополнения.', { parse_mode: 'Markdown' });
      } else {
        // Store ref code for when they register via auth code
        // It will be used when they send the 6-digit code
        userPromos.set(`ref_${telegramId}`, refCode);
        await bot.sendMessage(chatId,
          `👋 Добро пожаловать в *UspAIChat*!\n\n` +
          `Вы пришли по реферальной ссылке. При регистрации вы получите *бонусные кредиты*!\n\n` +
          `Чтобы зарегистрироваться:\n` +
          `1. Откройте приложение\n` +
          `2. Нажмите «Войти через Telegram»\n` +
          `3. Отправьте мне полученный 6-значный код`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // ── /pay ──
    if (text === '/pay') {
      const user = findUserByTelegramId(telegramId);
      if (!user) {
        await bot.sendMessage(chatId, '❌ Вы не зарегистрированы. Войдите через приложение.');
        return;
      }
      if (!PAYMENT_TOKEN) {
        await bot.sendMessage(chatId, '⚠️ Оплата через Telegram временно недоступна. Оплатите на сайте: https://app.aifuturenow.ru');
        return;
      }

      const activePromo = userPromos.get(`promo_${telegramId}`);
      const promoText = activePromo ? `\n🎁 Промо-код: *${activePromo}*` : '';

      await bot.sendMessage(chatId, `💰 Выберите пакет для пополнения:${promoText}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: PACKAGES.map(p => ([{
            text: p.label,
            callback_data: `pay_${p.amount}`,
          }])),
        },
      });
      return;
    }

    // ── /balance ──
    if (text === '/balance') {
      const user = findUserByTelegramId(telegramId);
      if (!user) {
        await bot.sendMessage(chatId, '❌ Вы не зарегистрированы.');
        return;
      }
      await bot.sendMessage(chatId,
        `💰 *Ваш баланс:* ${user.balance.toFixed(2)} кредитов\n` +
        `🎁 *Реферальные бонусы:* ${(user.referral_earnings || 0).toFixed(2)} кредитов`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ── /promo CODE ──
    if (text.startsWith('/promo')) {
      const code = text.slice(6).trim().toUpperCase();
      if (!code) {
        await bot.sendMessage(chatId, '📝 Используйте: /promo КОД\nПример: /promo WELCOME20');
        return;
      }
      const user = findUserByTelegramId(telegramId);
      if (!user) {
        await bot.sendMessage(chatId, '❌ Вы не зарегистрированы.');
        return;
      }

      const db = getDB();
      const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1').get(code);
      if (!promo) {
        await bot.sendMessage(chatId, '❌ Промо-код не найден или недействителен.');
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      if (promo.valid_until && now > promo.valid_until) {
        await bot.sendMessage(chatId, '❌ Промо-код истёк.');
        return;
      }
      if (promo.max_uses && promo.uses_count >= promo.max_uses) {
        await bot.sendMessage(chatId, '❌ Лимит использований промо-кода исчерпан.');
        return;
      }

      const userUses = db.prepare('SELECT COUNT(*) as cnt FROM promo_uses WHERE promo_id = ? AND user_id = ?').get(promo.id, user.id);
      if (userUses.cnt >= promo.per_user_limit) {
        await bot.sendMessage(chatId, '❌ Вы уже использовали этот промо-код.');
        return;
      }

      // Save active promo for this user
      userPromos.set(`promo_${telegramId}`, code);

      let desc = '';
      switch (promo.type) {
        case 'bonus': desc = `+${promo.value}% кредитов к пополнению`; break;
        case 'discount': desc = `Скидка ${promo.value}%`; break;
        case 'fixed': desc = `+${promo.value} бесплатных кредитов`; break;
      }

      await bot.sendMessage(chatId,
        `✅ Промо-код *${code}* активирован!\n${desc}\n\nИспользуйте /pay для пополнения с промо-кодом.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ── /ref ──
    if (text === '/ref') {
      const user = findUserByTelegramId(telegramId);
      if (!user) {
        await bot.sendMessage(chatId, '❌ Вы не зарегистрированы.');
        return;
      }

      const db = getDB();
      if (!user.referral_code) {
        const code = generateReferralCode(user.id);
        db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, user.id);
        user.referral_code = code;
      }

      const stats = db.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN bonus_paid = 1 THEN 1 ELSE 0 END) as paid, SUM(referrer_bonus) as earned
        FROM referrals WHERE referrer_id = ?
      `).get(user.id);

      const bonusR = process.env.REFERRAL_BONUS_REFERRER || '50';
      const bonusPct = process.env.REFERRAL_PERCENT || '10';

      await bot.sendMessage(chatId,
        `🔗 *Ваша реферальная ссылка:*\nhttps://t.me/UspAIChatbot?start=ref\\_${user.referral_code}\n\n` +
        `👥 Приглашено: *${stats.total || 0}* человек\n` +
        `💰 Заработано: *${(stats.earned || 0).toFixed(0)}* кредитов\n` +
        `📊 Доступно: *${(user.referral_earnings || 0).toFixed(0)}* кредитов\n\n` +
        `За каждого друга: *${bonusR}* кр. + *${bonusPct}%* от его первого пополнения`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ── Auth code (6 digits) or /start CODE ──
    let code = null;
    if (text.startsWith('/start ')) {
      code = text.slice(7).trim();
    } else if (/^\d{6}$/.test(text)) {
      code = text;
    } else if (text === '/start') {
      await bot.sendMessage(chatId,
        `👋 Привет! Я бот *UspAIChat*.\n\n` +
        `📋 *Команды:*\n` +
        `/pay — Пополнить баланс\n` +
        `/balance — Проверить баланс\n` +
        `/promo КОД — Активировать промо-код\n` +
        `/ref — Реферальная ссылка\n\n` +
        `Чтобы войти в приложение:\n` +
        `1. Откройте приложение\n` +
        `2. Нажмите «Войти через Telegram»\n` +
        `3. Отправьте мне 6-значный код`,
        { parse_mode: 'Markdown' }
      );
      return;
    } else if (text.startsWith('/')) {
      // Unknown command
      await bot.sendMessage(chatId, '❓ Неизвестная команда. Используйте /start для списка команд.');
      return;
    } else {
      await bot.sendMessage(chatId, '❓ Отправьте 6-значный код из приложения или команду.');
      return;
    }

    if (!code) return;

    const db = getDB();
    const now = Math.floor(Date.now() / 1000);

    // Find pending auth code
    const authCode = db.prepare(
      `SELECT * FROM telegram_auth_codes WHERE code = ? AND status = 'pending' AND expires_at > ?`
    ).get(code, now);

    if (!authCode) {
      await bot.sendMessage(chatId, '❌ Код неверный или истёк. Запросите новый код в приложении.');
      return;
    }

    const displayName = msg.from.first_name || msg.from.username || 'пользователь';

    // ── LINK flow ──
    if (authCode.type === 'link') {
      const existing = db.prepare('SELECT id FROM users WHERE telegram_id = ? AND id != ?').get(telegramId, authCode.user_id);
      if (existing) {
        await bot.sendMessage(chatId, '⚠️ Этот Telegram-аккаунт уже привязан к другому пользователю.');
        return;
      }
      db.prepare('UPDATE users SET telegram_id = ?, telegram_username = ?, updated_at = ? WHERE id = ?')
        .run(telegramId, msg.from.username || null, now, authCode.user_id);
      db.prepare(`UPDATE telegram_auth_codes SET status = 'confirmed', telegram_id = ? WHERE code = ?`)
        .run(telegramId, code);
      await bot.sendMessage(chatId,
        `✅ *Telegram успешно привязан!*\n\nПривет, *${displayName}*! Вернитесь в приложение.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ── LOGIN flow ──
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);

    if (!user) {
      const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
      const role = userCount.cnt === 0 ? 'admin' : 'user';
      const userId = uuid();
      const tgName = msg.from.username
        ? `@${msg.from.username}`
        : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || `tg_${telegramId}`;
      const refCode = generateReferralCode(userId);

      db.prepare(`
        INSERT INTO users (id, username, telegram_id, telegram_username, role, referral_code, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, tgName, telegramId, msg.from.username || null, role, refCode, now, now);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      console.log(`🤖 New Telegram user: ${tgName} (${telegramId}), role: ${role}`);

      // Process referral if came from ref link
      const pendingRef = userPromos.get(`ref_${telegramId}`);
      if (pendingRef) {
        processReferral(userId, pendingRef);
        userPromos.delete(`ref_${telegramId}`);
      }
    }

    if (user.is_blocked) {
      await bot.sendMessage(chatId, '🚫 Ваш аккаунт заблокирован.');
      return;
    }

    db.prepare('UPDATE users SET telegram_id = ?, telegram_username = ?, updated_at = ? WHERE id = ?')
      .run(telegramId, msg.from.username || null, now, user.id);
    db.prepare(
      `UPDATE telegram_auth_codes SET status = 'confirmed', user_id = ?, telegram_id = ? WHERE code = ?`
    ).run(user.id, telegramId, code);

    await bot.sendMessage(chatId,
      `✅ *Вход выполнен!*\n\nДобро пожаловать, *${displayName}*! Вернитесь в приложение.`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── Callback queries (pay buttons) ─────────────────────────────────

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    if (!query.data?.startsWith('pay_')) return;

    const amount = parseInt(query.data.split('_')[1]);
    const pkg = PACKAGES.find(p => p.amount === amount);
    if (!pkg) return;

    const user = findUserByTelegramId(telegramId);
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: 'Вы не зарегистрированы', show_alert: true });
      return;
    }

    if (!PAYMENT_TOKEN) {
      await bot.answerCallbackQuery(query.id, { text: 'Оплата недоступна', show_alert: true });
      return;
    }

    const promoCode = userPromos.get(`promo_${telegramId}`) || null;
    let totalCredits = pkg.credits + pkg.bonus;
    let promoBonus = 0;

    // Apply promo
    if (promoCode) {
      const db = getDB();
      const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1').get(promoCode);
      if (promo) {
        switch (promo.type) {
          case 'bonus': promoBonus = pkg.credits * (promo.value / 100); break;
          case 'discount': promoBonus = pkg.credits * (promo.value / 100); break;
          case 'fixed': promoBonus = promo.value; break;
        }
        totalCredits += promoBonus;
      }
    }

    const paymentId = uuid();

    try {
      await bot.sendInvoice(chatId, `Пополнение ${amount} ₽`, `Начисление ${Math.round(totalCredits)} кредитов на баланс UspAIChat`, JSON.stringify({
        payment_id: paymentId,
        user_id: user.id,
        amount,
        credits: totalCredits,
        promo_code: promoCode,
        promo_bonus: promoBonus,
        package_bonus: pkg.bonus,
      }), PAYMENT_TOKEN, 'RUB', [{
        label: `${pkg.credits} кредитов`,
        amount: amount * 100, // kopecks
      }]);

      await bot.answerCallbackQuery(query.id);
    } catch (err) {
      console.error('SendInvoice error:', err);
      await bot.answerCallbackQuery(query.id, { text: 'Ошибка создания платежа', show_alert: true });
    }
  });

  // ─── Pre-checkout query ─────────────────────────────────────────────

  bot.on('pre_checkout_query', async (query) => {
    try {
      const payload = JSON.parse(query.invoice_payload);
      const user = getDB().prepare('SELECT id FROM users WHERE id = ?').get(payload.user_id);
      if (!user) {
        await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Пользователь не найден' });
        return;
      }
      await bot.answerPreCheckoutQuery(query.id, true);
    } catch (err) {
      console.error('PreCheckout error:', err);
      await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Ошибка проверки' });
    }
  });

  // ─── Successful payment ─────────────────────────────────────────────

  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;

    const chatId = msg.chat.id;
    const payment = msg.successful_payment;
    let payload;
    try { payload = JSON.parse(payment.invoice_payload); } catch { return; }

    const db = getDB();
    const now = Math.floor(Date.now() / 1000);

    try {
      db.transaction(() => {
        // Save payment record
        db.prepare(`
          INSERT INTO payments (id, yookassa_id, user_id, amount, credits, status, source, promo_code, promo_bonus, metadata, created_at, paid_at)
          VALUES (?, ?, ?, ?, ?, 'succeeded', 'telegram', ?, ?, ?, ?, ?)
        `).run(
          payload.payment_id,
          payment.provider_payment_charge_id || payment.telegram_payment_charge_id,
          payload.user_id,
          payload.amount,
          payload.credits,
          payload.promo_code || null,
          payload.promo_bonus || 0,
          JSON.stringify({ package_bonus: payload.package_bonus, telegram_charge_id: payment.telegram_payment_charge_id }),
          now, now
        );

        // Topup user
        topupUser(payload.user_id, payload.credits, null, `Пополнение через Telegram: ${payload.amount}₽ → ${Math.round(payload.credits)} кр.`);

        // Promo use
        if (payload.promo_code) {
          const promo = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(payload.promo_code);
          if (promo) {
            db.prepare('INSERT INTO promo_uses (id, promo_id, user_id, payment_id, bonus_credits, used_at) VALUES (?, ?, ?, ?, ?, ?)')
              .run(uuid(), promo.id, payload.user_id, payload.payment_id, payload.promo_bonus, now);
            db.prepare('UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = ?').run(promo.id);
          }
          // Clear user promo
          userPromos.delete(`promo_${msg.from.id}`);
        }

        // Referral bonus on first payment
        const user = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(payload.user_id);
        if (user?.referred_by) {
          const referral = db.prepare('SELECT * FROM referrals WHERE referred_id = ? AND bonus_paid = 0').get(payload.user_id);
          if (referral) {
            const referrerBonus = parseFloat(process.env.REFERRAL_BONUS_REFERRER || '50');
            const referralPercent = parseFloat(process.env.REFERRAL_PERCENT || '10');
            const percentBonus = payload.amount * (referralPercent / 100);
            const totalBonus = referrerBonus + percentBonus;

            topupUser(referral.referrer_id, totalBonus, null, `Реферальный бонус`);
            db.prepare('UPDATE users SET referral_earnings = referral_earnings + ? WHERE id = ?').run(totalBonus, referral.referrer_id);
            db.prepare('UPDATE referrals SET bonus_paid = 1, referrer_bonus = ? WHERE id = ?').run(totalBonus, referral.id);
          }
        }
      })();

      const updatedUser = db.prepare('SELECT balance FROM users WHERE id = ?').get(payload.user_id);

      await bot.sendMessage(chatId,
        `✅ *Оплата прошла успешно!*\n\n` +
        `💳 Сумма: ${payload.amount} ₽\n` +
        `💰 Начислено: ${Math.round(payload.credits)} кредитов\n` +
        (payload.promo_bonus > 0 ? `🎁 Бонус по промо: +${Math.round(payload.promo_bonus)} кр.\n` : '') +
        `📊 Баланс: ${updatedUser.balance.toFixed(2)} кредитов`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Payment processing error:', err);
      await bot.sendMessage(chatId, '⚠️ Оплата получена, но произошла ошибка начисления. Обратитесь в поддержку.');
    }
  });

  bot.on('polling_error', (err) => {
    console.error('Telegram polling error:', err.message);
  });

  console.log(`🤖 Telegram bot @${BOT_USERNAME} started`);
  return bot;
}
