import TelegramBot from 'node-telegram-bot-api';
import { getDB } from '../db/database.js';
import { v4 as uuid } from 'uuid';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8768536572:AAFxkoZkQ1XucpfHkT1WMYRasCmaH7gMIwY';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'UspAIChatbot';

let bot = null;

export function getBot() { return bot; }
export function getBotUsername() { return BOT_USERNAME; }

export function startBot() {
  if (bot) return bot;

  bot = new TelegramBot(TOKEN, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = (msg.text || '').trim();

    // Handle /start [code] or just a 6-digit code
    let code = null;
    if (text.startsWith('/start ')) {
      code = text.slice(7).trim();
    } else if (/^\d{6}$/.test(text)) {
      code = text;
    } else if (text === '/start') {
      await bot.sendMessage(chatId,
        `👋 Привет! Я бот *UspAIChat*.\n\n` +
        `Чтобы войти или зарегистрироваться в приложении:\n` +
        `1. Откройте приложение\n` +
        `2. Нажмите «Войти через Telegram»\n` +
        `3. Отправьте мне полученный 6-значный код`,
        { parse_mode: 'Markdown' }
      );
      return;
    } else {
      await bot.sendMessage(chatId, '❓ Отправьте 6-значный код из приложения UspAIChat.');
      return;
    }

    if (!code) return;

    const db = getDB();
    const now = Math.floor(Date.now() / 1000);

    // Find pending code
    const authCode = db.prepare(
      `SELECT * FROM telegram_auth_codes WHERE code = ? AND status = 'pending' AND expires_at > ?`
    ).get(code, now);

    if (!authCode) {
      await bot.sendMessage(chatId, '❌ Код неверный или истёк. Запросите новый код в приложении.');
      return;
    }

    const displayName = msg.from.first_name || msg.from.username || 'пользователь';

    // ── LINK flow: attach telegram to an existing email account ──
    if (authCode.type === 'link') {
      // Check if this telegram_id is already used by another account
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
        `✅ *Telegram успешно привязан!*\n\nПривет, *${displayName}*! Ваш аккаунт привязан. Вернитесь в приложение.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ── LOGIN flow ──
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);

    if (!user) {
      // New user via Telegram
      const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
      const role = userCount.cnt === 0 ? 'admin' : 'user';
      const userId = uuid();
      const tgName = msg.from.username
        ? `@${msg.from.username}`
        : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || `tg_${telegramId}`;

      db.prepare(`
        INSERT INTO users (id, username, telegram_id, telegram_username, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, tgName, telegramId, msg.from.username || null, role, now, now);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      console.log(`🤖 New Telegram user: ${tgName} (${telegramId}), role: ${role}`);
    }

    if (user.is_blocked) {
      await bot.sendMessage(chatId, '🚫 Ваш аккаунт заблокирован. Обратитесь к администратору.');
      return;
    }

    // Update telegram info if changed
    db.prepare('UPDATE users SET telegram_id = ?, telegram_username = ?, updated_at = ? WHERE id = ?')
      .run(telegramId, msg.from.username || null, now, user.id);

    // Confirm code → link to user_id and telegram_id
    db.prepare(
      `UPDATE telegram_auth_codes SET status = 'confirmed', user_id = ?, telegram_id = ? WHERE code = ?`
    ).run(user.id, telegramId, code);

    await bot.sendMessage(chatId,
      `✅ *Вход выполнен успешно!*\n\nДобро пожаловать, *${displayName}*! Вернитесь в приложение.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('polling_error', (err) => {
    console.error('Telegram polling error:', err.message);
  });

  console.log(`🤖 Telegram bot @${BOT_USERNAME} started`);
  return bot;
}
