// Every game on the hub. The cards, the count in the strip and the
// CollectionPage structured data are all drawn from this list, so they cannot
// disagree. The hub shows them in the order order.ts gives (the most visited
// first); this order is the fallback and places games with no visit data.
//
// The list itself is generated/catalog.json, which `npm run platform:generate`
// draws from registry/ and each game's game.yaml (see PLATFORM.md): the
// games-guard Worker reads the same file, so the two cannot drift. A game is
// here when its registry entry is enabled and listed and its game.yaml says
// publish.
import catalog from "../../generated/catalog.json";

export type Game = {
  host: string;
  name: string;
  genre: string[];
  /** the structured-data description */
  description: string;
  /** the line on the card */
  meta: string;
  /** a visible credit, when the game is not only Andre's */
  credit?: string;
  /** the screenshot at the root of public/; art/<name>.webp is made from it */
  image: string;
  alt: string;
  /** the link's accessible name */
  label: string;
  author?: { "@type": "Person" | "Organization"; name: string; url?: string };
  isBasedOn?: string[];
};

type CatalogGame = (typeof catalog.games)[number] & {
  credit?: string;
  author?: { type: "Person" | "Organization"; name: string; url?: string };
  basedOn?: string[];
};

export const GAMES: Game[] = (catalog.games as CatalogGame[])
  .filter((g) => g.live && g.listed)
  .map((g) => ({
    host: g.host,
    name: g.name,
    genre: g.genre,
    description: g.description,
    meta: g.meta,
    ...(g.credit ? { credit: g.credit } : {}),
    image: g.image,
    alt: g.alt,
    label: g.label,
    ...(g.author ? { author: { "@type": g.author.type, name: g.author.name, ...(g.author.url ? { url: g.author.url } : {}) } } : {}),
    ...(g.basedOn ? { isBasedOn: g.basedOn } : {}),
  }));

// The picture beside the headline.
export const FEATURED = {
  host: "slingwreck.andrenijman.com",
  image: "slingwreck.png",
  width: 2000,
  height: 1050,
  alt: "SLINGWRECK: a wooden and glass fortress collapsing across green hills",
  label: "Play SLINGWRECK, a slingshot demolition game",
  cap: "SLINGWRECK · a little good destruction",
};

export const gameUrl = (g: { host: string }) => `https://${g.host}/`;
export const artPath = (image: string) => `/art/${image.replace(/\.png$/, ".webp")}`;
