PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_saves (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  save_id TEXT NOT NULL,
  name TEXT NOT NULL,
  save_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  evil TEXT NOT NULL DEFAULT 'random',
  hardmode INTEGER NOT NULL DEFAULT 0,
  victory INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, game, save_id)
);
