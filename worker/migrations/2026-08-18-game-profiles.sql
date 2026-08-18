PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_profiles (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, game)
);
