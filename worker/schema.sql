PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  banned_at TEXT,
  ban_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  ip_prefix TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_game TEXT NOT NULL DEFAULT '',
  banned_at TEXT,
  ban_reason TEXT
);

CREATE TABLE device_aliases (
  alias_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE game_profiles (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, game)
);

CREATE INDEX devices_account_id ON devices(account_id);
CREATE INDEX devices_last_seen_at ON devices(last_seen_at DESC);
CREATE INDEX sessions_account_id ON sessions(account_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);
CREATE INDEX device_aliases_device_id ON device_aliases(device_id);
