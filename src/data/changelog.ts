// Every update of every game, from changelog.json (written by
// scripts/changelog.mjs from each game's GitHub Pages deploys). An update is
// one deploy; a game's first is its launch. Summaries are Claude Haiku's,
// some edited by hand; commit subjects are kept for public repositories only.
import data from "./changelog.json";
import { GAMES, type Game } from "./games";

export type Kind = "new" | "fixed" | "improved" | "other";
export type Commit = { sha: string; kind: Kind; text: string };
export type Update = {
  id: number;
  at: string;
  sha: string;
  launch?: boolean;
  rollback?: boolean;
  diverged?: boolean;
  counts: Record<Kind | "hidden", number>;
  commits: Commit[];
  summary: string | null;
  playerFacing: boolean | null;
};
type Entry = { repo: string; public: boolean; seen: number[]; updates: Update[] };

/** A game's slug: the first label of its host, as in /updates/tree. */
export const slugOf = (g: { host: string }) => g.host.split(".")[0];

export type GameLog = {
  game: Game;
  slug: string;
  repo: string;
  public: boolean;
  /** newest first */
  updates: (Update & { n: number })[];
};

const entries = (data as unknown as { games: Record<string, Entry> }).games;

/** The games with a changelog, in the hub's fallback order. */
export const LOGS: GameLog[] = GAMES.flatMap((game) => {
  const slug = slugOf(game);
  const e = entries[slug];
  if (!e || !e.updates.length) return [];
  return [{
    game,
    slug,
    repo: e.repo,
    public: e.public,
    updates: e.updates.map((u, i) => ({ ...u, n: i + 1 })).reverse(),
  }];
});

export type Placed = Update & { n: number; log: GameLog };

/** Every update of every game, newest first. */
export const ALL: Placed[] = LOGS
  .flatMap((log) => log.updates.map((u) => ({ ...u, log })))
  .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);

/** When each game, by host, last had an update players would notice, for the hub's "Updated" sort. */
export const UPDATED = new Map(LOGS.flatMap((log) => {
  const u = log.updates.find((u) => u.playerFacing !== false && u.summary);
  return u ? [[log.game.host, u.at] as const] : [];
}));

export const updatesPath = (slug: string) => `/updates/${slug}`;

export const commitUrl = (log: GameLog, sha: string) => `https://github.com/${log.repo}/commit/${sha}`;

/** 29 Oct 2026, in the site's own time zone, the way the rest of the hub writes dates. */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Perth" });

/** The month an update falls in, for grouping: October 2026. */
export const formatMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "Australia/Perth" });

/** The update's name in a list: the launch, or its number. */
export const updateLabel = (u: Update & { n: number }) => (u.launch ? "Launch" : `Update ${u.n - 1}`);

export const HEADINGS: Record<Kind, string> = { new: "New", fixed: "Fixed", improved: "Improved", other: "Changed" };

/** "4 new, 2 fixed, 3 behind the scenes": what a private game's update contained. */
export function countLine(u: Update): string {
  const parts: string[] = [];
  if (u.counts.new) parts.push(`${u.counts.new} new`);
  if (u.counts.fixed) parts.push(`${u.counts.fixed} fixed`);
  if (u.counts.improved) parts.push(`${u.counts.improved} improved`);
  if (u.counts.other) parts.push(`${u.counts.other} changed`);
  if (u.counts.hidden) parts.push(`${u.counts.hidden} behind the scenes`);
  return parts.join(", ");
}
