import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../data/uspaichat.db');

mkdirSync(join(__dirname, '../../../data'), { recursive: true });
mkdirSync(join(__dirname, '../../../uploads'), { recursive: true });

let db;

export function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT NOT NULL,
      password_hash TEXT,
      telegram_id INTEGER UNIQUE,
      telegram_username TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      is_blocked INTEGER NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      avatar TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS telegram_auth_codes (
      code TEXT PRIMARY KEY,
      user_id TEXT,
      telegram_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','expired')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('topup','charge','refund')),
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT DEFAULT '',
      admin_id TEXT,
      provider TEXT,
      model TEXT,
      tokens INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'local',
      title TEXT NOT NULL DEFAULT 'New Chat',
      provider TEXT NOT NULL DEFAULT 'openai',
      model TEXT NOT NULL DEFAULT 'gpt-4o',
      system_prompt TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      token_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      token_count INTEGER DEFAULT 0,
      provider TEXT,
      model TEXT,
      files TEXT DEFAULT '[]',
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      embedding TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      user_id TEXT NOT NULL DEFAULT 'local',
      provider TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, provider)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      conversation_id UNINDEXED,
      message_id UNINDEXED,
      role UNINDEXED
    );
  `);

  // Migrations: add missing columns to existing DB
  try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN balance REAL NOT NULL DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN telegram_id INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN telegram_username TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`); } catch {}
  // email can now be NULL for telegram-only accounts
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL`); } catch {}
  try { db.exec(`ALTER TABLE telegram_auth_codes ADD COLUMN type TEXT NOT NULL DEFAULT 'login'`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN apple_id TEXT`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL`); } catch {}

  // First registered user becomes admin automatically
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    db._firstUserIsAdmin = true;
  }

  console.log('Database initialized at', DB_PATH);
  return db;
}

export function getDB() {
  if (!db) initDB();
  return db;
}
