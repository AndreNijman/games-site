-- Blade Hymn per-stage speedrun times.
-- One best row per submitter per stage: signed-in players key on their
-- games.andrenijman.com account, signed-out players on their device cookie,
-- so one person cannot fill the board from many attempts or devices.
CREATE TABLE IF NOT EXISTS blade_hymn_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  device_id TEXT,
  name TEXT NOT NULL,
  ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS blade_hymn_runs_level_ms ON blade_hymn_runs(level, ms);
CREATE INDEX IF NOT EXISTS blade_hymn_runs_account ON blade_hymn_runs(level, account_id);
CREATE INDEX IF NOT EXISTS blade_hymn_runs_device ON blade_hymn_runs(level, device_id);
