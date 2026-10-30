#!/usr/bin/env node
// ─── art.mjs ─────────────────────────────────────────────────────────────────
// Makes the WebP pictures the hub's cards show, in public/art/, from the PNG
// screenshots at the root of public/. The PNGs themselves stay where they are
// and are never renamed: the games-guard Worker builds each game page's social
// card and structured data from https://games.andrenijman.com/<game>.png.
//
// Every picture keeps up to 1400 wide: which cards are wide depends on the
// order the build gives them (src/data/order.ts), so any card may be one.
// Run after changing a screenshot: npm run art
//
// It also writes src/data/art-versions.ts, a hash of each WebP. The hub asks
// for /art/<game>.webp?v=<hash>, so a new picture gets a URL no cache has seen
// and Cloudflare can't keep showing the old one.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { GAMES } from "../src/data/games.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
mkdirSync(join(PUBLIC, "art"), { recursive: true });

const jobs = new Map();
for (const g of GAMES) jobs.set(g.image, 1400);

for (const [png, width] of jobs) {
  const out = join(PUBLIC, "art", png.replace(/\.png$/, ".webp"));
  const info = await sharp(join(PUBLIC, png))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(out);
  console.log(`art: ${png} → art/${png.replace(/\.png$/, ".webp")} ${info.width}×${info.height} ${Math.round(info.size / 1024)} KB`);
}

const versions = [...jobs.keys()].sort().map((png) => {
  const webp = readFileSync(join(PUBLIC, "art", png.replace(/\.png$/, ".webp")));
  return `  ${JSON.stringify(png)}: "${createHash("sha256").update(webp).digest("hex").slice(0, 10)}",`;
});
writeFileSync(
  join(ROOT, "src", "data", "art-versions.ts"),
  `// Written by npm run art: a hash of each card's WebP, for artPath's ?v=.\nexport const ART_VERSIONS: Record<string, string> = {\n${versions.join("\n")}\n};\n`,
);
console.log(`art: src/data/art-versions.ts, ${versions.length} pictures`);
