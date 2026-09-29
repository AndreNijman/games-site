#!/usr/bin/env node
// ─── postbuild.mjs ───────────────────────────────────────────────────────────
// Runs on dist/ after `astro build` and GATES the build:
//   • every file the hand-written hub served is still published (the Worker
//     builds each game page's social card from /<game>.png)
//   • the page still offers the Worker what it looks for: a plain <head> for
//     its HTMLRewriter, and the account and advertising elements by id
//   • every internal link and asset resolves (/_guard/ is the Worker's)
//   • every <img> has alt text, width and height; every JSON-LD block parses
//   • JavaScript per page stays under budget
// Any failure exits non-zero.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const failures = [];
const fail = (m) => failures.push(m);

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(DIST);
const rel = (f) => "/" + f.slice(DIST.length + 1);
const html = files.filter((f) => f.endsWith(".html"));

// ── parity: what the hand-written hub served, as of 73fc0a7 ─────────────────
const PUBLISHED = [
  "index.html", "og-image.png", "ads.txt", "robots.txt", "sitemap.xml", "CNAME",
  "f16cf9b1e74a180a712e99589444e835.txt",
  "bigtower.png", "bladehymn.png", "bop.png", "celeste.png", "defenders.png", "isuck.png",
  "mc.png", "overpop.png", "scrap.png", "slingwreck.png", "topout.png", "tree.png",
  "tung.png", "wavelength.png", "wildbound.png", "fishing.jpeg",
];
for (const p of PUBLISHED) if (!existsSync(join(DIST, p))) fail(`parity: ${p} is no longer published`);

// ── what the Worker expects of the hub page ──────────────────────────────────
const hub = readFileSync(join(DIST, "index.html"), "utf8");
if (!/<head>/.test(hub)) fail("index.html: no bare <head> for the Worker's HTMLRewriter to prepend to");
for (const id of ["main", "account", "account-name", "nav-signin", "ad-leaderboard", "ad-leaderboard-host", "ad-sticky", "ad-sticky-host", "ad-sticky-close", "ad-rail", "ad-rail-host", "games"])
  if (!hub.includes(`id="${id}"`)) fail(`index.html: no element with id "${id}"`);
if (!hub.includes('action="/_guard/logout"')) fail("index.html: the logout form no longer posts to /_guard/logout");
if (!hub.includes('href="/_guard/login?return=')) fail("index.html: the sign-in link no longer goes to /_guard/login");
if (!hub.includes('meta[name="games-guard-status"]')) fail("index.html: nothing reads the games-guard-status meta");
if (!hub.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9868351013932229")) fail("index.html: the AdSense loader is gone");

// ── links, images, JSON-LD, JS budget ────────────────────────────────────────
const exists = (p) => {
  const clean = decodeURIComponent(p.split("#")[0].split("?")[0]);
  if (clean === "/" || clean === "") return existsSync(join(DIST, "index.html"));
  const f = join(DIST, clean);
  return (existsSync(f) && statSync(f).isFile()) || existsSync(f + ".html");
};
const JS_BUDGET = 16 * 1024;   // uncompressed inline and same-origin script, per page
for (const f of html) {
  const t = readFileSync(f, "utf8");
  const page = rel(f);
  for (const m of t.matchAll(/\s(?:href|src|action)="([^"]*)"/g)) {
    const u = m[1];
    if (u.startsWith("#")) {
      if (u.length > 1 && !t.includes(`id="${u.slice(1)}"`)) fail(`${page}: ${u}, no element with that id`);
      continue;
    }
    if (!u.startsWith("/") || u.startsWith("//") || u.startsWith("/_guard/")) continue;
    if (!exists(u)) fail(`${page}: broken link ${u}`);
  }
  for (const m of t.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="[^"]+"/.test(m[0])) fail(`${page}: <img> without alt text`);
    if (!/\swidth="\d+"/.test(m[0]) || !/\sheight="\d+"/.test(m[0])) fail(`${page}: <img> without width and height`);
  }
  if (!/<title>[^<]+<\/title>/.test(t)) fail(`${page}: no <title>`);
  for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { fail(`${page}: JSON-LD does not parse`); }
  }
  let js = 0;
  for (const m of t.matchAll(/<script[^>]+src="(\/[^"]+)"/g)) { const p = join(DIST, m[1]); if (existsSync(p)) js += statSync(p).size; }
  for (const m of t.matchAll(/<script(?![^>]*(?:src=|application\/ld\+json))[^>]*>([\s\S]*?)<\/script>/g)) js += m[1].length;
  if (js > JS_BUDGET) fail(`${page}: ${Math.round(js / 1024)} KB of JavaScript (budget ${JS_BUDGET / 1024} KB)`);
}

console.log(`postbuild: ${html.length} pages, ${files.length} files`);
if (failures.length) { console.error(failures.map((m) => "✗ " + m).join("\n")); process.exit(1); }
console.log("✓ parity, the Worker's contract, links, images, JSON-LD and JS budget");
