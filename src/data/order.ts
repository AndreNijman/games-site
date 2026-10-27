// The order of the cards, and which ones are wide.
//
// Pinned games come first, in pin order. The rest follow the games-guard
// Worker's ranking (most visited over the last 30 days), and games it has no
// visits for (hosts not behind the Worker) keep their order in GAMES after
// them. The build fetches the ranking once; if that fails it falls back to the
// order in GAMES, so a build never breaks on it. The scheduled workflow
// rebuilds daily so the order follows the visits. The fetch itself is in
// hub-order.ts, so this module stays pure for the tests.
//
// Wide cards are assigned by position, not by game, because the order changes:
// the first card is wide at every width, and further wide cards are added only
// where needed so that every row is full at two and at three columns.
import type { Game } from "./games";

/** Always first, in this order. */
export const PINNED = ["fart.andrenijman.com", "stink.andrenijman.com", "rasists.andrenijman.com", "slingwreck.andrenijman.com", "memoryburn.andrenijman.com"];

export const POPULAR_URL = "https://games.andrenijman.com/_guard/popular";

export type Wide = "all" | "lg";
export type Placed = Game & { wide?: Wide };

export function orderGames(games: Game[], ranked: string[], pinned: string[] = PINNED): Game[] {
  const byHost = new Map(games.map((g) => [g.host, g]));
  const out: Game[] = [];
  const seen = new Set<string>();
  const take = (host: string) => {
    const g = byHost.get(host);
    if (g && !seen.has(host)) { out.push(g); seen.add(host); }
  };
  pinned.forEach(take);
  ranked.forEach(take);
  games.forEach((g) => take(g.host));
  return out;
}

/** Empty cells left by CSS grid's default (sparse) auto-placement. */
export function holes(wides: (Wide | undefined)[], columns: 2 | 3): number {
  let row = 0, col = 0, cells = 0;
  for (const w of wides) {
    const span = w === "all" || (w === "lg" && columns === 3) ? 2 : 1;
    if (col + span > columns) { cells += columns - col; row++; col = 0; }
    col += span;
    if (col === columns) { row++; col = 0; }
  }
  if (col > 0) cells += columns - col;
  return cells;
}

/**
 * The first card is wide everywhere. If rows are still left open, the fewest
 * further "lg" (three columns only) or "all" cards that close them, placed as
 * early as possible after the second card: the busier games get the room.
 */
export function layout(games: Game[]): Placed[] {
  const base: (Wide | undefined)[] = games.map((_, i) => (i === 0 ? "all" : undefined));
  const full = (w: (Wide | undefined)[]) => holes(w, 2) === 0 && holes(w, 3) === 0;
  const slots = games.map((_, i) => i).filter((i) => i >= 2);
  for (let extra = 0; extra <= 3; extra++) {
    for (const picks of combinations(slots, extra)) {
      for (const kinds of variants(extra)) {
        const w = [...base];
        picks.forEach((i, k) => { w[i] = kinds[k]; });
        if (full(w)) return games.map((g, i) => ({ ...g, wide: w[i] }));
      }
    }
  }
  return games.map((g, i) => ({ ...g, wide: base[i] }));
}

function* combinations<T>(items: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) { yield acc; return; }
  for (let i = start; i < items.length; i++) yield* combinations(items, k, i + 1, [...acc, items[i]]);
}

function* variants(k: number): Generator<Wide[]> {
  // "lg" first: a card wide at three columns only disturbs fewer rows
  for (let mask = 0; mask < 1 << k; mask++) yield Array.from({ length: k }, (_, i) => (mask >> i) & 1 ? "all" : "lg");
}

/** Hosts by visits, or null when the ranking cannot be had. */
export async function fetchRanking(url = POPULAR_URL, timeoutMs = 8000): Promise<string[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { hosts?: unknown };
    if (!Array.isArray(body.hosts) || !body.hosts.every((h) => typeof h === "string")) throw new Error("no hosts list");
    return body.hosts as string[];
  } catch (error) {
    console.warn(`[order] ranking unavailable (${(error as Error).message}); using the order in games.ts`);
    return null;
  }
}
