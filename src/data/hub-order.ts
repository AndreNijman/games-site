// What the hub renders: the ranking is fetched once per build (see order.ts).
// HUB_ORDER=static skips the fetch and uses the order in games.ts.
import { GAMES } from "./games";
import { fetchRanking, layout, orderGames, type Placed } from "./order";

const ranking = process.env.HUB_ORDER === "static" ? null : await fetchRanking();
export const ORDER_SOURCE: "visits" | "static" = ranking ? "visits" : "static";
export const ORDERED: Placed[] = layout(orderGames(GAMES, ranking ?? []));
console.info(`[order] ${ORDER_SOURCE}: ${ORDERED.map((g) => g.name + (g.wide ? ` (${g.wide})` : "")).join(", ")}`);
