import { describe, expect, it } from "vitest";
import catalog from "../../generated/catalog.json";
import worker from "../../worker/index.js";

// The guard's routes that answer before any D1 lookup, driven by the catalog.
const get = (url: string, init?: RequestInit) => worker.fetch(new Request(url, init), {}, { waitUntil() {} });

describe("the guard reads the catalog", () => {
  it("answers only the hub and registered hosts", async () => {
    expect((await get("https://nowhere.andrenijman.com/robots.txt")).status).toBe(404);
  });
  it("generates crawler files for exactly the hosts that ask for them", async () => {
    // The rest pass through to their own files upstream, which a unit test cannot reach.
    const generated = catalog.games.filter((g) => g.guard && g.crawlerFiles);
    expect(generated.map((g) => g.slug).sort()).toEqual(["krillion", "mc", "memoryburn", "rasists", "scoops", "tung", "wildbound"]);
    for (const game of generated) {
      const res = await get(`https://${game.host}/robots.txt`);
      expect(res.status, game.host).toBe(200);
      expect(await res.text()).toContain(`Sitemap: https://${game.host}/sitemap.xml`);
    }
  });
  it("lists every live game in llms.txt, guests under their own heading", async () => {
    const text = await (await get("https://games.andrenijman.com/llms.txt")).text();
    for (const game of catalog.games.filter((g) => g.live && g.guard)) expect(text, game.name).toContain(`[${game.name}](https://${game.host}/)`);
    expect(text).toContain("Blade Hymn is made by Eason, https://github.com/Eason-F");
  });
  it("takes the webhook only signed", async () => {
    const res = await get("https://games.andrenijman.com/_platform/hook", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });
});
