# Plan: Оплата через ЮKassa, промо-коды, реферальная система

## Обзор

Внедрение полноценной системы монетизации:
1. **ЮKassa** — оплата на сайте (redirect на страницу ЮKassa)
2. **Telegram Bot** — оплата через встроенные платежи Telegram (провайдер ЮKassa)
3. **Промо-коды** — скидки/бонусы при пополнении
4. **Реферальная система** — бонусы за привлечение пользователей

**Telegram Bot:** @UspAIChatbot (токен: `8768536572:AAFxkoZkQ1XucpfHkT1WMYRasCmaH7gMIwY`)

---

## Текущее состояние

- Баланс хранится в `users.balance` (REAL)
- Транзакции логируются в таблице `transactions` (topup/charge/refund)
- Пополнение только вручную через админку (`POST /admin/balance/topup`)
- Telegram-бот используется только для авторизации
- Нет интеграции с платёжными системами

---

## Архитектура платежей

```
┌─────────────────────────────────────────────────────┐
│                    Пользователь                     │
├──────────────────┬──────────────────────────────────┤
│   Web (сайт)     │       Mobile / Telegram          │
│                  │                                  │
│ Личный кабинет   │   @UspAIChatbot                  │
│ → Пополнить      │   /pay → Inline кнопка оплаты   │
│ → Промо-код      │   → Telegram Payments API        │
│ → Реф. ссылка    │   → ЮKassa как провайдер         │
├──────────────────┴──────────────────────────────────┤
│                Backend (Express.js)                  │
│                                                      │
│  POST /api/payments/create   — создать платёж        │
│  POST /api/payments/webhook  — webhook от ЮKassa     │
│  POST /api/promo/apply       — применить промо-код   │
│  GET  /api/referral/info     — реф. статистика       │
│  POST /api/referral/withdraw — вывод бонусов         │
│                                                      │
│  Telegram Bot:                                       │
│  /pay → sendInvoice()                                │
│  on('pre_checkout_query') → answerPreCheckoutQuery()  │
│  on('successful_payment') → topupUser()              │
├──────────────────────────────────────────────────────┤
│           ЮKassa API (api.yookassa.ru/v3)           │
│  Auth: Basic shopId:secretKey                        │
│  Webhooks: payment.succeeded, payment.canceled       │
└──────────────────────────────────────────────────────┘
```

---

## Фаза 1: База данных и модели (1 день)

### 1.1 Новые таблицы

**File:** `backend/src/db/database.js`

```sql
-- Платежи
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,                    -- UUID
  yookassa_id TEXT UNIQUE,                -- ID от ЮKassa (или Telegram payment_charge_id)
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,                   -- Сумма в рублях
  credits REAL NOT NULL,                  -- Сколько кредитов начислить
  status TEXT NOT NULL DEFAULT 'pending', -- pending|succeeded|canceled
  source TEXT NOT NULL DEFAULT 'web',     -- web|telegram
  promo_code TEXT,                        -- Использованный промо-код
  promo_bonus REAL DEFAULT 0,            -- Бонусные кредиты от промо
  metadata TEXT DEFAULT '{}',             -- JSON доп. данные
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  paid_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Промо-коды
CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,                    -- UUID
  code TEXT UNIQUE NOT NULL,              -- Сам код (UPPERCASE)
  type TEXT NOT NULL DEFAULT 'bonus',     -- bonus|discount|fixed
  value REAL NOT NULL,                    -- Значение (% бонуса, % скидки, или фикс. кредиты)
  min_amount REAL DEFAULT 0,             -- Минимальная сумма пополнения
  max_uses INTEGER DEFAULT NULL,         -- Лимит использований (NULL = безлимит)
  uses_count INTEGER DEFAULT 0,          -- Текущее кол-во использований
  per_user_limit INTEGER DEFAULT 1,      -- Сколько раз один пользователь может использовать
  valid_from INTEGER,                     -- Начало действия (unix)
  valid_until INTEGER,                    -- Конец действия (unix)
  is_active INTEGER DEFAULT 1,
  created_by TEXT,                        -- admin user_id
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Использование промо-кодов
CREATE TABLE IF NOT EXISTS promo_uses (
  id TEXT PRIMARY KEY,
  promo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payment_id TEXT,
  bonus_credits REAL DEFAULT 0,
  used_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (promo_id) REFERENCES promo_codes(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Реферальная система
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,              -- Кто пригласил
  referred_id TEXT NOT NULL UNIQUE,       -- Кого пригласили
  bonus_paid INTEGER DEFAULT 0,          -- Был ли начислен бонус
  referrer_bonus REAL DEFAULT 0,         -- Бонус пригласившему
  referred_bonus REAL DEFAULT 0,         -- Бонус приглашённому
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 1.2 Миграции для users

```sql
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;  -- Уникальный реф. код
ALTER TABLE users ADD COLUMN referred_by TEXT;            -- Кто пригласил
ALTER TABLE users ADD COLUMN referral_earnings REAL DEFAULT 0;  -- Накопленные бонусы
```

При регистрации генерировать `referral_code` = первые 8 символов UUID.

---

## Фаза 2: ЮKassa Backend (2-3 дня)

### 2.1 Конфигурация

**File:** `backend/.env`

```env
# ЮKassa
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
YOOKASSA_RETURN_URL=https://app.aifuturenow.ru/payment-success
YOOKASSA_WEBHOOK_SECRET=optional_webhook_secret

# Курс: 1 рубль = X кредитов (настраиваемый)
CREDITS_PER_RUBLE=1

# Реферальная система
REFERRAL_BONUS_REFERRER=50   # Кредитов пригласившему
REFERRAL_BONUS_REFERRED=25   # Кредитов приглашённому
REFERRAL_PERCENT=10           # % от первого пополнения реферала
```

### 2.2 Payment Service

**New file:** `backend/src/services/yookassa.js`

```js
// API: https://api.yookassa.ru/v3/payments
// Auth: Basic shopId:secretKey
// Idempotence-Key: UUID в каждом POST

export async function createPayment({ amount, userId, description, metadata, returnUrl })
  // POST /v3/payments
  // confirmation.type = 'redirect'
  // Returns: { id, confirmation.confirmation_url, status }

export async function getPayment(paymentId)
  // GET /v3/payments/{id}

export async function createRefund({ paymentId, amount, description })
  // POST /v3/refunds
```

### 2.3 Payment Routes

**New file:** `backend/src/routes/payments.js`

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/payments/packages` | Доступные пакеты пополнения (100₽, 500₽, 1000₽, 5000₽) |
| POST | `/api/payments/create` | Создать платёж → вернуть redirect URL |
| POST | `/api/payments/webhook` | Webhook от ЮKassa (payment.succeeded) |
| GET | `/api/payments/history` | История платежей пользователя |
| GET | `/api/payments/:id/status` | Проверить статус платежа |

**Пакеты пополнения (настраиваемые через settings):**

| Сумма | Кредиты | Бонус |
|-------|---------|-------|
| 100 ₽ | 100 кр. | — |
| 500 ₽ | 500 кр. | +25 кр. (5%) |
| 1000 ₽ | 1000 кр. | +100 кр. (10%) |
| 5000 ₽ | 5000 кр. | +1000 кр. (20%) |

### 2.4 Webhook Handler

```js
// POST /api/payments/webhook
// 1. Verify IP (185.71.76.0/27, 185.71.77.0/27)
// 2. Parse event: payment.succeeded / payment.canceled
// 3. Find payment by yookassa_id
// 4. If succeeded:
//    a. Calculate credits (amount * CREDITS_PER_RUBLE + package bonus)
//    b. Apply promo-code bonus (if any)
//    c. topupUser(userId, totalCredits)
//    d. Update payment status = 'succeeded'
//    e. Apply referral bonus (if first payment of referred user)
// 5. Return HTTP 200
```

### 2.5 Register routes

**File:** `backend/src/index.js`

```js
import paymentRoutes from './routes/payments.js';
import promoRoutes from './routes/promo.js';
import referralRoutes from './routes/referral.js';

app.use('/api/payments', paymentRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/referral', referralRoutes);
```

---

## Фаза 3: Telegram Bot — Оплата (2 дня)

### 3.1 Настройка провайдера

В BotFather:
1. `/mybots` → @UspAIChatbot → Payments
2. Выбрать ЮKassa
3. Ввести `shopId` и `secretKey`
4. Получить `provider_token`

**File:** `backend/.env`

```env
TELEGRAM_PAYMENT_TOKEN=provider_token_from_botfather
```

### 3.2 Команды бота

**File:** `backend/src/services/telegram.js`

Добавить:

```
/pay          — Пополнить баланс
/balance      — Проверить баланс
/promo <код>  — Применить промо-код
/ref          — Реферальная ссылка и статистика
```

### 3.3 /pay — отправка инвойса

```js
bot.onText(/\/pay/, async (msg) => {
  // Показать inline-кнопки с пакетами
  await bot.sendMessage(chatId, 'Выберите пакет:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '100 ₽ → 100 кр.', callback_data: 'pay_100' }],
        [{ text: '500 ₽ → 525 кр.', callback_data: 'pay_500' }],
        [{ text: '1000 ₽ → 1100 кр.', callback_data: 'pay_1000' }],
        [{ text: '5000 ₽ → 6000 кр.', callback_data: 'pay_5000' }],
      ]
    }
  });
});

// При выборе пакета:
bot.on('callback_query', async (query) => {
  if (query.data.startsWith('pay_')) {
    const amount = parseInt(query.data.split('_')[1]);
    await bot.sendInvoice(chatId, {
      title: `Пополнение ${amount} ₽`,
      description: `Начисление кредитов на баланс UspAIChat`,
      payload: JSON.stringify({ user_id, amount, promo_code }),
      provider_token: TELEGRAM_PAYMENT_TOKEN,
      currency: 'RUB',
      prices: [{ label: `${amount} кредитов`, amount: amount * 100 }], // В копейках!
    });
  }
});
```

### 3.4 Обработка платежа

```js
// Обязательно: ответить на pre_checkout_query за 10 секунд
bot.on('pre_checkout_query', async (query) => {
  const payload = JSON.parse(query.invoice_payload);
  // Проверить: пользователь существует, пакет валиден
  await bot.answerPreCheckoutQuery(query.id, true);
});

// Успешная оплата
bot.on('successful_payment', async (msg) => {
  const payment = msg.successful_payment;
  const payload = JSON.parse(payment.invoice_payload);

  // 1. Создать запись в payments (source = 'telegram')
  // 2. Начислить кредиты (topupUser)
  // 3. Применить промо-код если был
  // 4. Начислить реферальный бонус если первый платёж
  // 5. Отправить подтверждение

  await bot.sendMessage(chatId,
    `✅ Оплата ${amount} ₽ прошла успешно!\n` +
    `💰 Начислено: ${credits} кредитов\n` +
    `📊 Баланс: ${newBalance} кредитов`
  );
});
```

### 3.5 Привязка Telegram ID к аккаунту

Бот уже знает `telegram_id` из сообщения. Находим пользователя в БД по `telegram_id` и начисляем кредиты. Если пользователь не привязан — предлагаем пройти авторизацию.

---

## Фаза 4: Промо-коды (1-2 дня)

### 4.1 Admin Routes

**New file:** `backend/src/routes/promo.js`

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/api/promo` | admin | Список всех промо-кодов |
| POST | `/api/promo` | admin | Создать промо-код |
| PUT | `/api/promo/:id` | admin | Изменить промо-код |
| DELETE | `/api/promo/:id` | admin | Удалить промо-код |
| POST | `/api/promo/apply` | user | Применить промо-код при пополнении |
| GET | `/api/promo/check/:code` | user | Проверить промо-код (валидность, бонус) |

### 4.2 Типы промо-кодов

| Тип | Описание | Пример |
|-----|----------|--------|
| `bonus` | Дополнительные кредиты в % от пополнения | value=20 → +20% кредитов |
| `discount` | Скидка на пополнение в % | value=15 → платишь на 15% меньше |
| `fixed` | Фиксированное количество бесплатных кредитов | value=100 → +100 кредитов |

### 4.3 Логика применения

```js
// При создании платежа:
POST /api/payments/create { amount: 1000, promo_code: 'WELCOME20' }

// Backend:
1. Проверить промо-код: существует, активен, не истёк, лимит не исчерпан
2. Проверить per_user_limit: этот пользователь ещё может использовать
3. Проверить min_amount: сумма >= минимальной
4. Рассчитать бонус:
   - bonus:   credits = amount * CREDITS_PER_RUBLE * (1 + value/100)
   - discount: final_amount = amount * (1 - value/100), credits = final_amount * CREDITS_PER_RUBLE
   - fixed:   credits = amount * CREDITS_PER_RUBLE + value
5. Сохранить promo_code и promo_bonus в payment
6. После успешной оплаты: записать в promo_uses
```

### 4.4 Telegram Bot: промо-код

```
/promo WELCOME20
→ "Промо-код WELCOME20 активен! +20% к следующему пополнению."
→ При оплате через /pay автоматически применится
```

---

## Фаза 5: Реферальная система (2 дня)

### 5.1 Routes

**New file:** `backend/src/routes/referral.js`

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/referral/info` | Реф. код, ссылка, статистика |
| GET | `/api/referral/history` | Список приглашённых + статусы |
| POST | `/api/referral/withdraw` | Перевести бонусы на основной баланс |

### 5.2 Механика

1. **Каждый пользователь** получает уникальный `referral_code` при регистрации
2. **Реф. ссылка:** `https://app.aifuturenow.ru/?ref=CODE` или `https://t.me/UspAIChatbot?start=ref_CODE`
3. **При регистрации** нового пользователя по ссылке:
   - Сохраняем `referred_by = referrer_id` в users
   - Создаём запись в `referrals`
   - Начисляем **приглашённому**: `REFERRAL_BONUS_REFERRED` кредитов (25 по умолчанию)
4. **При первом пополнении** реферала:
   - Начисляем **пригласившему**: `REFERRAL_BONUS_REFERRER` кредитов (50 по умолчанию)
   - Плюс `REFERRAL_PERCENT`% от суммы первого пополнения реферала (10% по умолчанию)
   - Обновляем `referrals.bonus_paid = 1`
5. **Реферальные бонусы** копятся в `users.referral_earnings`
6. **Вывод:** переводятся на основной баланс по запросу (POST /referral/withdraw)

### 5.3 Интеграция в регистрацию

**Files:** `backend/src/routes/auth.js`, `backend/src/routes/authOAuth.js`, `backend/src/services/telegram.js`

При ЛЮБОЙ регистрации (Google, Apple, Telegram, Email) проверять:
- Query param `ref` или `referral` в URL
- Telegram deep-link: `/start ref_CODE`
- Если найден — сохранить связь и начислить бонус приглашённому

### 5.4 Telegram Bot

```
/ref
→ "🔗 Ваша реферальная ссылка:
   https://t.me/UspAIChatbot?start=ref_ABC12345

   👥 Приглашено: 5 человек
   💰 Заработано: 350 кредитов
   📊 Доступно к выводу: 150 кредитов

   За каждого друга: 50 кр. + 10% от его первого пополнения"
```

---

## Фаза 6: Frontend Web — Личный кабинет (2-3 дня)

### 6.1 Страница пополнения

**New file:** `frontend/src/components/PaymentModal.tsx`

- Выбор пакета (100/500/1000/5000 ₽) с визуализацией бонусов
- Поле ввода промо-кода с проверкой в реальном времени
- Показать итого: сумма, кредиты, бонус от промо, бонус от пакета
- Кнопка "Оплатить" → redirect на ЮKassa
- Страница возврата: `/payment-success` → проверить статус → показать результат

### 6.2 История платежей

**In:** ProfileModal или отдельная вкладка

- Таблица: дата, сумма, кредиты, промо-код, статус, источник (web/telegram)
- Фильтр по типу и датам

### 6.3 Реферальная панель

**In:** ProfileModal → новая вкладка "Рефералы"

- Реф. ссылка с кнопкой копирования
- QR-код ссылки
- Статистика: приглашено, заработано, доступно
- Кнопка "Вывести на баланс"
- Список приглашённых (имя, дата, статус бонуса)

### 6.4 Промо-код в Sidebar

- Иконка подарка рядом с балансом
- Клик → поле ввода промо-кода
- Применение → показать что будет бонус при пополнении

### 6.5 Кнопка "Пополнить" в Sidebar

В блоке баланса (рядом с "42.50 кр.") добавить кнопку "+" или "Пополнить" → открывает PaymentModal.

---

## Фаза 7: Admin UI — Управление платежами (1-2 дня)

### 7.1 Новые вкладки в AdminPanel

**Payments tab:**
- Все платежи: пользователь, сумма, кредиты, промо, статус, источник, дата
- Фильтры: по статусу, источнику, датам
- Общая статистика: выручка за день/неделю/месяц

**Promo tab:**
- Список промо-кодов: код, тип, значение, использований/лимит, статус
- Создание: код (авто или ручной), тип, значение, лимиты, срок
- Активация/деактивация
- Статистика по коду: кто использовал, сколько принесло

**Referral tab:**
- Топ рефереров: пользователь, кол-во приглашённых, заработано
- Общая конверсия: приглашено → зарегистрировалось → оплатило
- Настройки: бонусы, проценты (можно менять через settings)

---

## Фаза 8: Mobile — Оплата и рефералы (2 дня)

### 8.1 Оплата

В мобильном приложении оплата через Telegram Bot:
- В настройках/профиле: кнопка "Пополнить через Telegram"
- Открывает deep-link на @UspAIChatbot с командой /pay
- `url_launcher: tg://resolve?domain=UspAIChatbot&start=pay`

Или WebView с платёжной страницей ЮKassa (если хочется inline).

### 8.2 Промо-код

В профиле: поле ввода промо-кода → API `/api/promo/apply`

### 8.3 Реферальная ссылка

В профиле: реф. ссылка, кнопка "Поделиться" через `share_plus`

---

## Файлы: изменения и создание

### Новые файлы

| Файл | Описание |
|------|----------|
| `backend/src/services/yookassa.js` | ЮKassa API клиент |
| `backend/src/routes/payments.js` | Endpoints оплаты + webhook |
| `backend/src/routes/promo.js` | Промо-коды CRUD + apply |
| `backend/src/routes/referral.js` | Реферальная система |
| `frontend/src/components/PaymentModal.tsx` | Модал оплаты на сайте |
| `frontend/src/components/ReferralPanel.tsx` | Панель рефералов |
| `frontend/src/components/PromoInput.tsx` | Поле промо-кода |

### Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `backend/.env` | Добавить YOOKASSA_*, TELEGRAM_PAYMENT_TOKEN, REFERRAL_* |
| `backend/src/db/database.js` | Таблицы: payments, promo_codes, promo_uses, referrals + миграции users |
| `backend/src/index.js` | Подключить новые routes |
| `backend/src/services/telegram.js` | /pay, /balance, /promo, /ref, обработка платежей |
| `backend/src/routes/auth.js` | Referral при регистрации email |
| `backend/src/routes/authOAuth.js` | Referral при регистрации Google/Apple |
| `backend/src/routes/admin.js` | Вкладки: payments, promo, referrals |
| `frontend/src/components/Sidebar.tsx` | Кнопка "Пополнить" |
| `frontend/src/components/ProfileModal.tsx` | Вкладки: платежи, рефералы, промо |
| `frontend/src/components/AdminPanel.tsx` | Вкладки: платежи, промо, рефералы |
| `frontend/src/store/appStore.ts` | Payment state |
| `frontend/src/types/index.ts` | Payment, PromoCode, Referral типы |
| `mobile/lib/presentation/screens/profile/profile_screen.dart` | Оплата, промо, рефералы |

---

## Переменные окружения (.env)

```env
# ЮKassa
YOOKASSA_SHOP_ID=              # ID магазина
YOOKASSA_SECRET_KEY=           # Секретный ключ API
YOOKASSA_RETURN_URL=https://app.aifuturenow.ru/payment-success

# Telegram Bot Payments
TELEGRAM_PAYMENT_TOKEN=        # Токен от BotFather → Payments → ЮKassa

# Биллинг
CREDITS_PER_RUBLE=1            # Курс: 1₽ = 1 кредит

# Реферальная система
REFERRAL_BONUS_REFERRER=50     # Бонус пригласившему (кредиты)
REFERRAL_BONUS_REFERRED=25     # Бонус приглашённому (кредиты)
REFERRAL_PERCENT=10            # % от первого пополнения реферала
```

---

## Безопасность

1. **Webhook ЮKassa:** проверка IP (185.71.76.0/27, 185.71.77.0/27), идемпотентность
2. **Telegram payments:** проверка `pre_checkout_query` за 10 сек, верификация payload
3. **Промо-коды:** per_user_limit, rate-limiting, case-insensitive
4. **Рефералы:** защита от self-referral, проверка уникальности referred_id
5. **Атомарные транзакции:** все начисления через SQLite transactions
6. **Логирование:** каждый платёж и начисление в transactions с полным audit trail

---

## Timeline

| Фаза | Дни | Описание |
|------|-----|----------|
| 1 | 1 | БД: таблицы, миграции |
| 2 | 2-3 | ЮKassa backend: сервис, routes, webhook |
| 3 | 2 | Telegram bot: /pay, sendInvoice, successful_payment |
| 4 | 1-2 | Промо-коды: CRUD, apply, валидация |
| 5 | 2 | Рефералы: регистрация, бонусы, вывод |
| 6 | 2-3 | Frontend web: PaymentModal, рефералы, промо |
| 7 | 1-2 | Admin UI: платежи, промо, рефералы |
| 8 | 2 | Mobile: оплата через TG, промо, рефералы |
| **Итого** | **13-17 дней** | |

---

## Тестирование

1. **ЮKassa тестовый режим:** использовать тестовые ключи (test_*)
2. **Telegram тестовые платежи:** BotFather выдаёт тестовый provider_token
3. **Тест-кейсы:**
   - Успешная оплата web → кредиты зачислены
   - Успешная оплата Telegram → кредиты зачислены
   - Отменённый платёж → кредиты НЕ зачислены
   - Промо-код: валидный, истёкший, превышен лимит, уже использован
   - Реферал: регистрация по ссылке, бонус при первом пополнении
   - Двойной webhook → идемпотентность (кредиты не удваиваются)
   - Пользователь не привязан к Telegram → сообщение об ошибке
