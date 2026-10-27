// Multiplayer lag logs from every game relay, one row per finished match.
// Each relay (a separate Worker) calls the NetLog entrypoint over a service
// binding at the end of a match, so nothing here is reachable from the web
// and no shared secret exists. Relays report what they measured; whether a
// match was laggy is decided here, once, with the same limits for every game.
//
// A record, as relays send it (every field but `seats` optional):
//   { at, code, mode, outcome, runTime (s), colo,
//     server: { simSpeed, tickGapMax, stalls, lostMs },
//     seats: [{ name, rttMed, rttP95, rttMax, gapP95, gapMax,
//               fpsMed, fpsMin, frameMax, reconnects }],
//     lag: [ extra notes ] }

/** What counts as laggy, shared with FART TOGETHER's own log. */
export const LAG_LIMITS = { rttP95: 200, gapP95: 150, fpsMed: 40, tickGap: 250, simSpeed: 0.97 };

/** Rows kept per game; older ones are dropped as new ones arrive. */
export const NET_GAMES_KEEP = 2000;

/** Relays allowed to write, by the short name each uses (its hub host's first label). */
export const NET_GAMES = new Set(["fart", "topout", "tung", "bop", "wildbound", "tree", "slingwreck", "scrap", "rasists"]);

const num = (v, max = 1e7) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n * 10) / 10) : 0;
};
const text = (v, max) => String(v ?? "").replace(/[\s\u0000-\u001f]+/g, " ").trim().slice(0, max);

/** Clamp a relay's record to known fields and sizes, and judge it. */
export function normalizeNetLog(game, raw) {
  if (!NET_GAMES.has(game)) throw new Error(`unknown game ${game}`);
  const r = raw && typeof raw === "object" ? raw : {};
  const at = Number.isFinite(Date.parse(r.at)) ? new Date(r.at).toISOString() : new Date().toISOString();
  const seats = (Array.isArray(r.seats) ? r.seats : []).slice(0, 16).map((s) => ({
    name: text(s?.name, 32) || "?",
    rttMed: num(s?.rttMed, 60000), rttP95: num(s?.rttP95, 60000), rttMax: num(s?.rttMax, 60000),
    gapP95: num(s?.gapP95, 600000), gapMax: num(s?.gapMax, 600000),
    fpsMed: num(s?.fpsMed, 1000), fpsMin: num(s?.fpsMin, 1000), frameMax: num(s?.frameMax, 600000),
    reconnects: Math.min(999, Math.floor(num(s?.reconnects))),
  }));
  const server = r.server && typeof r.server === "object" ? {
    simSpeed: Number.isFinite(Number(r.server.simSpeed)) ? Math.round(Number(r.server.simSpeed) * 1000) / 1000 : 1,
    tickGapMax: num(r.server.tickGapMax, 600000), stalls: num(r.server.stalls), lostMs: num(r.server.lostMs),
  } : null;
  const log = {
    game, at,
    code: text(r.code, 16), mode: text(r.mode, 60), outcome: text(r.outcome, 24), colo: text(r.colo, 8),
    runTime: num(r.runTime, 86400 * 7),
    server, seats,
    lag: /** @type {string[]} */ ([]),
  };
  log.lag = judgeNetLog(log, (Array.isArray(r.lag) ? r.lag : []).slice(0, 8).map((l) => text(l, 120)));
  return log;
}

/** What looked laggy, worst-first by kind; empty for a clean match. */
export function judgeNetLog(log, extra = []) {
  const lag = [];
  for (const s of log.seats) {
    if (s.rttP95 > LAG_LIMITS.rttP95) lag.push(`${s.name}: ping p95 ${s.rttP95} ms`);
    if (s.gapP95 > LAG_LIMITS.gapP95) lag.push(`${s.name}: input gaps p95 ${s.gapP95} ms`);
    if (s.fpsMed && s.fpsMed < LAG_LIMITS.fpsMed) lag.push(`${s.name}: ${s.fpsMed} fps`);
    if (s.reconnects) lag.push(`${s.name}: ${s.reconnects} reconnect(s)`);
  }
  const sv = log.server;
  if (sv && log.runTime > 5 && sv.simSpeed < LAG_LIMITS.simSpeed) lag.push(`server: sim at ${Math.round(sv.simSpeed * 100)}% speed`);
  if (sv && sv.tickGapMax > LAG_LIMITS.tickGap) lag.push(`server: tick loop stalled ${sv.tickGapMax} ms`);
  for (const e of extra) if (e && !lag.includes(e)) lag.push(e);
  return lag;
}

// The same statements as migrations/2026-10-27-net-games.sql. The deploy
// token cannot run D1 migrations, so the Worker creates the table itself the
// first time an isolate touches it.
const NET_TABLE = [
  `CREATE TABLE IF NOT EXISTS net_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT NOT NULL, at TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '', mode TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT '',
    colo TEXT NOT NULL DEFAULT '', run_s REAL NOT NULL DEFAULT 0, players INTEGER NOT NULL DEFAULT 0,
    laggy INTEGER NOT NULL DEFAULT 0, lag TEXT NOT NULL DEFAULT '[]', record TEXT NOT NULL)`,
  "CREATE INDEX IF NOT EXISTS net_games_game_at ON net_games(game, at DESC)",
  "CREATE INDEX IF NOT EXISTS net_games_at ON net_games(at DESC)",
];
let tableReady = null;
function ensureNetTable(db) {
  tableReady ||= db.batch(NET_TABLE.map((sql) => db.prepare(sql))).catch((error) => { tableReady = null; throw error; });
  return tableReady;
}

/** Store one record and trim that game's history. */
export async function storeNetLog(db, game, raw) {
  const log = normalizeNetLog(game, raw);
  await ensureNetTable(db);
  await db.batch([
    db.prepare(`INSERT INTO net_games (game, at, code, mode, outcome, colo, run_s, players, laggy, lag, record)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      log.game, log.at, log.code, log.mode, log.outcome, log.colo, log.runTime, log.seats.length,
      log.lag.length ? 1 : 0, JSON.stringify(log.lag), JSON.stringify(log)),
    db.prepare(`DELETE FROM net_games WHERE game = ?1 AND id NOT IN
      (SELECT id FROM net_games WHERE game = ?1 ORDER BY id DESC LIMIT ${NET_GAMES_KEEP})`).bind(log.game),
  ]);
  return log;
}

/** Per-game summary over the last `days` days, busiest first. */
export async function netSummary(db, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  await ensureNetTable(db);
  const rows = await db.prepare(`
    SELECT game, COUNT(*) AS games, SUM(laggy) AS laggy, SUM(players) AS seats, MAX(at) AS last
    FROM net_games WHERE at >= ? GROUP BY game ORDER BY games DESC
  `).bind(since).all();
  return (rows?.results || []).map((r) => ({
    game: r.game, games: Number(r.games || 0), laggy: Number(r.laggy || 0), seats: Number(r.seats || 0), last: r.last,
  }));
}

/** The most recent records, optionally for one game and only the laggy ones. */
export async function netRecent(db, { game = "", laggy = false, limit = 100 } = {}) {
  const where = [];
  const args = [];
  if (game) { where.push("game = ?"); args.push(game); }
  if (laggy) where.push("laggy = 1");
  await ensureNetTable(db);
  const rows = await db.prepare(`SELECT record FROM net_games ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY at DESC LIMIT ${Math.max(1, Math.min(500, limit | 0))}`).bind(...args).all();
  return (rows?.results || []).map((r) => { try { return JSON.parse(r.record); } catch { return null; } }).filter(Boolean);
}

/** Public liveness of the lag logs: per game, matches logged in the last day and the latest one. No players, no pings. */
export async function netHealth(db) {
  await ensureNetTable(db);
  const since = new Date(Date.now() - 86400000).toISOString();
  const rows = await db.prepare(`SELECT game, SUM(CASE WHEN at >= ? THEN 1 ELSE 0 END) AS day, MAX(at) AS last FROM net_games GROUP BY game`).bind(since).all();
  return Object.fromEntries((rows?.results || []).map((r) => [r.game, { lastDay: Number(r.day || 0), last: r.last }]));
}
