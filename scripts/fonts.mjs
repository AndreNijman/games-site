#!/usr/bin/env node
// ─── fonts.mjs ───────────────────────────────────────────────────────────────
// Copies the two faces the site is set in out of their Fontsource packages
// into public/fonts/, under names that never change. andrenijman.com and
// games.andrenijman.com each serve the same files from their own /fonts/, and
// the games-guard Worker loads the hub's by URL from the pages it draws, so the
// names cannot carry a build hash.
//
//   Fraunces      the "full" build: opsz, wght, SOFT and WONK. The display
//                 type sets SOFT 100 and WONK 1; the smaller builds drop those
//                 axes and the headings would quietly lose their cut.
//   Hanken Grotesk  wght only.
//
// Latin and Latin Extended; src/styles/fonts.css maps each by unicode-range.
// Run after bumping either package: npm run fonts
// ─────────────────────────────────────────────────────────────────────────────
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/fonts");
const FILES = [
  ["@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2", "fraunces-latin.woff2"],
  ["@fontsource-variable/fraunces/files/fraunces-latin-ext-full-normal.woff2", "fraunces-latin-ext.woff2"],
  ["@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2", "hanken-grotesk-latin.woff2"],
  ["@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-ext-wght-normal.woff2", "hanken-grotesk-latin-ext.woff2"],
];

mkdirSync(OUT, { recursive: true });
for (const [from, to] of FILES) {
  copyFileSync(join(ROOT, "node_modules", from), join(OUT, to));
  console.log(`fonts: ${to}`);
}
