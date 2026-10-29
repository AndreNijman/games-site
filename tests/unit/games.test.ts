import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../../generated/catalog.json";
import { GAMES, FEATURED, artPath, type Game } from "../../src/data/games";
import { holes, layout, orderGames } from "../../src/data/order";

// The hub and the Worker both read generated/catalog.json; these hold the hub
// to the part of it that should be on the cards (tests/unit/platform.test.ts
// covers the generator itself).
describe("the hub and the catalog agree", () => {
  const shown = catalog.games.filter((g) => g.live && g.listed);
  it("every live, listed game has a card, in catalog order", () => {
    expect(GAMES.map((g) => g.host)).toEqual(shown.map((g) => g.host));
  });
  it("on names, screenshots and credits", () => {
    for (const g of GAMES) {
      const c = catalog.games.find((x) => x.host === g.host)! as (typeof catalog.games)[number] & { credit?: string };
      expect(g.name, g.host).toBe(c.name);
      expect(g.image, g.host).toBe(c.image);
      expect(g.credit, g.host).toBe(c.credit);
    }
  });
});

describe("pictures", () => {
  it("every screenshot the Worker's social cards use is published", () => {
    for (const g of GAMES) expect(existsSync(`public/${g.image}`), g.image).toBe(true);
  });
  it("every card and the hero have their WebP (npm run art)", () => {
    for (const g of GAMES) expect(existsSync(`public${artPath(g.image)}`), g.image).toBe(true);
    expect(existsSync(`public${artPath(FEATURED.image)}`)).toBe(true);
  });
  it("say what they show", () => {
    for (const g of GAMES) expect(g.alt.length, g.host).toBeGreaterThan(20);
  });
});

describe("the gallery", () => {
  it("has no game twice", () => {
    expect(new Set(GAMES.map((g) => g.host)).size).toBe(GAMES.length);
  });
  it("features a game that is on the hub", () => {
    expect(GAMES.some((g) => g.host === FEATURED.host)).toBe(true);
  });
});

describe("the order", () => {
  const hosts = (games: Game[]) => games.map((g) => g.host);
  it("puts the ranking first, then the unranked in GAMES order", () => {
    const ranked = ["tung.andrenijman.com", "slingwreck.andrenijman.com", "bop.andrenijman.com", "nowhere.example.com"];
    const out = hosts(orderGames(GAMES, ranked));
    expect(out.slice(0, 3)).toEqual(["tung.andrenijman.com", "slingwreck.andrenijman.com", "bop.andrenijman.com"]);
    const rest = hosts(GAMES).filter((h) => !out.slice(0, 3).includes(h));
    expect(out.slice(3)).toEqual(rest);
  });
  it("is every game exactly once whatever the ranking says", () => {
    for (const ranked of [[], ["x"], hosts(GAMES).reverse(), [...hosts(GAMES), ...hosts(GAMES)]]) {
      const out = hosts(orderGames(GAMES, ranked));
      expect(out.length).toBe(GAMES.length);
      expect(new Set(out)).toEqual(new Set(hosts(GAMES)));
    }
  });
});

describe("the gallery layout", () => {
  it("counts holes the way sparse grid placement leaves them", () => {
    expect(holes(["all", undefined, undefined, undefined, undefined], 3)).toBe(0);
    expect(holes(["all", undefined, undefined], 3)).toBe(2);
    expect(holes([undefined, undefined, "lg", undefined], 3)).toBe(1); // lg cannot start in column 3
    expect(holes(["all", undefined], 2)).toBe(1);
  });
  it("fills every row at two and at three columns for any order and size", () => {
    const shuffled = [...GAMES].reverse();
    // a hub smaller than six cards may have no full layout; it never will be
    for (let n = 6; n <= GAMES.length; n++) {
      for (const games of [GAMES.slice(0, n), shuffled.slice(0, n)]) {
        const w = layout(games).map((g) => g.wide);
        expect(holes(w, 2), `${n} at two`).toBe(0);
        expect(holes(w, 3), `${n} at three`).toBe(0);
        expect(w[0]).toBe("all");
        expect(w[1]).toBeUndefined(); // the second card sits beside the first
      }
    }
  });
});
