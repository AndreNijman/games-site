#!/usr/bin/env node
// Moves a registered game onto the platform, one step at a time:
//
//   node platform/migrate.mjs                         the plan for every game
//   node platform/migrate.mjs scoops --write ../scoops
//       In that local clone, on a new branch platform/join-org: game.yaml (from
//       manifests/scoops.yaml), the screenshot at .github/game-card.png, the
//       five-line workflow calling the org's shared one, and the old Pages
//       workflow removed. Commits locally; pushes nothing.
//   node platform/migrate.mjs scoops --transfer
//       Transfers the repository into the org (asks GitHub; needs admin on both)
//       and switches its Pages source to GitHub Actions with the same custom
//       domain. Run this only after the branch above is merged.
//
// After a transfer, set registry/<slug>.yaml's repo to the new name and delete
// its `manifest:` line once the game.yaml is on the default branch.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadPlatform, loadRegistry, ROOT } from "./lib.mjs";

export function callerWorkflow(org) {
  return `# Builds this game and publishes it to GitHub Pages through the org's shared
# workflow, which also checks game.yaml. Everything else (the guard, the hub
# card, DNS, the relay) the platform does from game.yaml. Leave this file as is.
name: game

# Every push is checked and built; only the default branch is published.
on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: game-\${{ github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}

jobs:
  game:
    uses: ${org}/.github/.github/workflows/game.yml@v1
`;
}

/** The staged manifest as it will sit in the game's repository. */
export function repoManifest(staged, platform) {
  const body = staged
    .split("\n")
    .filter((line) => !line.startsWith("# yaml-language-server") && !line.startsWith("# Staged game.yaml") && !line.startsWith("# until then the generator"))
    .join("\n")
    .replace(/^screenshot: .*$/m, "screenshot: .github/game-card.png");
  return `# yaml-language-server: $schema=https://raw.githubusercontent.com/${platform.platformRepo}/main/schema/game.schema.json
# What the games platform needs to know about this game. Reference:
# https://github.com/${platform.org}/.github/blob/main/CONTRIBUTING.md
${body}`;
}

const OLD_PAGES_WORKFLOWS = ["pages.yml", "deploy.yml", "static.yml"];

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function writeLocal(entry, checkout, platform) {
  const dir = resolve(checkout);
  if (!existsSync(join(dir, ".git"))) throw new Error(`${dir} is not a git clone`);
  if (git(dir, "status", "--porcelain")) throw new Error(`${dir} has uncommitted changes; commit or set them aside first`);
  const remote = git(dir, "remote", "get-url", "origin");
  if (!remote.toLowerCase().includes(entry.repo.toLowerCase())) throw new Error(`${dir} is a clone of ${remote}, not ${entry.repo}`);
  git(dir, "switch", "-c", "platform/join-org");

  const staged = readFileSync(join(ROOT, entry.manifest), "utf8");
  writeFileSync(join(dir, "game.yaml"), repoManifest(staged, platform));
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  copyFileSync(join(ROOT, "public", entry.image ?? `${entry.slug}.png`), join(dir, ".github/game-card.png"));
  writeFileSync(join(dir, ".github/workflows/game.yml"), callerWorkflow(platform.org));
  const removed = [];
  for (const f of readdirSync(join(dir, ".github/workflows"))) {
    if (OLD_PAGES_WORKFLOWS.includes(f)) {
      rmSync(join(dir, ".github/workflows", f));
      removed.push(f);
    }
  }
  // The shared workflow publishes the build output; a CNAME in it is ignored
  // by Actions deploys, and the custom domain lives in the Pages settings.
  git(dir, "add", "-A", "game.yaml", ".github");
  git(dir, "commit", "-m", "chore: join the games platform\n\nAdds game.yaml and the shared game workflow" +
    (removed.length ? `, which replaces ${removed.join(", ")}` : "") + ".");
  return { dir, removed };
}

function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

function transfer(entry, platform) {
  const name = entry.repo.split("/")[1];
  gh("api", "-X", "POST", `repos/${entry.repo}/transfer`, "-f", `new_owner=${platform.org}`);
  const moved = `${platform.org}/${name}`;
  // Transfers finish asynchronously; Pages settings fail until they have.
  for (let i = 0; i < 30; i++) {
    try {
      gh("api", `repos/${moved}`);
      break;
    } catch {
      execFileSync("sleep", ["2"]);
    }
  }
  try {
    gh("api", "-X", "POST", `repos/${moved}/pages`, "-f", "build_type=workflow");
  } catch {
    gh("api", "-X", "PUT", `repos/${moved}/pages`, "-f", "build_type=workflow");
  }
  gh("api", "-X", "PUT", `repos/${moved}/pages`, "-f", `cname=${entry.host}`);
  return moved;
}

function plan(entry, platform) {
  if (entry.kind !== "pages") return [`${entry.slug}: external, nothing to migrate`];
  const steps = [];
  if (!entry.repo.startsWith(`${platform.org}/`)) {
    steps.push(`--write <clone of ${entry.repo}>`, "merge platform/join-org", "--transfer");
    steps.push(`set registry repo to ${platform.org}/${entry.repo.split("/")[1]}`);
  }
  if (entry.manifest) steps.push("drop `manifest:` once game.yaml is on main");
  if (entry.relay && !entry.relay.managed) steps.push("add relay to game.yaml, then relay.managed: true");
  return steps.length ? [`${entry.slug}: ${steps.join(" → ")}`] : [`${entry.slug}: done`];
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { write: { type: "string" }, transfer: { type: "boolean" } },
  });
  const platform = loadPlatform();
  const registry = loadRegistry(undefined, platform);
  const [slug] = positionals;
  if (!slug) {
    for (const e of registry) for (const line of plan(e, platform)) console.log(line);
    return;
  }
  const entry = registry.find((e) => e.slug === slug);
  if (!entry) throw new Error(`${slug} is not registered`);
  if (entry.kind !== "pages") throw new Error(`${slug} is external; there is nothing to migrate`);
  if (values.write) {
    const { dir, removed } = writeLocal(entry, values.write, platform);
    console.log(`${dir}: committed on platform/join-org${removed.length ? `, removed ${removed.join(", ")}` : ""}. Nothing pushed.`);
  }
  if (values.transfer) {
    const moved = transfer(entry, platform);
    console.log(`${entry.repo} → ${moved}; Pages builds from Actions at ${entry.host}. Update registry/${slug}.yaml.`);
  }
  if (!values.write && !values.transfer) for (const line of plan(entry, platform)) console.log(line);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
