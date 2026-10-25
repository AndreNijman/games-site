import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAMES, FEATURED, artPath, type Game } from "../../src/data/games";
import { PINNED, holes, layout, orderGames } from "../../src/data/order";

// The Worker's own table, read out of worker/index.js without running the
// Worker: the object literal between `const GAMES = {` and the next `};`.
function workerGames(): Record<string, { name: string; image: string; credit?: string }> {
  const src = readFileSync("worker/index.js", "utf8");
  const start = src.indexOf("const GAMES = {");
  const end = src.indexOf("\n};\n", start);
  const literal = src.slice(start + "const GAMES = ".length, end + 2);
  const mcHost = src.match(/const MC_HOST = "([^"]+)"/)![1];
  return new Function("MC_HOST", `return ${literal}`)(mcHost);
}

// On the hub but not behind the Worker: served by its own host.
// memoryburn and slipstream have no games-guard route yet: the broker token cannot add Worker routes.
const OUTSIDE_WORKER = new Set(["scrap.andrenijman.com", "memoryburn.andrenijman.com", "slipstream.andrenijman.com"]);

describe("the hub and the Worker agree", () => {
  const worker = workerGames();
  it("every game the Worker frames is on the hub", () => {
    const hub = new Set(GAMES.map((g) => g.host));
    for (const host of Object.keys(worker)) expect(hub.has(host), host).toBe(true);
  });
  it("every game on the hub is framed by the Worker, or known not to be", () => {
    for (const g of GAMES) if (!OUTSIDE_WORKER.has(g.host)) expect(worker[g.host], g.host).toBeDefined();
  });
  it("on names, screenshots and credits", () => {
    for (const g of GAMES) {
      const w = worker[g.host];
      if (!w) continue;
      expect(g.name, g.host).toBe(w.name);
      expect(g.image, g.host).toBe(w.image);
      expect(g.credit, g.host).toBe(w.credit);
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
  it("puts the pins first, then the ranking, then the unranked in GAMES order", () => {
    const ranked = ["tung.andrenijman.com", "slingwreck.andrenijman.com", "bop.andrenijman.com", "nowhere.example.com"];
    const out = hosts(orderGames(GAMES, ranked));
    expect(out.slice(0, 4)).toEqual([...PINNED, "tung.andrenijman.com", "bop.andrenijman.com"]);
    const rest = hosts(GAMES).filter((h) => !out.slice(0, 4).includes(h));
    expect(out.slice(4)).toEqual(rest);
  });
  it("is every game exactly once whatever the ranking says", () => {
    for (const ranked of [[], ["x"], hosts(GAMES).reverse(), [...hosts(GAMES), ...hosts(GAMES)]]) {
      const out = hosts(orderGames(GAMES, ranked));
      expect(out.length).toBe(GAMES.length);
      expect(new Set(out)).toEqual(new Set(hosts(GAMES)));
    }
  });
  it("pins only games that are on the hub", () => {
    for (const host of PINNED) expect(GAMES.some((g) => g.host === host), host).toBe(true);
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
        expect(w[1]).toBeUndefined(); // the second pin sits beside the first
      }
    }
  });
});
