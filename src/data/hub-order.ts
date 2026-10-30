// What the hub renders: the ranking is fetched once per build (see order.ts).
// HUB_ORDER=static skips the fetch and uses the order in games.ts.
import { GAMES, newestGame, type Game } from "./games";
import { fetchRanking, layout, orderGames, type Placed } from "./order";
import { ALL } from "./changelog";

const ranking = process.env.HUB_ORDER === "static" ? null : await fetchRanking();
export const ORDER_SOURCE: "visits" | "static" = ranking ? "visits" : "static";
export const ORDERED: Placed[] = layout(orderGames(GAMES, ranking ?? []));
console.info(`[order] ${ORDER_SOURCE}: ${ORDERED.map((g) => g.name + (g.wide ? ` (${g.wide})` : "")).join(", ")}`);

// The hero: the most played game, then a scroll across to the newest one, then
// the game behind the newest update players would notice (the splash's). A game
// already on an earlier slide is not shown twice. With no visit data the first
// slide is the first game in GAMES, so it says "Featured" rather than claim it
// is the most played.
export type HeroSlide = { game: Game; tag: string };
const updated = ALL.find((u) => u.playerFacing !== false && u.summary)?.log.game;
const slides: HeroSlide[] = [
  { game: ORDERED[0], tag: ORDER_SOURCE === "visits" ? "Most played" : "Featured" },
  { game: newestGame(GAMES), tag: "New" },
  ...(updated ? [{ game: updated, tag: "Just updated" }] : []),
];
export const HERO = slides.filter((s, i) => slides.findIndex((o) => o.game.host === s.game.host) === i);
