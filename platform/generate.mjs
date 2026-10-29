#!/usr/bin/env node
// Writes generated/catalog.json and the guard's routes in wrangler.jsonc from
// the registry and the games' manifests.
//
//   node platform/generate.mjs              write both
//   node platform/generate.mjs --check      exit 1 if either is out of date
//   node platform/generate.mjs --cache DIR  prefer game.yaml files fetched into DIR
//                                           (platform/fetch-manifests.mjs), and copy
//                                           their screenshots into public/
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildCatalog, PlatformError, publicCatalog, ROOT } from "./lib.mjs";

/** The top-level routes array of wrangler.jsonc, rewritten; env.production's stays empty on purpose. */
export function withRoutes(wrangler, catalog) {
  const zone = catalog.platform.cloudflare.zone;
  const hosts = [catalog.platform.hub.host, ...catalog.games.filter((g) => g.guard).map((g) => g.host)];
  const lines = hosts.map((h) => `    { "pattern": "${h}/*", "zone_name": "${zone}" }`).join(",\n");
  const start = wrangler.indexOf('"routes": [');
  if (start < 0) throw new Error('wrangler.jsonc has no "routes": [');
  const end = wrangler.indexOf("\n  ],", start);
  if (end < 0) throw new Error("wrangler.jsonc: cannot find the end of the routes array");
  return `${wrangler.slice(0, start)}"routes": [\n${lines}\n${wrangler.slice(end + 1)}`;
}

function main() {
  const { values } = parseArgs({ options: { check: { type: "boolean" }, cache: { type: "string" } } });
  let catalog;
  try {
    catalog = buildCatalog({ cacheDir: values.cache });
  } catch (err) {
    if (!(err instanceof PlatformError)) throw err;
    console.error(`The registry or a game.yaml has problems:\n${err.message}`);
    process.exit(1);
  }

  const outputs = [
    [join(ROOT, "generated/catalog.json"), `${JSON.stringify(publicCatalog(catalog), null, 2)}\n`],
    [join(ROOT, "wrangler.jsonc"), withRoutes(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"), catalog)],
  ];
  const stale = outputs.filter(([path, text]) => !existsSync(path) || readFileSync(path, "utf8") !== text);

  if (values.check) {
    for (const [path] of stale) console.error(`${path.slice(ROOT.length + 1)} is out of date: run npm run platform:generate`);
    process.exit(stale.length ? 1 : 0);
  }
  mkdirSync(join(ROOT, "generated"), { recursive: true });
  for (const [path, text] of stale) writeFileSync(path, text);

  // Screenshots fetched from game repositories replace the hub's copies.
  let copied = 0;
  for (const g of catalog.games) {
    const dest = join(ROOT, "public", g.image);
    if (values.cache && g.screenshotSource.startsWith(values.cache) &&
        (!existsSync(dest) || !readFileSync(dest).equals(readFileSync(g.screenshotSource)))) {
      copyFileSync(g.screenshotSource, dest);
      copied++;
    }
  }
  console.log(`${catalog.games.length} games; ${stale.length} file(s) rewritten; ${copied} screenshot(s) updated`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
