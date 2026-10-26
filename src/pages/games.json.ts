// The hub's cards as data, in the order the hub shows them, for the gallery
// on andrenijman.com: its build fetches this, copies the art and lays out the
// first few. Same fields as a card; the home page works out its own wide
// cards, so `wide` is left out.
import type { APIRoute } from "astro";
import { artPath, gameUrl } from "../data/games";
import { ORDERED, ORDER_SOURCE } from "../data/hub-order";

export const GET: APIRoute = () =>
  new Response(JSON.stringify({
    source: ORDER_SOURCE,
    games: ORDERED.map((g) => ({
      host: g.host,
      name: g.name,
      href: gameUrl(g),
      kind: g.genre.join(" · "),
      text: g.meta,
      ...(g.credit ? { credit: g.credit } : {}),
      art: artPath(g.image),
      alt: g.alt,
      label: g.label,
    })),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
