# CLAUDE.md — UspAIChat Project Guide

## Project Overview

UspAIChat — self-hosted multi-provider AI chat application with web and mobile clients.

## Architecture

- **Backend:** Express.js + SQLite (better-sqlite3, WAL mode) on Node.js 20
- **Frontend (web):** React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Frontend (mobile):** Flutter 3.29 + Riverpod + GoRouter + Dio
- **Auth:** Google OAuth, Apple Sign-In, Telegram Bot, Email/Password (JWT + refresh tokens)
- **AI Providers:** Anthropic Claude, OpenAI, Google Gemini, DeepSeek, Kimi

## Key Directories

```
backend/src/          — Express server, routes, services, middleware
frontend/src/         — React app (components, store, services, i18n)
mobile/lib/           — Flutter app (screens, providers, data layer)
data/                 — SQLite database (gitignored)
uploads/              — User-uploaded files (gitignored)
```

## Running Locally

```bash
npm run install:all           # install backend + frontend deps
npm run dev:backend           # backend on :3001
npm run dev:frontend          # frontend on :3000 (proxies /api to :3001)
```

## Important Patterns

- Registration is ONLY through Google/Apple/Telegram OAuth. Email form is login-only.
- Users can set a password in Profile after OAuth registration.
- First registered user automatically becomes admin.
- JWT access tokens: 15min. Refresh tokens: 30 days, stored in DB + localStorage.
- Auto-refresh every 12 minutes on frontend.
- Chat uses SSE (Server-Sent Events) via fetch, NOT EventSource (to support Auth header).
- API keys for AI providers are stored in DB (per-user or global `__global__`), NOT in .env.
- Billing: credits system, admin tops up, charges per output token. Admins are not charged.

## Production Server

- **URL:** app.aifuturenow.ru (31.44.7.144)
- **Process manager:** PM2 (name: `uspaichat`, port 3088)
- **Web server:** Nginx
- **Node version:** 20 LTS (installed via `n`)
- **Deploy:** `git pull && cd frontend && npm run build && pm2 restart uspaichat`

## Database

SQLite at `data/uspaichat.db`. Key tables: users, refresh_tokens, conversations, messages, messages_fts (FTS5), transactions, api_keys, settings, documents, telegram_auth_codes.

Migrations are in `backend/src/db/database.js` as try/catch ALTER TABLE statements.

## Environment Variables (backend/.env)

- `PORT` — server port (default 3001, production 3088)
- `JWT_SECRET` — MUST change in production
- `GOOGLE_CLIENT_ID` — for Google OAuth (optional, hides button if absent)
- `APPLE_CLIENT_ID` — for Apple Sign-In (optional)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token from @BotFather (optional)
- `TELEGRAM_BOT_USERNAME` — bot username without @

## Mobile App (Flutter)

Located in `mobile/`. Uses same backend API. Key architecture decisions:
- Riverpod for state (not BLoC) — less boilerplate for this project size
- SSE streaming via Dio `ResponseType.stream` with manual line parsing
- Native Google/Apple sign-in (not web SDK)
- Telegram auth via deep-link + polling (same as web)
- Dark theme colors match web CSS exactly

Build: `cd mobile && flutter build apk --release`

## GitHub

Repository: ircitdev/UspAIChat
