#!/usr/bin/env node
// Fetches each registered repository's game.yaml, and the screenshot it names,
// from the head of its default branch into a cache directory, pinned to that
// commit. generate.mjs --cache <dir> then prefers these over manifests/.
// A repository without a game.yaml yet is skipped: its staged manifest stays.
//
//   GH_TOKEN=... node platform/fetch-manifests.mjs --out .platform-cache
//
// Writes <out>/<slug>/game.yaml, <out>/<slug>/<screenshot>, and <out>/shas.json
// ({ slug: commit }) for the deploy jobs.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { loadRegistry } from "./lib.mjs";

const API = "https://api.github.com";

async function gh(path, token, accept = "application/vnd.github+json") {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "games-platform",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return accept.endsWith("raw") ? Buffer.from(await res.arrayBuffer()) : res.json();
}

export async function fetchManifests({ out, token, registry = loadRegistry(), log = console.log }) {
  const shas = {};
  for (const entry of registry) {
    if (entry.kind !== "pages" || !entry.repo || !entry.enabled) continue;
    const repo = await gh(`/repos/${entry.repo}`, token);
    if (!repo) {
      log(`${entry.slug}: ${entry.repo} not found (or not readable with this token); keeping the staged manifest`);
      continue;
    }
    const head = await gh(`/repos/${entry.repo}/commits/${encodeURIComponent(repo.default_branch)}`, token);
    const sha = head.sha;
    const raw = await gh(`/repos/${entry.repo}/contents/game.yaml?ref=${sha}`, token, "application/vnd.github.raw");
    if (!raw) {
      log(`${entry.slug}: no game.yaml at ${sha.slice(0, 7)}; keeping the staged manifest`);
      continue;
    }
    const dir = join(out, entry.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "game.yaml"), raw);
    let game;
    try {
      game = parse(raw.toString("utf8"));
    } catch (err) {
      // generate.mjs reports it with the rest; nothing more to fetch.
      log(`${entry.slug}: game.yaml does not parse: ${err.message}`);
      continue;
    }
    if (typeof game?.screenshot === "string" && !game.screenshot.includes("..")) {
      const shot = await gh(`/repos/${entry.repo}/contents/${game.screenshot.split("/").map(encodeURIComponent).join("/")}?ref=${sha}`, token, "application/vnd.github.raw");
      if (shot) {
        mkdirSync(dirname(join(dir, game.screenshot)), { recursive: true });
        writeFileSync(join(dir, game.screenshot), shot);
      }
    }
    shas[entry.slug] = sha;
    log(`${entry.slug}: ${entry.repo}@${sha.slice(0, 7)}`);
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "shas.json"), `${JSON.stringify(shas, null, 2)}\n`);
  return shas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { out: { type: "string", default: ".platform-cache" } } });
  await fetchManifests({ out: values.out, token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
}
