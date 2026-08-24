// One-off: reconstruct visit history from the devices table into the visit
// tables. Each device carries exactly two recoverable events, first_seen_at and
// last_seen_at, so the result is a documented floor rather than a true count.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const BOT_AGENT = /bot|crawl|spider|slurp|bingpreview|headless|phantom|puppeteer|playwright|curl|wget|python-requests|libwww|java\/|go-http|okhttp|axios|facebookexternalhit|embedly|quora link|whatsapp|telegram|slackbot|discordbot|twitterbot|linkedinbot|pinterest|redditbot|applebot|petalbot|ahrefs|semrush|mj12|dotbot|screaming frog|lighthouse|gtmetrix|pingdom|uptime|monitor|preview/i;

const perthDay = (stamp) => {
  const iso = String(stamp).replace(" ", "T") + (String(stamp).endsWith("Z") ? "" : "Z");
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
};

const raw = execFileSync("npx", ["--no-install", "wrangler", "d1", "execute", "games-guard",
  "--remote", "--json", "--command",
  "SELECT id, first_seen_at, last_seen_at, last_game, user_agent FROM devices"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

const devices = JSON.parse(raw)[0].results;
const deviceDays = new Set();
const dayHostViews = new Map();
let bots = 0;

for (const device of devices) {
  if (BOT_AGENT.test(device.user_agent || "") || !device.user_agent) { bots++; continue; }
  const host = device.last_game || "games.andrenijman.com";
  const days = new Set([perthDay(device.first_seen_at), perthDay(device.last_seen_at)].filter(Boolean));
  for (const day of days) {
    deviceDays.add(`${day}\u0000${host}\u0000${device.id}`);
    const key = `${day}\u0000${host}`;
    dayHostViews.set(key, (dayHostViews.get(key) || 0) + 1);
  }
}

const esc = (value) => `'${String(value).replace(/'/g, "''")}'`;
const lines = [
  "-- Reconstructed from devices.first_seen_at and devices.last_seen_at.",
  "-- Each device contributes at most two events, so views here are a floor:",
  "-- repeat visits between those two timestamps were never recorded.",
  "PRAGMA foreign_keys = ON;",
  "",
];

const deviceRows = [...deviceDays].map((key) => {
  const [day, host, id] = key.split("\u0000");
  return `(${esc(day)},${esc(host)},${esc(id)})`;
});
for (let i = 0; i < deviceRows.length; i += 400) {
  lines.push(`INSERT OR IGNORE INTO visit_device_days (day, host, device_id) VALUES\n${deviceRows.slice(i, i + 400).join(",\n")};`);
}

const viewRows = [...dayHostViews].map(([key, views]) => {
  const [day, host] = key.split("\u0000");
  return `(${esc(day)},${esc(host)},${views})`;
});
for (let i = 0; i < viewRows.length; i += 400) {
  lines.push(`INSERT INTO visit_days (day, host, views) VALUES\n${viewRows.slice(i, i + 400).join(",\n")}\nON CONFLICT(day, host) DO UPDATE SET views = views + excluded.views;`);
}

writeFileSync("worker/migrations/2026-08-24-visit-backfill.sql", lines.join("\n") + "\n");

const dayTotals = new Map();
for (const [key, views] of dayHostViews) {
  const day = key.split("\u0000")[0];
  dayTotals.set(day, (dayTotals.get(day) || 0) + views);
}
console.log(`devices scanned : ${devices.length}`);
console.log(`bots skipped    : ${bots}`);
console.log(`real devices    : ${devices.length - bots}`);
console.log(`device-days     : ${deviceDays.size}`);
console.log(`day/host rows   : ${dayHostViews.size}`);
console.log("\nreconstructed views per day:");
[...dayTotals].sort().forEach(([day, views]) => console.log(`  ${day}  ${views}`));
