#!/usr/bin/env node
// ─── changelog.mjs ───────────────────────────────────────────────────────────
// Brings src/data/changelog.json up to date with every game's deploys.
//
// An update is one successful GitHub Pages deployment of a game's repository
// (src/data/games.ts, `repo`). What went into it is the commits since the one
// before; a game's first deploy is its launch. Claude Haiku writes the line
// players read, once, and it is kept: an update already in the file is never
// fetched or rewritten again, so a hand edit to its summary stays.
//
// Commit subjects are only stored for public repositories. A private game's
// update keeps its summary and the count of each kind of change.
//
//   node scripts/changelog.mjs                 fetch new deploys, summarise them
//   node scripts/changelog.mjs --no-summaries  fetch only (summaries next time)
//   node scripts/changelog.mjs --only tree,bop
//   node scripts/changelog.mjs --resummarize tree   write tree's summaries again (or "all")
//
// GITHUB_TOKEN (or GH_TOKEN, or `gh auth token`) reads the repositories;
// ANTHROPIC_API_KEY writes the summaries. Without a key the updates are still
// recorded, and the next run with one summarises them.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { GAMES } from "../src/data/games.ts";
import { BEHIND_THE_SCENES, MODEL, OTHER_GAMES, SCHEMA, SYSTEM, classify, countKinds, isBuildBranch, outcome, prompt, sourceSha, validSummary } from "./changelog-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "src/data/changelog.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = option("--only")?.split(",");
const resummarize = option("--resummarize")?.split(",") ?? [];
const summarise = !flag("--no-summaries");

const slugOf = (g) => g.host.split(".")[0];

// ── GitHub ───────────────────────────────────────────────────────────────────
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || (() => {
  try { return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim(); } catch { return ""; }
})();
if (!token) throw new Error("No GitHub token: set GITHUB_TOKEN or sign in with gh");
let calls = 0;

async function gh(path, { allow404 = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    calls++;
    const res = await fetch(`https://api.github.com/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (res.ok) return res.json();
    if (allow404 && (res.status === 404 || res.status === 422)) return null;
    if (attempt < 3 && (res.status >= 500 || res.status === 403 || res.status === 429)) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`GitHub ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function deploymentsOf(repo) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`repos/${repo}/deployments?environment=github-pages&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

/** Every commit in head that base lacks, oldest first; null when the range is gone. */
async function commitsBetween(repo, base, head) {
  const out = [];
  let status = "";
  for (let page = 1; ; page++) {
    const c = await gh(`repos/${repo}/compare/${base}...${head}?per_page=100&page=${page}`, { allow404: true });
    if (!c) return null;
    status = c.status;
    out.push(...c.commits);
    if (c.commits.length < 100 || out.length >= c.total_commits) break;
  }
  return { status, commits: out };
}

// ── the file ─────────────────────────────────────────────────────────────────
const load = () => {
  try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return null; }
};
const data = load() ?? {};
data.$comment = "Written by scripts/changelog.mjs from each game's GitHub Pages deploys. Summaries may be edited by hand: an update already here is never rewritten.";
data.games ??= {};
function save() {
  const sorted = Object.fromEntries(Object.entries(data.games).sort(([a], [b]) => a.localeCompare(b)));
  const out = { $comment: data.$comment, games: sorted };
  writeFileSync(FILE + ".tmp", JSON.stringify(out, null, 2) + "\n");
  renameSync(FILE + ".tmp", FILE);
}

// ── one game ─────────────────────────────────────────────────────────────────
/** What the file keeps of a commit, given whether the repository is public. */
const kept = (classified, sha, isPublic) =>
  isPublic && classified.kind !== "hidden" ? { sha, kind: classified.kind, text: classified.text } : null;

async function syncGame(game) {
  const slug = slugOf(game);
  const repoInfo = await gh(`repos/${game.repo}`);
  const isPublic = !repoInfo.private;
  const entry = (data.games[slug] ??= { repo: game.repo, public: isPublic, seen: [], updates: [] });
  entry.repo = game.repo;
  entry.public = isPublic;
  // a repository that went private takes its commit subjects off the site,
  // and a subject that newly matches OTHER_GAMES leaves it too
  for (const u of entry.updates) {
    if (!isPublic) { u.commits = []; continue; }
    const off = u.commits.filter((c) => OTHER_GAMES.test(c.text));
    for (const c of off) { u.counts[c.kind] -= 1; u.counts.hidden += 1; }
    u.commits = u.commits.filter((c) => !off.includes(c));
  }

  const seen = new Set(entry.seen);
  const deployments = (await deploymentsOf(game.repo))
    .filter((d) => !seen.has(d.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  let added = 0;

  for (const d of deployments) {
    const statuses = await gh(`repos/${game.repo}/deployments/${d.id}/statuses?per_page=100`);
    const state = outcome(statuses.map((s) => s.state));
    // a deploy still building holds back everything after it until the next run
    if (state === "pending") break;
    entry.seen.push(d.id);
    if (state === "failed") continue;

    let built = null;
    if (isBuildBranch(d.ref)) built = (await gh(`repos/${game.repo}/commits/${d.sha}`)).commit.message;
    const sha = sourceSha(d, built);
    if (!sha) continue;

    const last = entry.updates.at(-1);
    if (last && (last.sha === sha || last.sha.startsWith(sha) || sha.startsWith(last.sha))) continue;

    const update = { id: d.id, at: d.created_at, sha };
    let classified = [];
    let shas = [];
    if (!last) {
      update.launch = true;
    } else {
      const range = await commitsBetween(game.repo, last.sha, sha);
      if (range && range.status === "identical") continue;
      if (range && range.status === "behind") {
        update.rollback = true;
      } else if (range && range.commits.length) {
        classified = range.commits.map((c) => classify(c.commit.message));
        shas = range.commits.map((c) => c.sha);
        if (range.status === "diverged") update.diverged = true;
      } else {
        // the old commit is gone (history rewritten): all that is known is the new one
        const head = await gh(`repos/${game.repo}/commits/${sha}`, { allow404: true });
        if (!head) continue;
        classified = [classify(head.commit.message)];
        shas = [head.sha];
        update.diverged = true;
      }
    }
    update.sha = shas.at(-1) ?? (await resolveSha(game.repo, sha));
    update.counts = countKinds(classified);
    update.commits = classified.map((c, i) => kept(c, shas[i], isPublic)).filter(Boolean);
    update.summary = update.rollback ? "Went back to an earlier version." : null;
    update.playerFacing = update.rollback ? true : null;
    entry.updates.push(update);
    added++;
  }
  return { slug, added, total: entry.updates.length };
}

const resolveSha = async (repo, sha) => (sha.length === 40 ? sha : (await gh(`repos/${repo}/commits/${sha}`)).sha);

// ── summaries ────────────────────────────────────────────────────────────────
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
let spent = { input: 0, output: 0 };

/** The commits behind an update again, for the prompt (they are not all kept). */
async function commitsFor(game, entry, i) {
  const u = entry.updates[i];
  if (u.launch) {
    // a fork's history before the first deploy is mostly someone else's
    if (game.isBasedOn) return { classified: [], launchNote: `It is built on ${game.isBasedOn.join(" and ")}.` };
    const commits = await gh(`repos/${game.repo}/commits?sha=${u.sha}&per_page=100`);
    return { classified: commits.map((c) => classify(c.commit.message)) };
  }
  const range = await commitsBetween(game.repo, entry.updates[i - 1].sha, u.sha);
  if (!range || !range.commits.length) {
    const head = await gh(`repos/${game.repo}/commits/${u.sha}`);
    return { classified: [classify(head.commit.message)] };
  }
  return { classified: range.commits.map((c) => classify(c.commit.message)) };
}

async function summariseOne(game, entry, i) {
  const u = entry.updates[i];
  const { classified, launchNote } = await commitsFor(game, entry, i);
  const content = prompt(game, u, classified, { launchNote });
  let problem = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: problem ? `${content}\n\nYour last answer was rejected: ${problem}. Follow the rules.` : content }],
    });
    spent.input += response.usage.input_tokens;
    spent.output += response.usage.output_tokens;
    if (response.stop_reason === "refusal") throw new Error("refused");
    const out = JSON.parse(response.content.find((b) => b.type === "text")?.text ?? "{}");
    const facing = u.launch || out.player_facing;
    if (facing && !validSummary(out.summary)) {
      problem = `it named another game, talked about commits, or was not plain prose: ${JSON.stringify(out.summary)}`;
      continue;
    }
    // one wording for every deploy players would not notice
    u.summary = facing ? out.summary.trim() : BEHIND_THE_SCENES;
    u.playerFacing = Boolean(facing);
    u.model = MODEL;
    return;
  }
  throw new Error(`no usable summary: ${problem.slice(0, 160)}`);
}

async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

// ── run ──────────────────────────────────────────────────────────────────────
const games = GAMES.filter((g) => g.repo && (!only || only.includes(slugOf(g))));
const results = [];
await pool(games, 4, async (g) => {
  const r = await syncGame(g);
  results.push(r);
  console.log(`${r.slug}: ${r.added} new, ${r.total} in all`);
});
// a game taken off the hub keeps no changelog
for (const slug of Object.keys(data.games)) if (!GAMES.some((g) => g.repo && slugOf(g) === slug)) delete data.games[slug];
for (const slug of resummarize.includes("all") ? Object.keys(data.games) : resummarize)
  for (const u of data.games[slug]?.updates ?? []) if (!u.rollback) u.summary = null;
save();

const todo = [];
for (const g of games) {
  const entry = data.games[slugOf(g)];
  entry?.updates.forEach((u, i) => { if (u.summary == null) todo.push([g, entry, i]); });
}
let failed = 0;
if (todo.length && summarise && anthropic) {
  console.log(`summarising ${todo.length} updates with ${MODEL}`);
  let done = 0;
  await pool(todo, 8, async ([g, entry, i]) => {
    try {
      await summariseOne(g, entry, i);
    } catch (e) {
      failed++;
      console.warn(`  ${slugOf(g)} #${i + 1}: ${e.message}`);
    }
    if (++done % 20 === 0) { save(); console.log(`  ${done}/${todo.length}`); }
  });
  save();
} else if (todo.length) {
  console.log(`${todo.length} updates wait for a summary (${anthropic ? "--no-summaries" : "no ANTHROPIC_API_KEY"})`);
}
console.log(`GitHub calls: ${calls}; Haiku tokens in/out: ${spent.input}/${spent.output}${failed ? `; ${failed} summaries failed, retried next run` : ""}`);
