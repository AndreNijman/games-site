// The platform's model: platform.yaml, registry/<slug>.yaml (Andre's half)
// and each game's game.yaml (the developer's half), validated and joined into
// one catalog. Everything that used to be a hand-kept table — the hub's cards,
// the guard's GAMES and HOSTS, its crawler-file and netlog lists, the Worker's
// routes and every relay's wrangler config — is drawn from that catalog.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { parse } from "yaml";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false });
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const validators = {
  game: ajv.compile(readJson(join(ROOT, "schema/game.schema.json"))),
  registry: ajv.compile(readJson(join(ROOT, "schema/registry.schema.json"))),
};

export class PlatformError extends Error {
  constructor(problems) {
    super(problems.map((p) => `  - ${p}`).join("\n"));
    this.problems = problems;
  }
}

function schemaProblems(kind, data, where) {
  const valid = validators[kind](data);
  if (valid) return [];
  return validators[kind].errors.map((e) => `${where}: ${e.instancePath || "(top)"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(", ")})` : ""}`);
}

/** Validate a parsed game.yaml on its own: what the shared workflow checks in a game repo. */
export function validateGame(data, where = "game.yaml") {
  return schemaProblems("game", data, where);
}

export function readYaml(path) {
  return parse(readFileSync(path, "utf8"));
}

export function loadPlatform(root = ROOT) {
  return readYaml(join(root, "platform.yaml"));
}

export function loadRegistry(root = ROOT, platform = loadPlatform(root)) {
  const dir = join(root, "registry");
  const problems = [];
  const entries = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort()) {
    const where = `registry/${file}`;
    const entry = readYaml(join(dir, file));
    problems.push(...schemaProblems("registry", entry, where));
    if (entry?.slug && `${entry.slug}.yaml` !== file) problems.push(`${where}: slug ${entry.slug} does not match the file name`);
    entries.push(entry);
  }
  const { hostSuffix } = platform.cloudflare;
  const hosts = new Map();
  const relayNames = new Map();
  for (const e of entries) {
    const where = `registry/${e.slug}.yaml`;
    if (typeof e.host !== "string") continue;
    if (!e.host.endsWith(hostSuffix)) problems.push(`${where}: host ${e.host} is outside ${hostSuffix.slice(1)}`);
    if (e.host === platform.hub.host) problems.push(`${where}: host ${e.host} is the hub`);
    if (hosts.has(e.host)) problems.push(`${where}: host ${e.host} is also registered by ${hosts.get(e.host)}`);
    hosts.set(e.host, e.slug);
    if (e.relay) {
      const r = relayOf(e, platform);
      if (r.domain && !r.domain.endsWith(hostSuffix)) problems.push(`${where}: relay domain ${r.domain} is outside ${hostSuffix.slice(1)}`);
      if (r.domain && hosts.has(r.domain)) problems.push(`${where}: relay domain ${r.domain} is a game host`);
      if (relayNames.has(r.worker)) problems.push(`${where}: relay Worker ${r.worker} is also used by ${relayNames.get(r.worker)}`);
      relayNames.set(r.worker, e.slug);
    }
  }
  for (const e of entries) {
    const r = e.relay && relayOf(e, platform);
    if (r?.domain && hosts.has(r.domain)) problems.push(`registry/${e.slug}.yaml: relay domain ${r.domain} is ${hosts.get(r.domain)}'s host`);
  }
  for (const slug of platform.hub.order) {
    if (!entries.some((e) => e.slug === slug)) problems.push(`platform.yaml: hub.order names ${slug}, which is not registered`);
  }
  if (problems.length) throw new PlatformError(problems);
  return entries;
}

/** The relay's Worker name and custom domain, with the defaults filled in. */
export function relayOf(entry, platform) {
  if (!entry.relay) return null;
  const zone = platform.cloudflare.zone;
  return {
    managed: entry.relay.managed,
    worker: entry.relay.worker ?? `${entry.slug}-relay`,
    domain: entry.relay.domain === undefined ? `${entry.slug}-relay.${zone}` : entry.relay.domain,
  };
}

/**
 * Where an entry's game.yaml and screenshot come from. A copy fetched from the
 * game's repository (cacheDir/<slug>/game.yaml, written by fetch-manifests)
 * wins over the one staged in manifests/, whose screenshot is already in public/.
 */
export function manifestSource(entry, { root = ROOT, cacheDir } = {}) {
  const fetched = cacheDir && join(cacheDir, entry.slug, "game.yaml");
  if (fetched && existsSync(fetched)) {
    return { path: fetched, where: `${entry.repo}:game.yaml`, assetRoot: join(cacheDir, entry.slug), fetched: true };
  }
  if (entry.manifest) {
    return { path: join(root, entry.manifest), where: entry.manifest, assetRoot: join(root, "public"), fetched: false };
  }
  return null;
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(path) {
  const b = readFileSync(path);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${path} is not a PNG`);
  }
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const CARD_SIZES = new Set(["1000x525", "2000x1050"]);

/**
 * The joined, ordered catalog. Throws a PlatformError listing every problem
 * rather than the first, so one run tells a developer everything to fix.
 */
export function buildCatalog({ root = ROOT, cacheDir } = {}) {
  const platform = loadPlatform(root);
  const registry = loadRegistry(root, platform);
  const problems = [];
  const games = [];
  for (const entry of registry) {
    const src = manifestSource(entry, { root, cacheDir });
    const where = `registry/${entry.slug}.yaml`;
    if (!src) {
      problems.push(`${where}: no game.yaml in ${entry.repo} yet and no staged manifest`);
      continue;
    }
    const game = readYaml(src.path);
    const before = problems.length;
    problems.push(...validateGame(game, src.where));
    if (problems.length > before) continue;
    if (!entry.byAndre && !game.author) problems.push(`${src.where}: author is required (the registry does not credit this game to Andre)`);
    if (game.relay && !entry.relay) problems.push(`${src.where}: declares a relay, but ${where} does not allow one`);
    if (entry.relay?.managed && !game.relay) problems.push(`${where}: relay.managed is true, but ${src.where} has no relay`);
    const image = entry.image ?? `${entry.slug}.png`;
    const shot = join(src.assetRoot, src.fetched ? game.screenshot : image);
    let size = null;
    if (!existsSync(shot)) problems.push(`${src.where}: screenshot ${game.screenshot} not found`);
    else {
      try {
        size = pngSize(shot);
        if (!CARD_SIZES.has(`${size.width}x${size.height}`)) problems.push(`${src.where}: screenshot is ${size.width}x${size.height}; use 1000x525 or 2000x1050`);
      } catch (err) {
        problems.push(`${src.where}: ${err.message}`);
      }
    }
    if (!size) continue;
    const relay = relayOf(entry, platform);
    games.push({
      slug: entry.slug,
      host: entry.host,
      kind: entry.kind,
      repo: entry.repo ?? null,
      live: entry.enabled && game.publish,
      enabled: entry.enabled,
      publish: game.publish,
      listed: entry.listed,
      guard: entry.guard,
      crawlerFiles: entry.crawlerFiles ?? false,
      netlog: entry.netlog ?? false,
      origin: entry.origin,
      name: game.name,
      description: game.description,
      meta: game.meta,
      genre: game.genre,
      image,
      imageWidth: size.width,
      imageHeight: size.height,
      alt: game.alt,
      label: game.label,
      ...(game.credit ? { credit: game.credit } : {}),
      ...(game.author ? { author: game.author } : {}),
      ...(game.basedOn ? { basedOn: game.basedOn } : {}),
      requiresAccount: game.account === "required",
      relay: relay && { ...relay, declared: Boolean(game.relay) },
      // Where the screenshot was read, for the hub sync; not published.
      screenshotSource: shot,
    });
  }
  if (problems.length) throw new PlatformError(problems);
  const rank = new Map(platform.hub.order.map((slug, i) => [slug, i]));
  games.sort((a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity) || a.slug.localeCompare(b.slug));
  return { platform, registry, games };
}

/** What generated/catalog.json holds: the catalog without local paths. */
export function publicCatalog({ platform, games }) {
  return {
    $comment: "Generated by `npm run platform:generate` from platform.yaml, registry/ and each game's game.yaml. Do not edit.",
    hub: platform.hub.host,
    platformRepo: platform.platformRepo,
    pagesHost: platform.cloudflare.pagesHost,
    games: games.map(({ screenshotSource, ...g }) => g),
  };
}
