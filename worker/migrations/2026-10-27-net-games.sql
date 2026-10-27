-- Multiplayer lag logs: one row per finished online match, written by each
-- game's relay through the NetLog service-binding entrypoint (worker/netlog.js).
-- `record` is the whole normalised log; the other columns are for filtering.
CREATE TABLE IF NOT EXISTS net_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  at TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  colo TEXT NOT NULL DEFAULT '',
  run_s REAL NOT NULL DEFAULT 0,
  players INTEGER NOT NULL DEFAULT 0,
  laggy INTEGER NOT NULL DEFAULT 0,
  lag TEXT NOT NULL DEFAULT '[]',
  record TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS net_games_game_at ON net_games(game, at DESC);
CREATE INDEX IF NOT EXISTS net_games_at ON net_games(at DESC);
