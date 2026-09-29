import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAMES, FEATURED, artPath } from "../../src/data/games";

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
const OUTSIDE_WORKER = new Set(["scrap.andrenijman.com"]);

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
  it("fills every row at two and at three columns", () => {
    const all = GAMES.filter((g) => g.wide === "all").length;
    const lg = GAMES.filter((g) => g.wide === "lg").length;
    // A wide card takes one extra cell. If this fails after adding a game,
    // move or add a wide card rather than leave one alone on a row.
    expect((GAMES.length + all) % 2, "two columns").toBe(0);
    expect((GAMES.length + all + lg) % 3, "three columns").toBe(0);
  });
  it("features a game that is on the hub", () => {
    expect(GAMES.some((g) => g.host === FEATURED.host)).toBe(true);
  });
});
