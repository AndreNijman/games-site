#!/usr/bin/env node
// ─── art.mjs ─────────────────────────────────────────────────────────────────
// Makes the WebP pictures the hub's cards show, in public/art/, from the PNG
// screenshots at the root of public/. The PNGs themselves stay where they are
// and are never renamed: the games-guard Worker builds each game page's social
// card and structured data from https://games.andrenijman.com/<game>.png.
//
// Cards are 800 wide, enough for a card at twice the pixels. The hero and the
// wide cards keep up to 1400. Run after changing a screenshot: npm run art
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { GAMES, FEATURED } from "../src/data/games.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
mkdirSync(join(PUBLIC, "art"), { recursive: true });

const jobs = new Map();
for (const g of GAMES) jobs.set(g.image, Math.max(jobs.get(g.image) ?? 0, g.wide ? 1400 : 800));
jobs.set(FEATURED.image, 1400);

for (const [png, width] of jobs) {
  const out = join(PUBLIC, "art", png.replace(/\.png$/, ".webp"));
  const info = await sharp(join(PUBLIC, png))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(out);
  console.log(`art: ${png} → art/${png.replace(/\.png$/, ".webp")} ${info.width}×${info.height} ${Math.round(info.size / 1024)} KB`);
}
