#!/usr/bin/env node
// Run by the org's shared game workflow inside a game repository: checks its
// game.yaml against the schema, looks the repository up in the published
// catalog, and hands the build settings to the workflow as step outputs.
// Standalone on purpose: the workflow downloads this one file, the schema and
// generated/catalog.json from the platform repository and runs it with ajv and
// yaml installed under $TOOLS.
//
//   node check-game.mjs --manifest game.yaml --schema game.schema.json \
//     --catalog catalog.json --repo owner/name
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.TOOLS || resolve(here, ".."), "noop.js"));
const Ajv = require("ajv");
const YAML = require("yaml");

export function checkGame({ manifestText, schema, catalog, repo }) {
  const problems = [];
  const notes = [];
  let game;
  try {
    game = YAML.parse(manifestText);
  } catch (err) {
    return { problems: [`game.yaml does not parse: ${err.message}`], notes, outputs: null };
  }
  const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(game)) {
    for (const e of validate.errors) {
      problems.push(`game.yaml ${e.instancePath || "(top)"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(", ")})` : ""}`);
    }
    return { problems, notes, outputs: null };
  }
  const entry = catalog?.games.find((g) => g.repo?.toLowerCase() === repo.toLowerCase());
  if (!entry) notes.push(`${repo} is not in the registry yet, so it is built and checked but not published. Ask Andre to register it.`);
  else if (!entry.enabled) notes.push(`${entry.slug} is switched off in the registry, so it is not published.`);
  if (!game.publish) notes.push("game.yaml has publish: false, so it is not published.");
  if (entry && game.relay && !entry.relay) problems.push(`game.yaml declares a relay, but the registry entry for ${entry.slug} does not allow one. Ask Andre.`);
  const b = game.build;
  return {
    problems,
    notes,
    outputs: {
      publish: String(Boolean(entry?.enabled && game.publish)),
      slug: entry?.slug ?? "",
      host: entry?.host ?? "",
      node: String(b.node),
      install: b.install ?? "",
      setup: JSON.stringify(b.setup),
      checks: JSON.stringify(b.checks),
      command: b.command ?? "",
      output: b.output,
      screenshot: game.screenshot,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string", default: "game.yaml" },
      schema: { type: "string" },
      catalog: { type: "string" },
      repo: { type: "string" },
    },
  });
  if (!existsSync(values.manifest)) {
    console.log(`::error file=${values.manifest}::There is no ${values.manifest}. Copy the one from the template repository and fill it in.`);
    process.exit(1);
  }
  const result = checkGame({
    manifestText: readFileSync(values.manifest, "utf8"),
    schema: JSON.parse(readFileSync(values.schema, "utf8")),
    catalog: values.catalog && existsSync(values.catalog) ? JSON.parse(readFileSync(values.catalog, "utf8")) : null,
    repo: values.repo,
  });
  for (const n of result.notes) console.log(`::notice file=${values.manifest}::${n}`);
  for (const p of result.problems) console.log(`::error file=${values.manifest}::${p}`);
  if (result.outputs && result.outputs.screenshot && !existsSync(result.outputs.screenshot)) {
    console.log(`::error file=${values.manifest}::screenshot ${result.outputs.screenshot} is not in the repository`);
    result.problems.push("screenshot missing");
  }
  if (result.problems.length) process.exit(1);
  if (process.env.GITHUB_OUTPUT) {
    // Heredoc form, so a multi-line build command survives.
    const end = `EOF_${randomBytes(8).toString("hex")}`;
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result.outputs).map(([k, v]) => `${k}<<${end}\n${v}\n${end}\n`).join(""));
  } else {
    console.log(result.outputs);
  }
}
