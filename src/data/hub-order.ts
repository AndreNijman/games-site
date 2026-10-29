// What the hub renders: the ranking is fetched once per build (see order.ts).
// HUB_ORDER=static skips the fetch and uses the order in games.ts.
import { GAMES, newestGame, type Game } from "./games";
import { fetchRanking, layout, orderGames, type Placed } from "./order";

const ranking = process.env.HUB_ORDER === "static" ? null : await fetchRanking();
export const ORDER_SOURCE: "visits" | "static" = ranking ? "visits" : "static";
export const ORDERED: Placed[] = layout(orderGames(GAMES, ranking ?? []));
console.info(`[order] ${ORDER_SOURCE}: ${ORDERED.map((g) => g.name + (g.wide ? ` (${g.wide})` : "")).join(", ")}`);

// The hero: the most played game, then a scroll across to the newest one, which
// it advertises. One slide when they are the same game. With no visit data the
// first slide is the first game in GAMES, so it says "Featured" rather than
// claim it is the most played.
export type HeroSlide = { game: Game; tag: string };
const newest = newestGame(GAMES);
export const HERO: HeroSlide[] = [
  { game: ORDERED[0], tag: ORDER_SOURCE === "visits" ? "Most played" : "Featured" },
  ...(newest.host === ORDERED[0].host ? [] : [{ game: newest, tag: "New" }]),
];
