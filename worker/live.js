// Who is playing right now. Every guarded game page reports in through
// /_guard/client.js: every 20 s while its tab is visible, and once when the tab
// is hidden or closed, with how long since the player last pressed, touched or
// moved anything. One Durable Object keeps the latest report per tab in memory
// only (nothing is written to D1, and an evicted object simply refills within
// 20 s); the admin's live view reads it.

import { DurableObject } from "cloudflare:workers";

/** A visible tab that stops reporting this long is gone (it reports every 20 s). */
export const LIVE_VISIBLE_MS = 50_000;
/** A hidden tab stays listed as "in background" this long after its last report. */
export const LIVE_HIDDEN_MS = 180_000;
/** No input for this long and an open tab counts as idle rather than playing. */
export const LIVE_IDLE_S = 60;
const MAX_TABS = 5000;

const STATES = new Set(["on", "hidden", "gone"]);

/**
 * The client's report, or null if it isn't one: `{ tab, path, idle, state,
 * player, room }`, the last two being who the game says is playing and in
 * which room (shared/net/netdev.js setPlayer), or "".
 */
export function cleanBeat(body) {
  if (!body || typeof body !== "object") return null;
  const tab = String(body.tab || "");
  const state = String(body.state || "on");
  if (!/^[a-z0-9]{4,16}$/.test(tab) || !STATES.has(state)) return null;
  const idle = Number(body.idle);
  return {
    tab,
    state,
    path: String(body.path || "/").slice(0, 120),
    idle: Number.isFinite(idle) && idle >= 0 ? Math.min(Math.round(idle), 86400) : 0,
    player: String(body.player || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24),
    room: String(body.room || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40),
  };
}

/** "playing", "idle" or "background". */
export function liveStatus(entry, now) {
  if (entry.hidden) return "background";
  return now - entry.inputAt > LIVE_IDLE_S * 1000 ? "idle" : "playing";
}

const STATUS_ORDER = { playing: 0, idle: 1, background: 2 };

/** The open tabs, kept apart from the Durable Object so it can be tested in Node. */
export class LiveTabs {
  constructor() { this.tabs = new Map(); }

  /** `entry`: the beat (cleanBeat) plus device, host, country, city and colo. */
  beat(entry, now) {
    const key = `${entry.device}|${entry.host}|${entry.tab}`;
    if (entry.state === "gone") { this.tabs.delete(key); return; }
    const prev = this.tabs.get(key);
    this.tabs.set(key, {
      device: entry.device, host: entry.host, tab: entry.tab, path: entry.path,
      player: entry.player || "", room: entry.room || "",
      country: entry.country || "", city: entry.city || "", colo: entry.colo || "",
      since: prev ? prev.since : now, at: now, inputAt: now - entry.idle * 1000,
      hidden: entry.state === "hidden",
    });
    if (this.tabs.size > MAX_TABS) this.prune(now);
  }

  prune(now) {
    for (const [key, tab] of this.tabs) {
      if (now - tab.at > (tab.hidden ? LIVE_HIDDEN_MS : LIVE_VISIBLE_MS)) this.tabs.delete(key);
    }
  }

  /** Every open tab with its status, playing first, longest-running first within each status. */
  list(now) {
    this.prune(now);
    return [...this.tabs.values()].map((tab) => ({
      ...tab,
      status: liveStatus(tab, now),
      idleS: Math.max(0, Math.round((now - tab.inputAt) / 1000)),
      forS: Math.round((now - tab.since) / 1000),
    })).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.since - b.since);
  }
}

export class Live extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.tabs = new LiveTabs();
  }
  beat(entry) { this.tabs.beat(entry, Date.now()); }
  list() { return this.tabs.list(Date.now()); }
}

/**
 * Tabs grouped by device for the admin view: each device's best status
 * (playing beats idle beats background), its games, and the tabs themselves.
 */
export function liveDevices(tabs) {
  const devices = new Map();
  for (const tab of tabs) {
    const d = devices.get(tab.device) || { device: tab.device, status: tab.status, tabs: [] };
    if (STATUS_ORDER[tab.status] < STATUS_ORDER[d.status]) d.status = tab.status;
    d.tabs.push(tab);
    devices.set(tab.device, d);
  }
  return [...devices.values()].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || Math.min(...a.tabs.map((t) => t.since)) - Math.min(...b.tabs.map((t) => t.since)));
}
