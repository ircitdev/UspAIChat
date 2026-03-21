# UspAIChat — AI Чат-приложение

Полнофункциональное AI чат-приложение с поддержкой нескольких провайдеров (Anthropic Claude, OpenAI, Google Gemini, DeepSeek, Kimi), системой аутентификации (Email, Google, Apple, Telegram), балансовой системой оплаты, панелью администратора и полнотекстовым поиском.

---

## Содержание

1. [Описание проекта](#описание-проекта)
2. [Технологический стек](#технологический-стек)
3. [Структура проекта](#структура-проекта)
4. [Установка и запуск](#установка-и-запуск)
5. [Переменные окружения (.env)](#переменные-окружения-env)
6. [Схема базы данных](#схема-базы-данных)
7. [API Reference](#api-reference)
8. [Потоки аутентификации](#потоки-аутентификации)
9. [Провайдеры AI и модели](#провайдеры-ai-и-модели)
10. [Биллинговая система](#биллинговая-система)
11. [Компоненты фронтенда](#компоненты-фронтенда)
12. [Горячие клавиши](#горячие-клавиши)

---

## Описание проекта

**UspAIChat** — self-hosted веб-приложение для общения с несколькими AI-провайдерами через единый интерфейс. Приложение хранит все данные локально в SQLite и не требует внешних облачных сервисов кроме самих AI API.

### Ключевые возможности

- **Мультипровайдерный чат** — Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek, Kimi (Moonshot AI)
- **Потоковая передача ответов** — Server-Sent Events (SSE) для вывода ответа в реальном времени
- **Вложения** — изображения (base64 vision), PDF, DOCX, TXT, MD, код-файлы
- **Системный промпт** — задаётся на уровне отдельного разговора; встроенные шаблоны персонажей
- **Полнотекстовый поиск** — FTS5 по всем сообщениям всех разговоров
- **Четыре способа входа** — Google OAuth, Apple Sign-In, Telegram-бот, Email+пароль
- **Биллинг** — кредитный баланс, автосписание за токены, пополнение через панель администратора
- **Панель администратора** — статистика, управление пользователями, глобальные API-ключи
- **Тёмный UI** — тёмная цветовая схема, адаптивный дизайн
- **i18n** — русский, английский, китайский языки интерфейса
- **Горячие клавиши** — навигация без мыши

---

## Технологический стек

### Backend

| Технология | Версия | Назначение |
|---|---|---|
| Node.js | 18+ | Среда выполнения |
| Express | ^4.18 | HTTP-сервер и маршрутизация |
| better-sqlite3 | ^9.4 | Встроенная база данных SQLite (WAL) |
| jsonwebtoken | ^9.0 | JWT access tokens (15 минут) |
| bcryptjs | ^3.0 | Хэширование паролей (cost=12) |
| uuid | ^9.0 | Генерация UUID v4 |
| @anthropic-ai/sdk | ^0.17 | Anthropic Claude API |
| openai | ^4.28 | OpenAI API (также для DeepSeek и Kimi) |
| @google/generative-ai | ^0.2 | Google Gemini API |
| google-auth-library | latest | Верификация Google ID-токенов |
| node-telegram-bot-api | ^0.67 | Telegram Bot (polling) |
| multer | ^1.4.5 | Загрузка файлов |
| pdf-parse | ^1.1 | Извлечение текста из PDF |
| mammoth | ^1.6 | Извлечение текста из DOCX |
| tiktoken | ^1.0 | Подсчёт токенов |

### Frontend

| Технология | Версия | Назначение |
|---|---|---|
| React | ^18.3 | UI-фреймворк |
| TypeScript | ^5.3 | Типизация |
| Vite | ^5.1 | Сборщик и dev-сервер |
| Zustand | ^4.5 | Глобальное состояние |
| Axios | ^1.6 | HTTP-клиент |
| Tailwind CSS | ^3.4 | Утилитарные CSS-стили |
| framer-motion | ^11.0 | Анимации |
| react-markdown | ^9.0 | Рендеринг Markdown |
| react-syntax-highlighter | ^15.5 | Подсветка синтаксиса кода |
| react-hotkeys-hook | ^4.5 | Горячие клавиши |
| react-i18next | ^14.0 | Интернационализация |
| lucide-react | ^0.316 | Иконки |

---

## Структура проекта

```
uspaichat/
├── package.json                  # Root: скрипты dev/build
├── .gitignore
├── README.md
│
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js              # Точка входа, Express app
│       ├── db/
│       │   └── database.js       # SQLite, схема таблиц, миграции
│       ├── middleware/
│       │   └── auth.js           # requireAuth, requireAdmin
│       ├── routes/
│       │   ├── auth.js           # Email/пароль, set-password
│       │   ├── authOAuth.js      # Google OAuth, Apple Sign-In
│       │   ├── authTelegram.js   # Telegram-бот авторизация
│       │   ├── chat.js           # POST /chat/stream (SSE)
│       │   ├── conversations.js  # CRUD разговоров, поиск
│       │   ├── models.js         # Модели, CRUD API-ключей
│       │   ├── files.js          # Загрузка файлов
│       │   ├── settings.js       # Глобальные настройки
│       │   └── admin.js          # Админ-панель
│       └── services/
│           ├── claude.js         # Anthropic SDK
│           ├── openai.js         # OpenAI SDK (+ DeepSeek, Kimi)
│           ├── gemini.js         # Google Generative AI SDK
│           ├── billing.js        # Цены, списание, пополнение
│           └── telegram.js       # Telegram Bot polling
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts            # Прокси /api -> :3001
│   ├── index.html                # Google/Apple SDK скрипты
│   └── src/
│       ├── main.tsx              # ReactDOM, BrowserRouter
│       ├── App.tsx               # Корневой компонент, горячие клавиши
│       ├── types/index.ts        # TypeScript интерфейсы
│       ├── store/
│       │   ├── appStore.ts       # Разговоры, модели, UI
│       │   └── authStore.ts      # Авторизация, токены
│       ├── services/api.ts       # Axios + streamChat() SSE
│       ├── i18n/i18n.ts          # i18next: ru, en, zh
│       └── components/
│           ├── AuthScreen.tsx    # Вход (Google, Apple, Telegram, Email)
│           ├── Sidebar.tsx       # Список чатов
│           ├── ChatWindow.tsx    # Окно чата + стриминг
│           ├── ChatInput.tsx     # Поле ввода + файлы
│           ├── MessageBubble.tsx # Markdown + syntax highlight
│           ├── ModelBar.tsx      # Выбор провайдера/модели
│           ├── SettingsModal.tsx # API-ключи, язык, клавиши
│           ├── SearchModal.tsx   # Полнотекстовый поиск
│           ├── SystemPromptModal.tsx # Системный промпт
│           ├── AdminPanel.tsx    # Панель администратора
│           └── ProfileModal.tsx  # Профиль, пароль, Telegram
│
├── data/                         # SQLite БД (gitignored)
└── uploads/                      # Загруженные файлы (gitignored)
```

---

## Установка и запуск

### Требования

- Node.js 18+
- npm 9+

### 1. Клонирование

```bash
git clone https://github.com/ircitdev/UspAIChat.git
cd UspAIChat
```

### 2. Установка зависимостей

```bash
npm run install:all
```

### 3. Настройка окружения

```bash
cp backend/.env.example backend/.env
# Отредактируйте backend/.env
```

### 4. Запуск (dev)

```bash
# Терминал 1
npm run dev:backend    # http://localhost:3001

# Терминал 2
npm run dev:frontend   # http://localhost:3000
```

### 5. Первый вход

Первый зарегистрированный пользователь автоматически получает роль **admin**.

### 6. Сборка (production)

```bash
npm run build          # Собрать frontend/dist/
cd backend && npm start
```

---

## Переменные окружения (.env)

Файл: `backend/.env`

| Переменная | Обязательна | Описание |
|---|---|---|
| `PORT` | Нет | Порт сервера. По умолчанию: `3001` |
| `JWT_SECRET` | **Да (прод)** | Секрет для JWT. Дефолт небезопасен! |
| `GOOGLE_CLIENT_ID` | Нет | Client ID из Google Cloud Console |
| `APPLE_CLIENT_ID` | Нет | Service ID из Apple Developer |
| `TELEGRAM_BOT_TOKEN` | Нет | Токен бота из @BotFather |
| `TELEGRAM_BOT_USERNAME` | Нет | Username бота без `@` |

> API-ключи AI-провайдеров добавляются через UI и хранятся в БД.

---

## Схема базы данных

SQLite (`data/uspaichat.db`), режим WAL, foreign keys ON.

### users
| Колонка | Тип | Описание |
|---|---|---|
| id | TEXT PK | UUID v4 |
| email | TEXT UNIQUE | Email (nullable для Telegram/OAuth) |
| username | TEXT | Отображаемое имя |
| password_hash | TEXT | bcrypt (nullable для OAuth) |
| telegram_id | INTEGER UNIQUE | Telegram user ID |
| google_id | TEXT UNIQUE | Google sub |
| apple_id | TEXT UNIQUE | Apple sub |
| role | TEXT | `'admin'` / `'user'` |
| is_blocked | INTEGER | 0/1 |
| balance | REAL | Кредитный баланс |
| avatar | TEXT | URL аватара |

### refresh_tokens
| id | user_id | token | expires_at | created_at |

### telegram_auth_codes
| code | user_id | telegram_id | status | type | expires_at |

### conversations
| id | user_id | title | provider | model | system_prompt | token_count | is_pinned |

### messages
| id | conversation_id | role | content | token_count | provider | model | files |

### messages_fts (FTS5)
| content | conversation_id | message_id | role |

### transactions
| id | user_id | type | amount | balance_after | description | provider | model | tokens |

### api_keys
| user_id | provider | api_key | base_url | (PK: user_id + provider) |

### settings
| key (PK) | value |

---

## API Reference

Базовый URL: `http://localhost:3001/api`

### Аутентификация

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/register` | Регистрация email/пароль |
| POST | `/auth/login` | Вход email/пароль |
| POST | `/auth/refresh` | Обновить токен |
| POST | `/auth/logout` | Выход |
| GET | `/auth/me` | Текущий пользователь (+has_password) |
| POST | `/auth/set-password` | Установить/сменить пароль |
| GET | `/auth/oauth/config` | Получить Google/Apple client IDs |
| POST | `/auth/oauth/google` | Вход через Google (credential) |
| POST | `/auth/oauth/apple` | Вход через Apple (id_token, user?) |
| POST | `/auth/telegram/init` | Получить 6-значный код |
| GET | `/auth/telegram/poll/:code` | Проверить статус кода |
| POST | `/auth/telegram/link/init` | Привязать Telegram (auth) |
| GET | `/auth/telegram/link/poll/:code` | Проверить привязку |
| DELETE | `/auth/telegram/unlink` | Отвязать Telegram |

### Чат

| Метод | Путь | Описание |
|---|---|---|
| POST | `/chat/stream` | SSE стриминг ответа AI |

Events: `price`, `start`, `chunk`, `tokens`, `done`, `error`

### Разговоры

| Метод | Путь | Описание |
|---|---|---|
| GET | `/conversations` | Список разговоров |
| POST | `/conversations` | Создать разговор |
| PUT | `/conversations/:id` | Обновить |
| DELETE | `/conversations/:id` | Удалить |
| GET | `/conversations/:id/messages` | Сообщения |
| GET | `/conversations/search/query?q=` | Поиск FTS5 |

### Модели

| Метод | Путь | Описание |
|---|---|---|
| GET | `/models` | Все модели по провайдерам |
| GET | `/models/keys` | Статус ключей |
| POST | `/models/keys` | Сохранить ключ |
| DELETE | `/models/keys/:provider` | Удалить ключ |

### Файлы

| Метод | Путь | Описание |
|---|---|---|
| POST | `/files/upload` | Загрузить файлы (до 10, 50МБ) |

### Админ (требует role=admin)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/stats` | Статистика |
| GET | `/admin/users` | Пользователи |
| PATCH | `/admin/users/:id/role` | Изменить роль |
| PATCH | `/admin/users/:id/block` | Блокировка |
| PATCH | `/admin/users/:id/password` | Сброс пароля |
| DELETE | `/admin/users/:id` | Удалить |
| GET/POST/DELETE | `/admin/global-keys` | Глобальные API ключи |
| POST | `/admin/balance/topup` | Пополнить баланс |
| GET | `/admin/balance/transactions` | История транзакций |
| GET/POST/DELETE | `/admin/pricing` | Управление ценами |

---

## Потоки аутентификации

### Google Sign-In
```
GET /auth/oauth/config → google_client_id
→ Google SDK рендерит кнопку
→ Пользователь авторизуется в Google
→ POST /auth/oauth/google { credential }
→ Сервер верифицирует через google-auth-library
→ Создаёт/находит пользователя → токены
```

### Apple Sign-In
```
GET /auth/oauth/config → apple_client_id
→ AppleID.auth.signIn() (popup)
→ POST /auth/oauth/apple { id_token, user }
→ Сервер верифицирует JWT через Apple public keys
→ Создаёт/находит пользователя → токены
```

### Telegram
```
POST /auth/telegram/init → 6-значный код
→ Пользователь отправляет код боту
→ Бот подтверждает → status='confirmed'
→ Фронтенд polling каждые 2 сек → получает токены
```

### Email (только вход)
```
Регистрация: только через Google/Apple/Telegram
Пароль можно задать в профиле после входа
POST /auth/login { email, password } → токены
```

---

## Провайдеры AI и модели

| Провайдер | Модели | Контекст |
|---|---|---|
| **Anthropic** | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5, 3.5 Sonnet, 3.5 Haiku | 200K |
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, o1 Mini | 128-200K |
| **Gemini** | 2.0 Flash, 1.5 Pro, 1.5 Flash, 1.5 Flash 8B | 1-2M |
| **DeepSeek** | DeepSeek V3, DeepSeek R1 | 64K |
| **Kimi** | Moonshot 8K/32K/128K | 8-128K |

---

## Биллинговая система

- Кредитный баланс у каждого пользователя
- Администраторы не тарифицируются
- Цены настраиваются через админ-панель
- Атомарное списание после завершения стриминга
- Приоритет ключей: личный → глобальный → ошибка

### Цены по умолчанию (за 1K выходных токенов)

| Модель | Цена |
|---|---|
| Claude Opus 4.6 | 15.0 |
| Claude Sonnet 4.6 | 3.0 |
| GPT-4o | 5.0 |
| GPT-4o Mini | 0.6 |
| o1 | 60.0 |
| Gemini 1.5 Pro | 3.5 |

---

## Компоненты фронтенда

| Компонент | Описание |
|---|---|
| **AuthScreen** | Экран входа: Google, Apple, Telegram кнопки + email форма |
| **Sidebar** | Список чатов, закреплённые, баланс, профиль |
| **ChatWindow** | Сообщения + стриминг с анимацией |
| **ChatInput** | Ввод + drag/paste изображений + файлы |
| **MessageBubble** | Markdown + code highlight + copy |
| **ModelBar** | Выбор провайдера/модели |
| **SettingsModal** | API ключи, язык, горячие клавиши |
| **SearchModal** | FTS5 поиск по сообщениям |
| **SystemPromptModal** | Редактор системного промпта + пресеты |
| **AdminPanel** | Статистика, пользователи, баланс, ключи |
| **ProfileModal** | Профиль, управление паролем, Telegram |

---

## Горячие клавиши

| Клавиша | Действие |
|---|---|
| `Ctrl+N` | Новый чат |
| `Ctrl+K` | Поиск |
| `Ctrl+,` | Настройки |
| `Ctrl+B` | Боковая панель |
| `Enter` | Отправить |
| `Shift+Enter` | Новая строка |
| `Escape` | Закрыть модальное окно |
| `Ctrl+V` | Вставить изображение из буфера |
