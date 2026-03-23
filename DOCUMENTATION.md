# UspAIChat — Полная документация

> Версия: 1.3.0 | Последнее обновление: 2026-03-23

---

## Содержание

1. [Обзор проекта](#1-обзор-проекта)
2. [Начало работы](#2-начало-работы)
3. [Архитектура](#3-архитектура)
4. [Справочник API](#4-справочник-api)
5. [Схема базы данных](#5-схема-базы-данных)
6. [Функциональность](#6-функциональность)
7. [Развёртывание](#7-развёртывание)
8. [Smart Router — подробный разбор](#8-smart-router--подробный-разбор)
9. [Планы развития](#9-планы-развития)
10. [Приложение: мобильные зависимости](#10-приложение-мобильные-зависимости-flutter)

---

## 1. Обзор проекта

### Что это

UspAIChat — self-hosted мультипровайдерное приложение для чата с ИИ. Поддерживает веб- и мобильных клиентов. Позволяет общаться с моделями Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek и Kimi через единый интерфейс.

### Целевая аудитория

- Команды и компании, которым нужен собственный ChatGPT-подобный сервис
- Разработчики, использующие разные AI-провайдеры
- Организации с требованиями к хранению данных на своих серверах

### Стек технологий

| Компонент | Технологии |
|-----------|-----------|
| **Backend** | Express.js, Node.js 20, SQLite (better-sqlite3, WAL mode) |
| **Frontend (web)** | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| **Frontend (mobile)** | Flutter 3.29, Riverpod, GoRouter, Dio |
| **Аутентификация** | Google OAuth, Apple Sign-In, Telegram Bot, Email/Password (JWT) |
| **AI-провайдеры** | Anthropic Claude, OpenAI, Google Gemini, DeepSeek, Kimi |
| **Smart Router** | 14-мерный классификатор сложности промптов |

### Архитектурная диаграмма

```
┌─────────────────────────────────────────────────────────┐
│                     Клиенты                              │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Web (React) │  │ Android (FL) │  │   iOS (FL)   │   │
│  │  :3000 dev   │  │   Flutter    │  │   Flutter    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
          └────────────┬────┴─────────────────┘
                       │  HTTP/SSE
                       ▼
          ┌────────────────────────┐
          │   Express.js Backend   │
          │       :3001 dev        │
          │       :3088 prod       │
          ├────────────────────────┤
          │  Middleware:           │
          │  - CORS                │
          │  - JWT Auth            │
          │  - Admin check         │
          ├────────────────────────┤
          │  Services:             │
          │  - autoRouter.js       │
          │  - claude.js           │
          │  - openai.js           │
          │  - gemini.js           │
          │  - billing.js          │
          │  - telegram.js         │
          ├────────────────────────┤
          │  SQLite (WAL mode)     │
          │  data/uspaichat.db     │
          └───────────┬────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │Anthropic│  │ OpenAI  │  │ Google  │  ...
   │  API    │  │  API    │  │ Gemini  │
   └─────────┘  └─────────┘  └─────────┘
```

---

## 2. Начало работы

### Требования

| Инструмент | Версия | Назначение |
|-----------|--------|-----------|
| **Node.js** | 20 LTS | Backend + Frontend build |
| **npm** | 10+ | Менеджер пакетов |
| **Flutter** | 3.29+ | Мобильное приложение (опционально) |
| **Git** | 2.x | Управление кодом |

### Установка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/ircitdev/UspAIChat.git
cd UspAIChat

# 2. Установить все зависимости (backend + frontend)
npm run install:all

# 3. Настроить переменные окружения
cp backend/.env.example backend/.env
# Отредактировать backend/.env
```

### Переменные окружения (backend/.env)

| Переменная | Обязательная | По умолчанию | Описание |
|-----------|:---:|-----------|-----------|
| `PORT` | Нет | `3001` | Порт сервера (на проде: `3088`) |
| `JWT_SECRET` | **Да** | `uspaichat_secret_change_in_production` | Секрет для JWT-токенов. **Обязательно сменить на проде!** |
| `GOOGLE_CLIENT_ID` | Нет | — | ID клиента Google OAuth. Без него кнопка Google скрыта |
| `APPLE_CLIENT_ID` | Нет | — | ID клиента Apple Sign-In. Без него кнопка Apple скрыта |
| `TELEGRAM_BOT_TOKEN` | Нет | — | Токен Telegram бота от @BotFather |
| `TELEGRAM_BOT_USERNAME` | Нет | — | Username бота без `@` |
| `YOOKASSA_SHOP_ID` | Нет | — | ID магазина в ЮKassa |
| `YOOKASSA_SECRET_KEY` | Нет | — | Секретный ключ ЮKassa |
| `YOOKASSA_RETURN_URL` | Нет | — | URL возврата после оплаты (например, `https://app.aifuturenow.ru/`) |
| `TELEGRAM_PAYMENT_TOKEN` | Нет | — | Платёжный токен Telegram (от ЮKassa через @BotFather) |
| `CREDITS_PER_RUBLE` | Нет | `1` | Курс: сколько кредитов за 1 рубль |
| `REFERRAL_BONUS_REFERRER` | Нет | `50` | Бонус кредитов пригласившему |
| `REFERRAL_BONUS_REFERRED` | Нет | `25` | Бонус кредитов приглашённому |
| `REFERRAL_PERCENT` | Нет | `10` | Процент от первого пополнения реферала |

> API-ключи для AI-провайдеров (Anthropic, OpenAI, Gemini, DeepSeek, Kimi) хранятся **не в .env**, а в базе данных. Устанавливаются через интерфейс — в настройках модели (пользовательские) или в админ-панели (глобальные).

### Запуск в режиме разработки

```bash
# Backend на :3001
npm run dev:backend

# Frontend на :3000 (проксирует /api на :3001)
npm run dev:frontend
```

### Сборка для production

```bash
# Собрать фронтенд
npm run build
# или
cd frontend && npm run build

# Запустить backend (который раздаёт собранный фронтенд)
cd backend && npm start
```

### Сборка мобильного приложения

```bash
cd mobile

# Android APK
flutter build apk --release

# iOS
flutter build ipa --release
```

---

## 3. Архитектура

### Структура каталогов

```
UspAIChat/
├── backend/
│   ├── src/
│   │   ├── index.js              # Точка входа Express-сервера
│   │   ├── db/
│   │   │   └── database.js       # Инициализация SQLite, миграции, схема
│   │   ├── middleware/
│   │   │   └── auth.js           # JWT-аутентификация (requireAuth, requireAdmin)
│   │   ├── routes/
│   │   │   ├── auth.js           # Регистрация, логин, токены, пароли
│   │   │   ├── authOAuth.js      # Google OAuth, Apple Sign-In
│   │   │   ├── authTelegram.js   # Telegram-аутентификация (код + polling)
│   │   │   ├── chat.js           # SSE-стриминг чата, авто-роутинг
│   │   │   ├── conversations.js  # CRUD бесед, экспорт, поиск
│   │   │   ├── models.js         # Список моделей, API-ключи пользователя
│   │   │   ├── files.js          # Загрузка файлов, извлечение текста
│   │   │   ├── folders.js        # CRUD папок
│   │   │   ├── promptTemplates.js# CRUD шаблонов промптов
│   │   │   ├── share.js          # Публичный шаринг бесед
│   │   │   ├── admin.js          # Админ: пользователи, баланс, ключи, цены
│   │   │   └── settings.js       # Глобальные настройки (key-value)
│   │   └── services/
│   │       ├── autoRouter.js     # Smart Router: 14-мерный классификатор
│   │       ├── billing.js        # Биллинг: тарифы, списание, пополнение
│   │       ├── claude.js         # Стриминг Anthropic Claude
│   │       ├── openai.js         # Стриминг OpenAI (+ DeepSeek, Kimi)
│   │       ├── gemini.js         # Стриминг Google Gemini
│   │       └── telegram.js       # Telegram Bot (node-telegram-bot-api)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Главный компонент, роутинг
│   │   ├── components/
│   │   │   ├── AuthScreen.tsx    # Экран авторизации
│   │   │   ├── Sidebar.tsx       # Боковая панель с беседами и папками
│   │   │   ├── ChatWindow.tsx    # Окно чата (список сообщений)
│   │   │   ├── ChatInput.tsx     # Поле ввода: текст, файлы, голос, шаблоны
│   │   │   ├── MessageBubble.tsx # Отдельное сообщение (markdown, код, файлы)
│   │   │   ├── ModelBar.tsx      # Выбор провайдера и модели
│   │   │   ├── SettingsModal.tsx # Настройки: ключи, язык, тема
│   │   │   ├── AdminPanel.tsx    # Админ-панель: статистика, пользователи
│   │   │   ├── ProfileModal.tsx  # Профиль пользователя
│   │   │   ├── SearchModal.tsx   # Полнотекстовый поиск
│   │   │   ├── SystemPromptModal.tsx # Редактор системного промпта
│   │   │   ├── RoutingInfoModal.tsx  # Детали авто-роутинга
│   │   │   ├── ShareDialog.tsx   # Шаринг беседы
│   │   │   ├── SharedView.tsx    # Публичная страница расшаренной беседы
│   │   │   └── PromptTemplatesManager.tsx # Управление шаблонами
│   │   ├── hooks/
│   │   │   └── useVoiceChat.ts   # Голосовой ввод (STT) и озвучка (TTS)
│   │   ├── services/
│   │   │   └── api.ts            # Axios + SSE-стриминг через fetch
│   │   ├── store/
│   │   │   └── appStore.ts       # Zustand: глобальное состояние
│   │   ├── types/
│   │   │   └── index.ts          # TypeScript-интерфейсы
│   │   ├── i18n/
│   │   │   └── i18n.ts           # Локализация: ru, en, zh
│   │   └── styles/
│   │       └── globals.css       # Tailwind + кастомные стили
│   └── package.json
├── mobile/
│   ├── lib/
│   │   ├── main.dart             # Точка входа Flutter
│   │   ├── app.dart              # MaterialApp, тема, роутер
│   │   ├── core/
│   │   │   ├── constants/
│   │   │   │   ├── api_constants.dart  # Базовый URL API
│   │   │   │   └── app_colors.dart     # Цветовая палитра
│   │   │   ├── router/
│   │   │   │   └── app_router.dart     # GoRouter: навигация
│   │   │   └── theme/
│   │   │       └── app_theme.dart      # Тема приложения
│   │   ├── data/
│   │   │   ├── datasources/remote/
│   │   │   │   ├── api_client.dart       # Dio HTTP-клиент
│   │   │   │   ├── auth_api.dart         # API авторизации
│   │   │   │   ├── chat_api.dart         # SSE-стриминг
│   │   │   │   ├── conversation_api.dart # API бесед
│   │   │   │   ├── file_api.dart         # Загрузка файлов
│   │   │   │   ├── folder_api.dart       # API папок
│   │   │   │   ├── model_api.dart        # API моделей
│   │   │   │   ├── prompt_template_api.dart # API шаблонов
│   │   │   │   └── share_api.dart        # API шаринга
│   │   │   └── models/
│   │   │       ├── conversation_model.dart
│   │   │       ├── message_model.dart
│   │   │       ├── model_info_model.dart
│   │   │       ├── user_model.dart
│   │   │       ├── folder_model.dart
│   │   │       ├── prompt_template_model.dart
│   │   │       └── sse_event_model.dart
│   │   ├── presentation/screens/
│   │   │   ├── auth/              # Авторизация
│   │   │   ├── chat/              # Экран чата
│   │   │   ├── conversations/     # Список бесед
│   │   │   ├── home/              # Главный экран
│   │   │   ├── profile/           # Профиль
│   │   │   ├── search/            # Поиск
│   │   │   ├── settings/          # Настройки + шаблоны
│   │   │   ├── admin/             # Админ-панель
│   │   │   ├── splash/            # Splash-экран
│   │   │   └── system_prompt/     # Системный промпт
│   │   └── providers/
│   │       ├── auth_provider.dart
│   │       ├── chat_provider.dart
│   │       ├── conversation_provider.dart
│   │       ├── folder_provider.dart
│   │       └── prompt_template_provider.dart
│   ├── pubspec.yaml
│   └── android/ ios/              # Нативные платформы
├── data/                          # SQLite БД (gitignored)
├── uploads/                       # Загруженные файлы (gitignored)
├── package.json                   # Root: скрипты install:all, dev:backend, dev:frontend
├── CLAUDE.md                      # Краткое руководство по проекту
└── DOCUMENTATION.md               # Этот файл
```

### Архитектура backend

**Express.js** сервер с модульной структурой роутов:

```
index.js
  ├── initDB()                  # SQLite: создание таблиц, миграции
  ├── startBot()                # Telegram бот (polling)
  ├── /api/auth/*               # Регистрация, логин, токены
  ├── /api/auth/oauth/*         # Google, Apple OAuth
  ├── /api/auth/telegram/*      # Telegram-авторизация
  ├── /api/chat/*               # SSE-стриминг чата
  ├── /api/conversations/*      # CRUD бесед, сообщения
  ├── /api/models/*             # Список моделей, ключи
  ├── /api/files/*              # Загрузка файлов
  ├── /api/folders/*            # Папки
  ├── /api/prompt-templates/*   # Шаблоны промптов
  ├── /api/share/*              # Шаринг бесед
  ├── /api/settings/*           # Настройки (key-value)
  ├── /api/admin/*              # Админ-панель
  ├── /health                   # Health-check
  └── Static: frontend/dist     # SPA на проде
```

**Middleware:**
- `requireAuth` — проверяет JWT из `Authorization: Bearer <token>`, выставляет `req.userId` и `req.userRole`
- `requireAdmin` — то же + проверка `role === 'admin'`

**Сервисы AI-провайдеров:**
- `claude.js` — Anthropic SDK, потоковый вывод через `client.messages.stream()`
- `openai.js` — OpenAI SDK, потоковый вывод через `client.chat.completions.create({ stream: true })`. Также используется для DeepSeek и Kimi с кастомным `baseURL`
- `gemini.js` — Google Generative AI SDK, потоковый вывод через `chat.sendMessageStream()`

Все три сервиса имеют единый интерфейс: принимают `{ apiKey, model, history, message, systemPrompt, files, onChunk, onTokens }`.

### Архитектура frontend (web)

**Zustand store** (`appStore.ts`) — единый глобальный стор:
- `conversations`, `activeConversation`, `messages` — данные бесед
- `folders`, `promptTemplates` — организация
- `selectedProvider`, `selectedModel` — текущий провайдер/модель
- `streaming`, `streamingContent` — состояние стриминга
- Действия: `loadConversations`, `createConversation`, `selectConversation` и т.д.

**SSE-стриминг** (`api.ts`) — использует `fetch()` вместо `EventSource`, чтобы передавать `Authorization` header. Ручной парсинг `data:` строк из потока.

### Архитектура mobile (Flutter)

- **Riverpod** для управления состоянием (вместо BLoC — меньше boilerplate)
- **GoRouter** для навигации
- **Dio** с `ResponseType.stream` для SSE-стриминга
- Нативные SDK для Google/Apple Sign-In
- Цвета тёмной темы совпадают с веб-CSS

### Поток аутентификации

Приложение поддерживает 4 метода входа:

#### Google OAuth
```
1. Клиент получает конфиг: GET /api/auth/oauth/config → { google_client_id }
2. Клиент показывает Google Sign-In → получает credential (ID token)
3. POST /api/auth/oauth/google { credential }
4. Сервер верифицирует токен через Google OAuth2Client
5. Находит/создаёт пользователя → возвращает { user, accessToken, refreshToken }
```

#### Apple Sign-In
```
1. Клиент показывает Apple Sign-In → получает id_token (JWT)
2. POST /api/auth/oauth/apple { id_token, user? }
3. Сервер скачивает публичные ключи Apple, верифицирует JWT
4. Находит/создаёт пользователя → возвращает { user, accessToken, refreshToken }
```

#### Telegram Bot
```
1. POST /api/auth/telegram/init → { code: "123456", bot_username }
2. Пользователь отправляет код боту @UspAIChatbot
3. Бот находит код в БД, создаёт/находит пользователя, ставит status = 'confirmed'
4. Клиент поллит: GET /api/auth/telegram/poll/:code
5. Когда status = 'confirmed' → возвращает { user, accessToken, refreshToken }
```

#### Email/Password
```
Только вход (регистрация — через OAuth):
1. POST /api/auth/login { email, password }
2. Проверка bcrypt → { user, accessToken, refreshToken }

Установка пароля (для OAuth-пользователей):
1. POST /api/auth/set-password { newPassword } (с JWT)
```

**Токены:**
- Access token: JWT, время жизни **15 минут**
- Refresh token: UUID, время жизни **30 дней**, хранится в БД
- Frontend обновляет токен каждые **12 минут** автоматически

### Протокол SSE-стриминга чата

Клиент отправляет `POST /api/chat/stream` и получает поток SSE-событий:

```
data: {"type":"routing_info","selectedModel":"GPT-4o","tier":"MEDIUM",...}  // Только для auto
data: {"type":"price","pricePer1k":5.0}
data: {"type":"start","message_id":"abc-123"}
data: {"type":"chunk","content":"Привет"}
data: {"type":"chunk","content":"! Как"}
data: {"type":"chunk","content":" дела?"}
data: {"type":"tokens","count":15}
data: {"type":"done","message_id":"xyz-456","full_content":"Привет! Как дела?","balance_after":95.2}
```

**Типы SSE-событий:**

| Тип | Описание |
|-----|----------|
| `routing_info` | Информация о маршрутизации (только при provider=auto) |
| `price` | Цена за 1K токенов текущей модели |
| `start` | Начало генерации, ID сообщения пользователя |
| `chunk` | Фрагмент текста ответа |
| `tokens` | Количество выходных токенов |
| `done` | Генерация завершена: ID сообщения, полный текст, баланс, стоимость ответа (cost) |
| `error` | Ошибка |

---

## 4. Справочник API

Все эндпоинты имеют префикс `/api`. Авторизованные запросы требуют заголовок `Authorization: Bearer <accessToken>`.

### 4.1 Auth — Аутентификация

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `POST` | `/auth/register` | Нет | Регистрация по email (email, username, password) |
| `POST` | `/auth/login` | Нет | Вход по email/паролю |
| `POST` | `/auth/refresh` | Нет | Обновление JWT-токена (refreshToken в теле) |
| `POST` | `/auth/logout` | Нет | Выход (удаление refresh token) |
| `POST` | `/auth/set-password` | Да | Установка/смена пароля |
| `GET` | `/auth/me` | Да | Данные текущего пользователя |

**POST /auth/register**
```json
// Request
{ "email": "user@mail.ru", "username": "Иван", "password": "123456" }
// Response
{ "user": { "id": "...", "email": "...", "username": "...", "role": "user" }, "accessToken": "...", "refreshToken": "..." }
```

**POST /auth/login**
```json
// Request
{ "email": "user@mail.ru", "password": "123456" }
// Response
{ "user": {...}, "accessToken": "...", "refreshToken": "..." }
```

**POST /auth/refresh**
```json
// Request
{ "refreshToken": "uuid-token-here" }
// Response
{ "user": {...}, "accessToken": "...", "refreshToken": "..." }
```

### 4.2 OAuth — Google и Apple

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/auth/oauth/config` | Нет | Получить client ID для Google и Apple |
| `POST` | `/auth/oauth/google` | Нет | Вход через Google (credential: ID token) |
| `POST` | `/auth/oauth/apple` | Нет | Вход через Apple (id_token: JWT, user?: объект) |
| `POST` | `/auth/oauth/google/link` | Да | Привязать Google к существующему аккаунту |
| `DELETE` | `/auth/oauth/google/unlink` | Да | Отвязать Google |
| `POST` | `/auth/oauth/apple/link` | Да | Привязать Apple к существующему аккаунту |
| `DELETE` | `/auth/oauth/apple/unlink` | Да | Отвязать Apple |

**GET /auth/oauth/config**
```json
// Response
{ "google_client_id": "123...apps.googleusercontent.com", "apple_client_id": "com.example.app" }
```

### 4.3 Telegram — Авторизация через бота

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `POST` | `/auth/telegram/init` | Нет | Создать 6-значный код (TTL: 10 минут) |
| `GET` | `/auth/telegram/poll/:code` | Нет | Проверить статус кода |
| `POST` | `/auth/telegram/link/init` | Да | Создать код для привязки Telegram к аккаунту |
| `GET` | `/auth/telegram/link/poll/:code` | Да | Проверить статус привязки |
| `DELETE` | `/auth/telegram/unlink` | Да | Отвязать Telegram от аккаунта |

**POST /auth/telegram/init**
```json
// Response
{ "code": "123456", "bot_username": "UspAIChatbot", "expires_in": 600 }
```

**GET /auth/telegram/poll/:code**
```json
// Response (ожидание)
{ "status": "pending" }
// Response (подтверждено)
{ "status": "confirmed", "user": {...}, "accessToken": "...", "refreshToken": "..." }
```

### 4.4 Chat — Чат с AI

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `POST` | `/chat/stream` | Да | Отправить сообщение, получить SSE-стрим ответа |

**POST /chat/stream**
```json
// Request
{
  "conversation_id": "uuid",
  "message": "Привет!",
  "provider": "auto",        // "auto" | "anthropic" | "openai" | "gemini" | "deepseek" | "kimi"
  "model": "auto",           // ID модели или "auto"
  "system_prompt": "",        // Опционально
  "files": [                  // Опционально: прикреплённые файлы
    { "mimetype": "image/png", "base64": "..." }
  ]
}
// Response: SSE поток (см. раздел "Протокол SSE-стриминга")
```

### 4.5 Conversations — Беседы

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/conversations` | Да | Список всех бесед пользователя |
| `POST` | `/conversations` | Да | Создать новую беседу |
| `PUT` | `/conversations/:id` | Да | Обновить беседу |
| `DELETE` | `/conversations/:id` | Да | Удалить беседу |
| `GET` | `/conversations/:id/messages` | Да | Получить сообщения беседы |
| `DELETE` | `/conversations/:convId/messages/:msgId` | Да | Удалить сообщение |
| `GET` | `/conversations/:id/export?format=md\|json\|txt` | Да | Экспорт беседы |
| `GET` | `/conversations/search/query?q=текст` | Да | Полнотекстовый поиск |

**POST /conversations**
```json
// Request
{ "title": "New Chat", "provider": "auto", "model": "auto", "system_prompt": "" }
// Response
{ "id": "uuid", "title": "New Chat", "provider": "auto", "model": "auto", ... }
```

**PUT /conversations/:id**
```json
// Request (все поля опциональны)
{ "title": "...", "system_prompt": "...", "provider": "...", "model": "...", "is_pinned": 1, "folder_id": "uuid" }
```

**GET /conversations/:id/export?format=md**

Возвращает файл в указанном формате:
- `md` — Markdown (по умолчанию)
- `json` — JSON со всеми сообщениями
- `txt` — Простой текст

### 4.6 Models — Модели и ключи

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/models` | Нет | Список всех моделей по провайдерам |
| `GET` | `/models/pricing` | Нет | Цены за 1K токенов по всем моделям |
| `GET` | `/models/keys` | Да | Статус API-ключей пользователя |
| `POST` | `/models/keys` | Да | Сохранить API-ключ |
| `DELETE` | `/models/keys/:provider` | Да | Удалить API-ключ |

**GET /models** — возвращает объект:
```json
{
  "auto": [{ "id": "auto", "name": "Авто (Smart Router)", "context": 0 }],
  "anthropic": [
    { "id": "claude-opus-4-6", "name": "Claude Opus 4.6", "context": 200000 },
    { "id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "context": 200000 },
    { "id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "context": 200000 },
    { "id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "context": 200000 },
    { "id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "context": 200000 }
  ],
  "openai": [
    { "id": "gpt-4o", "name": "GPT-4o", "context": 128000 },
    { "id": "gpt-4o-mini", "name": "GPT-4o Mini", "context": 128000 },
    { "id": "gpt-4-turbo", "name": "GPT-4 Turbo", "context": 128000 },
    { "id": "o1", "name": "o1", "context": 200000 },
    { "id": "o1-mini", "name": "o1 Mini", "context": 128000 }
  ],
  "gemini": [
    { "id": "gemini-2.5-flash-preview-05-20", "name": "Gemini 2.5 Flash", "context": 1048576 },
    { "id": "gemini-2.5-pro-preview-05-06", "name": "Gemini 2.5 Pro", "context": 1048576 },
    { "id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "context": 1048576 },
    { "id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "context": 1048576 }
  ],
  "deepseek": [
    { "id": "deepseek-chat", "name": "DeepSeek V3", "context": 64000 },
    { "id": "deepseek-reasoner", "name": "DeepSeek R1", "context": 64000 }
  ],
  "kimi": [
    { "id": "moonshot-v1-8k", "name": "Kimi 8K", "context": 8000 },
    { "id": "moonshot-v1-32k", "name": "Kimi 32K", "context": 32000 },
    { "id": "moonshot-v1-128k", "name": "Kimi 128K", "context": 128000 }
  ]
}
```

### 4.7 Files — Файлы

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `POST` | `/files/upload` | Нет* | Загрузить файлы (multipart, до 10 файлов, макс. 50 МБ каждый) |
| `GET` | `/files/documents/:conversation_id` | Нет* | Список документов беседы |
| `GET` | `/files/search/:conversation_id?q=текст` | Нет* | Поиск по документам |

Поддерживаемые форматы: изображения (image/*), PDF, DOCX, TXT, MD, JS, TS, PY, JSON, CSV, XML, HTML, CSS.

При загрузке:
- Изображения возвращаются с base64 для предпросмотра и передачи AI-моделям
- Текстовые документы и PDF разбиваются на чанки по 2000 символов и сохраняются в таблице `documents`

### 4.8 Folders — Папки

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/folders` | Да | Список папок пользователя |
| `POST` | `/folders` | Да | Создать папку (name, color) |
| `PUT` | `/folders/:id` | Да | Обновить папку |
| `DELETE` | `/folders/:id` | Да | Удалить папку (беседы из неё перемещаются в корень) |

### 4.9 Prompt Templates — Шаблоны промптов

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/prompt-templates` | Да | Список шаблонов (личные + глобальные) |
| `POST` | `/prompt-templates` | Да | Создать шаблон (name, content, category) |
| `PUT` | `/prompt-templates/:id` | Да | Обновить шаблон |
| `DELETE` | `/prompt-templates/:id` | Да | Удалить шаблон |

Глобальные шаблоны (`is_global = 1`) может создавать только админ. Они видны всем пользователям.

### 4.10 Share — Шаринг бесед

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `POST` | `/share/:conversationId` | Да | Создать/обновить ссылку для шаринга |
| `GET` | `/share/status/:conversationId` | Да | Статус шаринга беседы |
| `DELETE` | `/share/:conversationId` | Да | Отключить шаринг |
| `GET` | `/share/public/:shareId` | Нет | Просмотр расшаренной беседы (публичный) |

**POST /share/:conversationId**
```json
// Request
{ "password": "secret123" }   // Опционально: защита паролем
// Response
{ "share_id": "abc12def34gh", "has_password": true }
```

**GET /share/public/:shareId?password=secret123**

Пароль передаётся через query-параметр `password` или заголовок `X-Share-Password`.

### 4.11 Admin — Администрирование

Все эндпоинты требуют роль `admin`.

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/admin/stats` | Admin | Общая статистика системы |
| `GET` | `/admin/users?q=search` | Admin | Список пользователей |
| `PATCH` | `/admin/users/:id/role` | Admin | Изменить роль пользователя |
| `PATCH` | `/admin/users/:id/block` | Admin | Заблокировать/разблокировать |
| `PATCH` | `/admin/users/:id/password` | Admin | Сбросить пароль |
| `DELETE` | `/admin/users/:id` | Admin | Удалить пользователя |
| `GET` | `/admin/conversations` | Admin | Все беседы всех пользователей (лимит 200) |
| `GET` | `/admin/global-keys` | Admin | Глобальные API-ключи |
| `POST` | `/admin/global-keys` | Admin | Установить глобальный API-ключ |
| `DELETE` | `/admin/global-keys/:provider` | Admin | Удалить глобальный API-ключ |
| `POST` | `/admin/balance/topup` | Admin | Пополнить баланс пользователя |
| `GET` | `/admin/balance/transactions?user_id=&limit=50` | Admin | История транзакций |
| `GET` | `/admin/pricing` | Admin | Тарифы (дефолтные + переопределения) |
| `POST` | `/admin/pricing` | Admin | Установить кастомную цену |
| `DELETE` | `/admin/pricing/:key` | Admin | Удалить переопределение цены |

**GET /admin/stats**
```json
{
  "totalUsers": 42,
  "adminUsers": 2,
  "blockedUsers": 1,
  "totalConvs": 350,
  "totalMessages": 4200,
  "newToday": 3,
  "totalTopup": 10000,
  "totalCharged": 3500,
  "totalBalance": 6500
}
```

### 4.12 Settings — Настройки

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/settings` | Нет | Получить все настройки (key-value) |
| `POST` | `/settings` | Нет | Установить настройку ({ key, value }) |

### 4.13 Health Check

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/health` | Нет | Проверка работоспособности |

```json
{ "status": "ok", "timestamp": 1711100000000 }
```

### 4.14 Payments — Оплата

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/payments/packages` | Нет | Доступные пакеты пополнения |
| `POST` | `/payments/create` | Да | Создать платёж ЮKassa, возвращает URL для редиректа |
| `GET` | `/payments/:id/status` | Да | Проверить статус платежа |
| `GET` | `/payments/history` | Да | История платежей пользователя |
| `POST` | `/payments/webhook` | Нет | Webhook ЮKassa (payment.succeeded / payment.canceled) |

### 4.15 Promo — Промо-коды

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/promo/check/:code` | Да | Проверить валидность промо-кода |
| `GET` | `/promo` | Admin | Список всех промо-кодов |
| `POST` | `/promo` | Admin | Создать промо-код |
| `PUT` | `/promo/:id` | Admin | Обновить промо-код |
| `DELETE` | `/promo/:id` | Admin | Удалить промо-код |
| `GET` | `/promo/:id/stats` | Admin | Статистика использования промо-кода |

### 4.16 Referral — Реферальная система

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/referral/info` | Да | Реферальный код, ссылка, статистика |
| `GET` | `/referral/history` | Да | Список приглашённых пользователей |
| `POST` | `/referral/withdraw` | Да | Вывод реферального заработка на основной баланс |

### 4.17 Documentation — Документация

| Метод | Путь | Auth | Описание |
|-------|------|:----:|----------|
| `GET` | `/documentation` | Нет | Получить содержимое DOCUMENTATION.md |

Возвращает `{ "content": "# markdown..." }`. Используется кнопкой «Документация» в сайдбаре (видна только администраторам).

---

## 5. Схема базы данных

SQLite файл: `data/uspaichat.db` (WAL mode, foreign keys ON).

### Таблица `users`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID пользователя |
| `email` | TEXT | UNIQUE, NULL допустим | Email (null для Telegram-only) |
| `username` | TEXT | NOT NULL | Отображаемое имя |
| `password_hash` | TEXT | NULL | bcrypt-хеш пароля (null для OAuth-only) |
| `telegram_id` | INTEGER | UNIQUE | Telegram ID |
| `telegram_username` | TEXT | — | Telegram username |
| `google_id` | TEXT | UNIQUE | Google sub ID |
| `apple_id` | TEXT | UNIQUE | Apple sub ID |
| `role` | TEXT | NOT NULL, CHECK('admin','user') | Роль. По умолчанию 'user' |
| `is_blocked` | INTEGER | NOT NULL, DEFAULT 0 | Заблокирован ли (1/0) |
| `balance` | REAL | NOT NULL, DEFAULT 0 | Баланс кредитов |
| `avatar` | TEXT | NULL | URL аватара |
| `created_at` | INTEGER | NOT NULL | Unix timestamp создания |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp обновления |

**Первый зарегистрированный пользователь автоматически получает роль `admin`.**

### Таблица `refresh_tokens`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID записи |
| `user_id` | TEXT | NOT NULL, FK users | Владелец токена |
| `token` | TEXT | UNIQUE, NOT NULL | Значение refresh token |
| `expires_at` | INTEGER | NOT NULL | Unix timestamp истечения |
| `created_at` | INTEGER | NOT NULL | Unix timestamp создания |

### Таблица `conversations`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID беседы |
| `user_id` | TEXT | NOT NULL, DEFAULT 'local' | Владелец |
| `title` | TEXT | NOT NULL, DEFAULT 'New Chat' | Заголовок |
| `provider` | TEXT | NOT NULL, DEFAULT 'openai' | Провайдер ('auto','anthropic','openai',...) |
| `model` | TEXT | NOT NULL, DEFAULT 'gpt-4o' | ID модели |
| `system_prompt` | TEXT | DEFAULT '' | Системный промпт |
| `folder_id` | TEXT | DEFAULT NULL | ID папки |
| `is_pinned` | INTEGER | DEFAULT 0 | Закреплена ли (1/0) |
| `token_count` | INTEGER | DEFAULT 0 | Суммарное кол-во токенов |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp |

### Таблица `messages`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID сообщения |
| `conversation_id` | TEXT | NOT NULL, FK conversations | Беседа |
| `role` | TEXT | NOT NULL, CHECK('user','assistant','system') | Роль |
| `content` | TEXT | NOT NULL | Текст сообщения |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |
| `token_count` | INTEGER | DEFAULT 0 | Кол-во выходных токенов |
| `provider` | TEXT | NULL | Провайдер (для assistant) |
| `model` | TEXT | NULL | Модель (для assistant) |
| `files` | TEXT | DEFAULT '[]' | JSON-массив прикреплённых файлов |
| `routing_info` | TEXT | NULL | JSON с информацией авто-роутинга |
| `cost` | REAL | NULL | Стоимость ответа в кредитах (для assistant) |

### Таблица `messages_fts` (FTS5)

Виртуальная таблица для полнотекстового поиска:

| Столбец | Индексируется | Описание |
|---------|:---:|----------|
| `content` | Да | Текст сообщения |
| `conversation_id` | Нет (UNINDEXED) | Для фильтрации |
| `message_id` | Нет (UNINDEXED) | Для связи с messages |
| `role` | Нет (UNINDEXED) | Роль автора |

### Таблица `folders`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID папки |
| `user_id` | TEXT | NOT NULL, FK users | Владелец |
| `name` | TEXT | NOT NULL | Название |
| `color` | TEXT | DEFAULT '#8b5cf6' | HEX цвет |
| `sort_order` | INTEGER | DEFAULT 0 | Порядок сортировки |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

### Таблица `documents`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID документа |
| `conversation_id` | TEXT | NULL | Связь с беседой |
| `filename` | TEXT | NOT NULL | Имя файла |
| `content` | TEXT | NOT NULL | Извлечённый текст (чанк) |
| `chunk_index` | INTEGER | DEFAULT 0 | Индекс чанка |
| `embedding` | TEXT | NULL | Эмбеддинг (зарезервировано) |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

### Таблица `api_keys`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `user_id` | TEXT | NOT NULL, PK часть | ID пользователя или `'__global__'` |
| `provider` | TEXT | NOT NULL, PK часть | Провайдер |
| `api_key` | TEXT | NOT NULL | Зашифрованный API-ключ |
| `base_url` | TEXT | NULL | Кастомный base URL |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp |

Составной PRIMARY KEY: `(user_id, provider)`.

Приоритет при поиске ключа: **пользовательский ключ > глобальный ключ (`__global__`)**.

### Таблица `transactions`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID транзакции |
| `user_id` | TEXT | NOT NULL, FK users | Пользователь |
| `type` | TEXT | NOT NULL, CHECK('topup','charge','refund') | Тип |
| `amount` | REAL | NOT NULL | Сумма (отрицательная для charge) |
| `balance_after` | REAL | NOT NULL | Баланс после операции |
| `description` | TEXT | DEFAULT '' | Описание |
| `admin_id` | TEXT | NULL | Админ (для topup) |
| `provider` | TEXT | NULL | AI-провайдер (для charge) |
| `model` | TEXT | NULL | Модель (для charge) |
| `tokens` | INTEGER | DEFAULT 0 | Кол-во токенов (для charge) |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

### Таблица `settings`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `key` | TEXT | PRIMARY KEY | Ключ настройки |
| `value` | TEXT | NOT NULL | Значение |

Используется для: переопределения цен (`price_openai_gpt-4o`), глобальных настроек.

### Таблица `telegram_auth_codes`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `code` | TEXT | PRIMARY KEY | 6-значный код |
| `user_id` | TEXT | NULL | ID пользователя (заполняется при подтверждении) |
| `telegram_id` | INTEGER | NULL | Telegram ID |
| `status` | TEXT | NOT NULL, CHECK('pending','confirmed','expired') | Статус |
| `type` | TEXT | NOT NULL, DEFAULT 'login' | 'login' или 'link' |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |
| `expires_at` | INTEGER | NOT NULL | Unix timestamp истечения |

### Таблица `shared_conversations`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | Короткий ID ссылки (12 символов) |
| `conversation_id` | TEXT | NOT NULL, FK conversations | Беседа |
| `user_id` | TEXT | NOT NULL, FK users | Владелец |
| `password_hash` | TEXT | NULL | bcrypt-хеш пароля (опционально) |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | Активна ли ссылка |
| `views` | INTEGER | NOT NULL, DEFAULT 0 | Счётчик просмотров |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |
| `expires_at` | INTEGER | NULL | Unix timestamp истечения (зарезервировано) |

### Таблица `prompt_templates`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID шаблона |
| `user_id` | TEXT | NOT NULL, FK users | Владелец |
| `name` | TEXT | NOT NULL | Название шаблона |
| `content` | TEXT | NOT NULL | Текст шаблона |
| `category` | TEXT | DEFAULT 'general' | Категория |
| `is_global` | INTEGER | DEFAULT 0 | Глобальный (видимый всем) |
| `sort_order` | INTEGER | DEFAULT 0 | Порядок сортировки |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp |

### Таблица `payments`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID платежа |
| `yookassa_id` | TEXT | UNIQUE | ID платежа в ЮKassa |
| `user_id` | TEXT | NOT NULL, FK users | Плательщик |
| `amount` | REAL | NOT NULL | Сумма в рублях |
| `credits` | REAL | NOT NULL | Начисленные кредиты |
| `status` | TEXT | NOT NULL | Статус: pending, succeeded, canceled |
| `source` | TEXT | DEFAULT 'web' | Источник: web, telegram |
| `promo_code` | TEXT | NULL | Применённый промо-код |
| `promo_bonus` | REAL | DEFAULT 0 | Бонусные кредиты от промо-кода |
| `metadata` | TEXT | DEFAULT '{}' | JSON с доп. данными |
| `created_at` | INTEGER | NOT NULL | Unix timestamp создания |
| `paid_at` | INTEGER | NULL | Unix timestamp оплаты |

### Таблица `promo_codes`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID промо-кода |
| `code` | TEXT | UNIQUE, NOT NULL | Код (например, WELCOME50) |
| `type` | TEXT | NOT NULL | Тип: bonus (% к пополнению), discount (% скидки), fixed (фикс. кредиты) |
| `value` | REAL | NOT NULL | Значение (процент или сумма) |
| `min_amount` | REAL | DEFAULT 0 | Минимальная сумма платежа |
| `max_uses` | INTEGER | DEFAULT NULL | Максимальное кол-во использований (NULL = безлимит) |
| `uses_count` | INTEGER | DEFAULT 0 | Текущее кол-во использований |
| `per_user_limit` | INTEGER | DEFAULT 1 | Лимит использований на пользователя |
| `valid_from` | INTEGER | NULL | Unix timestamp начала действия |
| `valid_until` | INTEGER | NULL | Unix timestamp окончания действия |
| `is_active` | INTEGER | DEFAULT 1 | Активен ли (1/0) |
| `created_by` | TEXT | FK users | Админ-создатель |
| `created_at` | INTEGER | NOT NULL | Unix timestamp создания |

### Таблица `promo_uses`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID записи |
| `promo_id` | TEXT | NOT NULL, FK promo_codes | Промо-код |
| `user_id` | TEXT | NOT NULL, FK users | Пользователь |
| `payment_id` | TEXT | NULL, FK payments | Связанный платёж |
| `bonus_credits` | REAL | NOT NULL | Начисленные бонусные кредиты |
| `used_at` | INTEGER | NOT NULL | Unix timestamp использования |

### Таблица `referrals`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | TEXT | PRIMARY KEY | UUID записи |
| `referrer_id` | TEXT | NOT NULL, FK users | Пригласивший |
| `referred_id` | TEXT | NOT NULL, UNIQUE, FK users | Приглашённый |
| `bonus_paid` | INTEGER | DEFAULT 0 | Бонус выплачен (1/0) |
| `referrer_bonus` | REAL | DEFAULT 0 | Бонус пригласившему |
| `referred_bonus` | REAL | DEFAULT 0 | Бонус приглашённому |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

### Новые столбцы в `users`

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `referral_code` | TEXT | UNIQUE | Уникальный реферальный код пользователя |
| `referred_by` | TEXT | NULL, FK users | ID пригласившего пользователя |
| `referral_earnings` | REAL | DEFAULT 0 | Накопленный реферальный заработок |

### Миграции

Миграции реализованы как `try/catch ALTER TABLE` в функции `initDB()` файла `backend/src/db/database.js`. Каждый `ALTER TABLE` оборачивается в `try {} catch {}` — если столбец уже существует, ошибка игнорируется.

---

## 6. Функциональность

### 6.1 Мультипровайдерный AI-чат с SSE-стримингом

Поддержка 5 AI-провайдеров через единый интерфейс:

| Провайдер | SDK / Библиотека | Модели | Base URL |
|-----------|-----------------|--------|----------|
| **Anthropic** | `@anthropic-ai/sdk` | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5, 3.5 Sonnet, 3.5 Haiku | По умолчанию |
| **OpenAI** | `openai` | GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, o1 Mini | По умолчанию |
| **Google** | `@google/generative-ai` | Gemini 1.5 Flash, 1.5 Pro, 1.5 Flash 8B, 2.0 Flash | По умолчанию |
| **DeepSeek** | `openai` (кастомный URL) | DeepSeek V3 (chat), DeepSeek R1 (reasoner) | `https://api.deepseek.com/v1` |
| **Kimi** | `openai` (кастомный URL) | Kimi 8K, 32K, 128K | `https://api.moonshot.cn/v1` |

Все модели поддерживают:
- Потоковый вывод (SSE)
- Системный промпт
- Прикрепление изображений (vision)
- Подсчёт токенов

### 6.2 Smart Auto Router

14-мерный классификатор сложности промптов. Автоматически выбирает оптимальную модель по соотношению цена/качество. Подробнее: [раздел 8](#8-smart-router--подробный-разбор).

### 6.3 Папки для организации бесед

- Создание цветных папок с произвольными названиями
- Перетаскивание бесед в папки
- Удаление папки возвращает беседы в корень (не удаляет их)
- Сортировка по `sort_order`

### 6.4 Шаблоны промптов (/ команда)

- Быстрая вставка через `/` в поле ввода
- Фильтрация по имени и содержимому
- Навигация стрелками, вставка по Enter
- Категории (general и кастомные)
- Глобальные шаблоны (создаёт админ, видны всем)

### 6.5 Шаринг бесед

- Создание публичной ссылки `/shared/:shareId`
- Опциональная защита паролем (bcrypt)
- Счётчик просмотров
- Возможность отключить шаринг в любой момент
- Публичная страница показывает всю беседу без авторизации

### 6.6 Экспорт бесед

Три формата:
- **Markdown** (`.md`) — с заголовками, метаинформацией
- **JSON** (`.json`) — структурированные данные
- **Text** (`.txt`) — простой текст

### 6.7 Полнотекстовый поиск

Реализован через SQLite FTS5. Поиск по содержимому всех сообщений пользователя. Фолбэк на `LIKE %query%` если FTS-запрос невалиден.

### 6.8 Админ-панель

Доступна только пользователям с ролью `admin`:

- **Статистика:** общее кол-во пользователей, бесед, сообщений, сегодняшние регистрации, финансовые показатели
- **Управление пользователями:** поиск, смена роли, блокировка, сброс пароля, удаление
- **Все беседы:** просмотр бесед всех пользователей
- **Глобальные API-ключи:** ключи `__global__`, используемые когда у пользователя нет своего ключа
- **Баланс:** пополнение баланса пользователей
- **Транзакции:** история всех финансовых операций
- **Тарифы:** настройка цен за 1K токенов по моделям

### 6.9 Система биллинга (кредиты)

Механизм:
1. Админ пополняет баланс пользователя (`topup`)
2. При каждом ответе AI списываются кредиты (`charge`) — цена зависит от модели
3. Списание атомарное (SQLite transaction)
4. Перед генерацией проверяется минимальный баланс
5. **Админы не тарифицируются** — у них бесплатный доступ

Цены по умолчанию (кредитов за 1K выходных токенов). Стоимость input-токенов заложена в наценку (ratio input:output ~2.5:1). Наценка ~x2.5 по всем моделям.

| Провайдер | Модель | Цена/1K | Категория |
|-----------|--------|---------|-----------|
| Anthropic | Claude Opus 4.6 | 25.0 | Премиум |
| Anthropic | Claude Sonnet 4.6 | 5.0 | Средняя |
| Anthropic | Claude Haiku 4.5 | 1.5 | Бюджетная |
| Anthropic | Claude 3.5 Sonnet | 5.0 | Средняя |
| Anthropic | Claude 3.5 Haiku | 1.2 | Бюджетная |
| OpenAI | GPT-4o | 4.0 | Средняя |
| OpenAI | GPT-4o Mini | 0.3 | Бюджетная |
| OpenAI | GPT-4 Turbo | 12.0 | Премиум |
| OpenAI | o1 | 22.0 | Премиум |
| OpenAI | o1 Mini | 4.5 | Средняя |
| Gemini | Gemini 2.5 Flash | 0.3 | Бюджетная |
| Gemini | Gemini 2.5 Pro | 3.0 | Средняя |
| Gemini | Gemini 2.0 Flash | 0.15 | Бюджетная |
| Gemini | Gemini 2.0 Flash Lite | 0.12 | Бюджетная |
| DeepSeek | DeepSeek V3 | 0.4 | Бюджетная |
| DeepSeek | DeepSeek R1 | 0.8 | Бюджетная |
| Kimi | Kimi 8K | 1.3 | Средняя |
| Kimi | Kimi 32K | 2.5 | Средняя |
| Kimi | Kimi 128K | 6.5 | Премиум |

Админ может переопределить цены через `POST /api/admin/pricing`.

Пользователь видит цены:
- В выпадающем списке моделей (ModelBar) — цена за 1K токенов рядом с названием
- Стоимость каждого ответа — отображается под сообщением AI при наведении
- Вкладка «Тарифы» в модалке оплаты — полная таблица цен + примеры расхода

Подробная финансовая модель: см. [PRICING.md](PRICING.md)

### 6.10 Голосовой ввод (STT) и озвучка (TTS)

Реализовано через Web Speech API (хук `useVoiceChat.ts`):

- **Speech-to-Text:** нажатие на микрофон в поле ввода, распознавание через `SpeechRecognition`
- **Text-to-Speech:** озвучка ответов через `SpeechSynthesis`
- Поддержка русского языка (`ru-RU`)
- Очистка markdown перед озвучкой (удаление блоков кода, ссылок, форматирования)
- Автоматический выбор голоса (приоритет: Google Russian)

### 6.11 Файлы и вложения

- Загрузка до **10 файлов** за раз, макс. **50 МБ** каждый
- Поддерживаемые форматы:
  - **Изображения** — передаются моделям через base64 (vision)
  - **PDF** — извлечение текста через `pdf-parse`
  - **DOCX** — извлечение текста через `mammoth`
  - **Текстовые** — TXT, MD, JS, TS, PY, JSON, CSV, XML, HTML, CSS
- Текст документов разбивается на чанки по 2000 символов и сохраняется для поиска
- Вставка изображений из буфера обмена (Ctrl+V)

### 6.12 Тёмная/Светлая/Системная тема

Три режима:
- **Dark** — тёмная тема (фиолетовые акценты на тёмном фоне)
- **Light** — светлая тема
- **System** — следует настройкам ОС

### 6.13 Интернационализация (i18n)

Три языка:
- **Русский** (ru) — язык по умолчанию
- **English** (en) — полный перевод
- **Китайский** (zh) — частичный перевод

Реализация: `i18next` + `react-i18next`. Язык сохраняется в `localStorage`.

### 6.14 Мобильное приложение (Android + iOS)

Flutter-приложение с полной функциональностью веб-версии:

- Все методы авторизации (нативные SDK для Google/Apple)
- SSE-стриминг через Dio
- Тёмная тема (цвета совпадают с вебом)
- Экраны: чат, беседы, поиск, настройки, профиль, админ, системный промпт
- **Цены моделей** — отображаются в выборе модели с цветовой индикацией
- **Стоимость ответа** — показывается под каждым сообщением AI
- **Экран «Тарифы»** — объяснение кредитов, примеры расхода, таблица цен (открывается из профиля)
- **Привязка аккаунтов** — Google, Apple, Telegram из профиля
- **Реферальная ссылка** — копирование и шеринг из профиля

### 6.15 Интеграция оплаты через ЮKassa

Пополнение баланса кредитов через платёжную систему ЮKassa:

- **Пакеты пополнения** — предустановленные пакеты с бонусами за объём (например, 100 руб. = 100 кредитов, 500 руб. = 550 кредитов)
- **Процесс оплаты:**
  1. Пользователь выбирает пакет и (опционально) вводит промо-код
  2. `POST /api/payments/create` создаёт платёж в ЮKassa и возвращает URL для редиректа
  3. Пользователь оплачивает на стороне ЮKassa
  4. ЮKassa отправляет webhook (`payment.succeeded` / `payment.canceled`)
  5. Сервер зачисляет кредиты на баланс пользователя
- **История платежей** — доступна в профиле пользователя
- **Конфигурация** — через переменные окружения `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_RETURN_URL`
- **Курс** — настраивается через `CREDITS_PER_RUBLE` (по умолчанию 1 рубль = 1 кредит)

### 6.16 Оплата через Telegram-бот

Альтернативный способ пополнения баланса через встроенные платежи Telegram:

- Используется ЮKassa как платёжный провайдер Telegram
- Пользователь выбирает пакет прямо в чате с ботом
- Telegram обрабатывает платёж, бот получает уведомление и зачисляет кредиты
- Настраивается через `TELEGRAM_PAYMENT_TOKEN`

### 6.17 Система промо-кодов

Гибкая система промо-кодов для маркетинговых акций:

- **Типы промо-кодов:**
  - `bonus` — процент бонусных кредитов к пополнению (например, +20%)
  - `discount` — процент скидки на пакет
  - `fixed` — фиксированное количество бонусных кредитов
- **Лимиты:** максимальное кол-во использований, лимит на пользователя, минимальная сумма платежа, срок действия
- **Применение:** при оплате на сайте и через Telegram-бот
- **Управление:** CRUD в админ-панели, статистика использования
- **Проверка:** `GET /api/promo/check/:code` — валидирует код и возвращает условия

### 6.18 Реферальная система

Система привлечения новых пользователей через реферальные ссылки:

- **Реферальный код** — уникальный код генерируется автоматически для каждого пользователя
- **Реферальная ссылка** — `https://app.aifuturenow.ru/?ref=КОД`
- **Бонусы:**
  - Приглашённый получает бонус при регистрации (`REFERRAL_BONUS_REFERRED`)
  - Пригласивший получает бонус (`REFERRAL_BONUS_REFERRER`) + процент от первого пополнения реферала (`REFERRAL_PERCENT`)
- **Реферальный заработок** — накапливается отдельно, выводится на основной баланс через `POST /api/referral/withdraw`
- **Панель рефералов** — в профиле пользователя: код, ссылка, список приглашённых, статистика заработка
- **Deep-link** — поддержка через Telegram-бот

### 6.19 Нативные сплэш-скрины и темы

**Сплэш-скрины:**

- Тёмный (`splash_dark.png`) — нейронная сетка с логотипом на тёмном фоне `#0D0D1A`
- Светлый (`splash_light.png`) — нейронная сетка с логотипом на лавандовом фоне `#F8F7FF`
- Android: ресурсы в 5 плотностях (mdpi — xxxhdpi), отдельные `launch_background.xml` для `drawable` и `drawable-night`
- iOS: через `flutter_native_splash` конфигурацию
- Flutter: `SplashScreen` автоматически выбирает изображение по текущей теме

**Темы приложения:**

- Светлая тема (`AppTheme.light`) — `AppColorsLight` палитра
- Тёмная тема (`AppTheme.dark`) — `AppColors` палитра
- `ThemeProvider` — переключение система/светлая/тёмная с сохранением в `SharedPreferences`
- `MaterialApp` использует `theme` + `darkTheme` + `themeMode`
- Вкладка «Appearance» в настройках: выбор темы + язык

**Конфигурация `pubspec.yaml`:**

```yaml
flutter_native_splash:
  image: assets/images/splash_dark.png
  color: "#0D0D1A"
  image_dark: assets/images/splash_dark.png
  color_dark: "#0D0D1A"
```

---

## 7. Развёртывание

### Production-сервер

| Параметр | Значение |
|----------|---------|
| **URL** | `app.aifuturenow.ru` |
| **IP** | `31.44.7.144` |
| **Process Manager** | PM2 (имя: `uspaichat`) |
| **Port** | `3088` |
| **Web Server** | Nginx (проксирует на :3088) |
| **Node.js** | 20 LTS (установлен через `n`) |

### Команды деплоя

```bash
# На сервере:
cd /path/to/UspAIChat
git pull
cd frontend && npm run build
pm2 restart uspaichat
```

### Настройка PM2

```bash
# Первый запуск
cd backend
PORT=3088 pm2 start src/index.js --name uspaichat

# Автозагрузка при перезапуске
pm2 save
pm2 startup
```

### Пример конфигурации Nginx

```nginx
server {
    listen 80;
    server_name app.aifuturenow.ru;

    location / {
        proxy_pass http://127.0.0.1:3088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;

        # Для SSE
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }

    # Загруженные файлы
    location /uploads {
        proxy_pass http://127.0.0.1:3088/uploads;
    }
}
```

### Сборка мобильного приложения

#### Android (APK)

```bash
cd mobile
flutter build apk --release
# Результат: build/app/outputs/flutter-apk/app-release.apk
```

#### Android (App Bundle для Google Play)

```bash
flutter build appbundle --release
# Результат: build/app/outputs/bundle/release/app-release.aab
```

#### iOS (IPA)

```bash
flutter build ipa --release
# Результат: build/ios/ipa/*.ipa
```

Перед сборкой iOS необходимо:
- Настроить Xcode Signing & Capabilities
- Указать Bundle ID и Team в `ios/Runner.xcodeproj`
- Настроить Apple Developer Program аккаунт

---

## 8. Smart Router — подробный разбор

### Обзор

Smart Router — это локальный 14-мерный классификатор сложности промптов. Работает без обращения к внешним API (задержка <1 мс). Анализирует текст промпта и автоматически выбирает оптимальную модель.

**Цель:** Снизить расходы на 70-90%, направляя простые запросы на дешёвые модели и используя премиум-модели только для сложных задач.

### Алгоритм работы

```
Пользователь отправляет сообщение (provider = "auto")
        │
        ▼
  ┌─────────────────────────────────┐
  │  analyzePrompt(text)            │
  │  → 14 измерений (0.0 - 1.0)    │
  │  → взвешенная сумма → score     │
  └─────────────┬───────────────────┘
                │
                ▼
  ┌─────────────────────────────────┐
  │  getTier(score)                 │
  │  0.0-0.3 → SIMPLE              │
  │  0.3-0.5 → MEDIUM              │
  │  0.5+    → COMPLEX             │
  └─────────────┬───────────────────┘
                │
                ▼
  ┌─────────────────────────────────┐
  │  Выбрать первую доступную       │
  │  модель из TIER_MODELS[tier]    │
  │  (проверка API-ключей)          │
  └─────────────┬───────────────────┘
                │
                ▼
        Стриминг через выбранную модель
```

### 14 измерений (dimensions)

Каждый промпт анализируется по 14 параметрам:

| # | Измерение | Вес | Что анализирует |
|---|-----------|-----|-----------------|
| 1 | **tokens** | 8% | Длина промпта (кол-во слов / 500) |
| 2 | **code** | 15% | Наличие кода: `function`, `class`, `import`, SQL, HTML теги |
| 3 | **reasoning** | 18% | Маркеры рассуждений: «почему», «объясни», «проанализируй», «step by step» |
| 4 | **technical** | 10% | Техническая терминология: «алгоритм», «архитектура», «API», «docker» |
| 5 | **creative** | 5% | Творческие задачи: «напиши стих», «придумай», «сочини» |
| 6 | **simple** | -2% | Простые фразы: «привет», «спасибо», «да/нет» (снижает оценку) |
| 7 | **multiStep** | 12% | Многошаговые задачи: «шаг 1», «сначала...потом», «во-первых» |
| 8 | **questionComplexity** | 5% | Сложные вопросы: «как реализовать», «how to implement» |
| 9 | **imperative** | 3% | Императивные глаголы: «реализуй», «напиши код», «создай» |
| 10 | **constraints** | 4% | Ограничения: «не более», «максимум», «must», «require» |
| 11 | **outputFormat** | 3% | Требования к формату: JSON, таблица, CSV, markdown |
| 12 | **references** | 2% | Ссылки на источники: «согласно», «по данным», «документация» |
| 13 | **negation** | 1% | Отрицания: «не делай», «избегай», «без» |
| 14 | **domain** | 4% | Узкоспециализированные области: медицина, право, ML, физика |

**Бонус за длину:** Промпты длиннее 2000 символов получают +0.1, длиннее 1000 — +0.05.

**Формула:**
```
score = tokens*0.08 + code*0.15 + reasoning*0.18 + technical*0.10
      + creative*0.05 - simple*0.02 + multiStep*0.12 + questionComplexity*0.05
      + imperative*0.03 + constraints*0.04 + outputFormat*0.03
      + references*0.02 + negation*0.01 + domain*0.04 + lengthBonus
```

### Система тиров

| Тир | Диапазон Score | Описание | Пример промпта |
|-----|:-:|----------|---------------|
| **SIMPLE** | 0.0 — 0.3 | Фактические вопросы, переводы, короткие задачи | «Привет!», «Переведи hello на русский» |
| **MEDIUM** | 0.3 — 0.5 | Анализ, структурированные ответы, работа с контекстом | «Объясни разницу между REST и GraphQL» |
| **COMPLEX** | 0.5+ | Код, многошаговые рассуждения, специализированные темы | «Напиши функцию сортировки на Python с оптимизацией для больших массивов» |

### Модели по тирам

#### SIMPLE (дешёвые модели)

| Приоритет | Провайдер | Модель | Цена/1K |
|:-:|-----------|--------|---------|
| 1 | Gemini | Gemini 1.5 Flash | 0.35 |
| 2 | DeepSeek | DeepSeek V3 | 0.3 |
| 3 | OpenAI | GPT-4o Mini | 0.6 |
| 4 | Kimi | Kimi 8K | 0.5 |
| 5 | Anthropic | Claude Haiku 4.5 | 0.25 |

#### MEDIUM (сбалансированные модели)

| Приоритет | Провайдер | Модель | Цена/1K |
|:-:|-----------|--------|---------|
| 1 | OpenAI | GPT-4o | 5.0 |
| 2 | Anthropic | Claude Sonnet 4.6 | 3.0 |
| 3 | Gemini | Gemini 1.5 Pro | 3.5 |
| 4 | Kimi | Kimi 32K | 2.0 |
| 5 | DeepSeek | DeepSeek V3 | 0.3 |

#### COMPLEX (премиум модели)

| Приоритет | Провайдер | Модель | Цена/1K |
|:-:|-----------|--------|---------|
| 1 | Anthropic | Claude Opus 4.6 | 15.0 |
| 2 | Anthropic | Claude Sonnet 4.6 | 3.0 |
| 3 | OpenAI | GPT-4o | 5.0 |
| 4 | Gemini | Gemini 1.5 Pro | 3.5 |
| 5 | DeepSeek | DeepSeek R1 | 2.0 |

### Профили маршрутизации

| Профиль | Описание | Влияние на тир |
|---------|----------|---------------|
| **auto** | Сбалансированный (по умолчанию) | Без изменений |
| **eco** | Максимальная экономия | Понижает тир на 1 уровень |
| **premium** | Максимальное качество | Повышает тир на 1 уровень |

Пример: промпт с оценкой `MEDIUM`:
- `auto` → MEDIUM
- `eco` → SIMPLE
- `premium` → COMPLEX

### Расчёт экономии

Экономия рассчитывается относительно самой дорогой модели (Claude Opus 4.6, 15.0/1K):

```
savings = (15.0 - model.costPer1k) / 15.0 * 100%
```

Примеры:
- Gemini Flash (0.35) → **97.7% экономии**
- GPT-4o Mini (0.6) → **96% экономии**
- GPT-4o (5.0) → **66.7% экономии**

### Confidence (уверенность)

```
confidence = min(0.5 + score, 1.0)
```

Минимальная уверенность: 50%. Максимальная: 100%.

### Отображение на клиенте

При использовании режима Auto:
1. **До начала стриминга** — SSE-событие `routing_info` отправляется клиенту
2. **В UI** — под сообщением ассистента показывается бейдж: «Claude Opus 4.6 (Complex)»
3. **По клику** — модальное окно с деталями:
   - Выбранная модель и провайдер
   - Тир (SIMPLE/MEDIUM/COMPLEX) с цветовым индикатором
   - Процент уверенности
   - Текстовое объяснение выбора
   - Процент экономии
   - Значения по всем 14 измерениям

### Фолбэк-логика

1. Если нет модели с ключом в текущем тире → перебираются все тиры (SIMPLE → MEDIUM → COMPLEX)
2. Если ни один провайдер не настроен → ошибка с предложением добавить ключ
3. Последний резерв → GPT-4o

### Как настроить

Для изменения поведения Smart Router редактируйте `backend/src/services/autoRouter.js`:

- **Веса измерений** — изменить коэффициенты в `analyzePrompt()` (строки 90-104)
- **Пороги тиров** — изменить `getTier()` (строки 135-139)
- **Модели в тирах** — изменить `TIER_MODELS` (строки 145-167)
- **Паттерны распознавания** — изменить регулярные выражения в начале файла (строки 9-21)

---

## Приложение: Зависимости

### Backend

| Пакет | Назначение |
|-------|-----------|
| `express` | HTTP-сервер |
| `better-sqlite3` | SQLite драйвер (синхронный, быстрый) |
| `@anthropic-ai/sdk` | Anthropic Claude API |
| `openai` | OpenAI API (+ DeepSeek, Kimi) |
| `@google/generative-ai` | Google Gemini API |
| `jsonwebtoken` | JWT-токены |
| `bcryptjs` | Хеширование паролей |
| `google-auth-library` | Верификация Google OAuth |
| `node-telegram-bot-api` | Telegram Bot |
| `multer` | Загрузка файлов |
| `pdf-parse` | Извлечение текста из PDF |
| `mammoth` | Извлечение текста из DOCX |
| `uuid` | Генерация UUID |
| `cors` | CORS middleware |
| `dotenv` | Переменные окружения |

### Frontend

| Пакет | Назначение |
|-------|-----------|
| `react` / `react-dom` | UI-фреймворк |
| `zustand` | Управление состоянием |
| `axios` | HTTP-клиент |
| `react-router-dom` | Маршрутизация |
| `react-i18next` / `i18next` | Интернационализация |
| `react-markdown` / `remark-gfm` | Рендеринг Markdown |
| `react-syntax-highlighter` | Подсветка кода |
| `framer-motion` | Анимации |
| `lucide-react` | Иконки |
| `tailwindcss` | CSS-фреймворк |
| `react-textarea-autosize` | Авторазмер textarea |
| `react-hotkeys-hook` | Горячие клавиши |
| `date-fns` | Форматирование дат |
| `clsx` | Условные CSS-классы |
| `vite` | Сборщик |
| `typescript` | Типизация |

---

## 9. Планы развития

### 9.1 Оплата через ЮKassa (реализовано)

Интеграция платёжной системы ЮKassa для пополнения баланса. Подробнее: [раздел 6.15](#615-интеграция-оплаты-через-юkassa) и [раздел 6.16](#616-оплата-через-telegram-бот).

### 9.2 Промо-коды (реализовано)

Система промо-кодов с типами bonus/discount/fixed, лимитами и управлением в админ-панели. Подробнее: [раздел 6.17](#617-система-промо-кодов).

### 9.3 Реферальная система (реализовано)

Привлечение пользователей через реферальные ссылки с бонусами. Подробнее: [раздел 6.18](#618-реферальная-система).

### 9.4 Smart Router (реализовано)

Автоматический выбор AI-модели на основе 14-мерного анализа промпта. Подробнее: [раздел 8](#8-smart-router--подробный-разбор) и [`PLAN_CLAWROUTER.md`](PLAN_CLAWROUTER.md)

### 9.5 Нативные сплэш-скрины (реализовано)

Подробнее: [раздел 6.19](#619-нативные-сплэш-скрины-и-темы).

### 9.6 Светлая тема (реализовано)

Подробнее: [раздел 6.19](#619-нативные-сплэш-скрины-и-темы).

---

## 10. Приложение: мобильные зависимости (Flutter)

| Пакет | Назначение |
|-------|-----------|
| `flutter_riverpod` | Управление состоянием |
| `go_router` | Навигация/маршрутизация |
| `dio` | HTTP-клиент |
| `google_sign_in` | Авторизация через Google |
| `sign_in_with_apple` | Авторизация через Apple |
| `flutter_secure_storage` | Безопасное хранение токенов |
| `url_launcher` | Открытие URL |
| `flutter_markdown` | Рендеринг Markdown |
| `flutter_highlight` | Подсветка кода |
| `cached_network_image` | Кэширование изображений |
| `shimmer` | Скелетон-лоадеры |
| `speech_to_text` | Голосовой ввод |
| `flutter_tts` | Озвучка ответов |
| `image_picker` / `file_picker` | Загрузка файлов |
| `shared_preferences` | Локальное хранение настроек (тема, язык) |
| `share_plus` | Системный шеринг |
| `connectivity_plus` | Проверка соединения |
| `flutter_native_splash` | Нативные сплэш-скрины |
| `flutter_launcher_icons` | Генерация иконок приложения |
