#!/usr/bin/env node
// Decides whether a push to a game repository should redeploy its relay, and
// writes the answer for the workflow:
//
//   node platform/relay-plan.mjs --slug scoops --files '["src/worker/a.ts"]' --cache .platform-cache
//
// Prints deploy=true|false (and appends it to $GITHUB_OUTPUT). A missing or
// null file list means "everything changed", e.g. a large push or a manual run.
import { appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { loadRegistry, readYaml } from "./lib.mjs";

/** * matches within one path segment, ** across segments. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function relayWatch(relay) {
  if (relay.watch?.length) return relay.watch;
  const dir = dirname(relay.main);
  return [dir === "." ? relay.main : `${dir}/**`, "package.json", "package-lock.json", "game.yaml"];
}

export function shouldDeployRelay(entry, game, files) {
  if (!entry?.relay?.managed || !entry.enabled || !game?.relay || !game.publish) return false;
  if (!files) return true;
  const patterns = relayWatch(game.relay).map(globToRegExp);
  return files.some((f) => patterns.some((p) => p.test(f)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { slug: { type: "string" }, files: { type: "string" }, cache: { type: "string" } } });
  const entry = loadRegistry().find((e) => e.slug === values.slug);
  const fetched = values.cache && join(values.cache, values.slug ?? "", "game.yaml");
  const game = fetched && existsSync(fetched) ? readYaml(fetched) : entry?.manifest ? readYaml(entry.manifest) : null;
  const files = values.files ? JSON.parse(values.files) : null;
  const deploy = shouldDeployRelay(entry, game, files);
  console.log(`deploy=${deploy}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`);
}
