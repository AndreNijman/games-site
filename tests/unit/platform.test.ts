import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { buildCatalog, loadPlatform, loadRegistry, PlatformError, publicCatalog, readYaml, validateGame } from "../../platform/lib.mjs";
import { withRoutes } from "../../platform/generate.mjs";
import { relayConfig } from "../../platform/relay-config.mjs";
import { dnsPlan } from "../../platform/dns.mjs";
import { dispatchFor, platformHook } from "../../worker/platform-hook.js";

const problemsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (err instanceof PlatformError) return (err as PlatformError & { problems: string[] }).problems;
    throw err;
  }
  return [];
};

describe("the registry as committed", () => {
  it("builds a catalog with no problems", () => {
    expect(problemsOf(() => buildCatalog())).toEqual([]);
  });
  it("matches generated/catalog.json and the routes in wrangler.jsonc (npm run platform:generate)", () => {
    const catalog = buildCatalog();
    const committed = JSON.parse(readFileSync("generated/catalog.json", "utf8"));
    expect(committed).toEqual(publicCatalog(catalog));
    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    expect(withRoutes(wrangler, catalog)).toBe(wrangler);
  });
  it("routes every guarded host and the hub, and nothing else", () => {
    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    const routed = [...wrangler.matchAll(/"pattern": "([^"]+)\/\*", "zone_name"/g)].map((m) => m[1]);
    const catalog = buildCatalog();
    expect(new Set(routed)).toEqual(new Set([catalog.platform.hub.host, ...catalog.games.filter((g: { guard: boolean }) => g.guard).map((g: { host: string }) => g.host)]));
  });
  it("keeps production's routes empty, as the broker's deploy needs", () => {
    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    expect(wrangler.slice(wrangler.indexOf('"production"'))).toMatch(/"routes": \[\]/);
  });
});

// A throwaway platform: the real schema and platform.yaml, a registry of our own.
function makeRoot(entries: Record<string, object>, manifests: Record<string, object>) {
  const root = mkdtempSync(join(tmpdir(), "platform-"));
  cpSync("schema", join(root, "schema"), { recursive: true });
  cpSync("public/scoops.png", join(root, "public/scoops.png"));
  cpSync("public/bigtower.png", join(root, "public/bigtower.png"));
  const platform = loadPlatform();
  platform.hub = { ...platform.hub, order: [] };
  writeFileSync(join(root, "platform.yaml"), stringify(platform));
  for (const dir of ["registry", "manifests"]) mkdirSync(join(root, dir));
  for (const [slug, e] of Object.entries(entries)) writeFileSync(join(root, "registry", `${slug}.yaml`), stringify(e));
  for (const [slug, m] of Object.entries(manifests)) writeFileSync(join(root, "manifests", `${slug}.yaml`), stringify(m));
  return root;
}

const entry = (slug: string, extra = {}) => ({
  slug, host: `${slug}.andrenijman.com`, kind: "pages", repo: `someone/${slug}`, manifest: `manifests/${slug}.yaml`,
  enabled: true, listed: true, guard: true, byAndre: false, origin: "original", image: "scoops.png", ...extra,
});
const manifest = (extra = {}) => ({
  ...readYaml("manifests/scoops.yaml"),
  author: { type: "Person", name: "Someone", url: "https://github.com/someone" },
  ...extra,
});

describe("the generator refuses", () => {
  it("a host outside the zone, the hub's host, or one host twice", () => {
    const root = makeRoot({
      alpha: entry("alpha", { host: "alpha.example.com" }),
      beta: entry("beta", { host: "games.andrenijman.com" }),
      gamma: entry("gamma", { host: "same.andrenijman.com" }),
      delta: entry("delta", { host: "same.andrenijman.com" }),
    }, { alpha: manifest(), beta: manifest(), gamma: manifest(), delta: manifest() });
    const problems = problemsOf(() => buildCatalog({ root })).join("\n");
    expect(problems).toMatch(/alpha\.yaml: host alpha\.example\.com is outside/);
    expect(problems).toMatch(/beta\.yaml: host games\.andrenijman\.com is the hub/);
    expect(problems).toMatch(/gamma\.yaml: host same\.andrenijman\.com is also registered by delta/);
  });
  it("a slug that does not match its file", () => {
    const root = makeRoot({ alpha: entry("beta") }, { beta: manifest() });
    expect(problemsOf(() => buildCatalog({ root })).join("\n")).toMatch(/slug beta does not match/);
  });
  it("a guest's game with no author", () => {
    const { author, ...anonymous } = manifest();
    const root = makeRoot({ alpha: entry("alpha") }, { alpha: anonymous });
    expect(problemsOf(() => buildCatalog({ root })).join("\n")).toMatch(/author is required/);
  });
  it("a relay the registry does not allow", () => {
    const root = makeRoot({ alpha: entry("alpha") }, { alpha: manifest() });
    expect(problemsOf(() => buildCatalog({ root })).join("\n")).toMatch(/declares a relay, but registry\/alpha\.yaml does not allow one/);
  });
  it("a screenshot that is not card-sized", () => {
    const root = makeRoot({ alpha: entry("alpha", { image: "bigtower.png", relay: { managed: false } }) }, { alpha: manifest() });
    expect(problemsOf(() => buildCatalog({ root })).join("\n")).toMatch(/256x256; use 1000x525 or 2000x1050/);
  });
  it("a relay that sets its own ALLOWED_ORIGINS", () => {
    const m = manifest();
    m.relay = { ...m.relay, vars: { ALLOWED_ORIGINS: "*" } };
    expect(validateGame(m).join("\n")).toMatch(/vars/);
  });
});

describe("the switches", () => {
  const run = (e: object, m: object) => buildCatalog({ root: makeRoot({ alpha: entry("alpha", { relay: { managed: false }, ...e }) }, { alpha: manifest(m) }) }).games[0];
  it("a game is live only when Andre enables it and its developer publishes it", () => {
    expect(run({}, {}).live).toBe(true);
    expect(run({ enabled: false }, {}).live).toBe(false);
    expect(run({}, { publish: false }).live).toBe(false);
  });
});

describe("relay config", () => {
  const platform = loadPlatform();
  const registry = loadRegistry();
  const scoops = registry.find((e: { slug: string }) => e.slug === "scoops");
  it("reproduces scoops-relay's production config", () => {
    const config = relayConfig(scoops, readYaml("manifests/scoops.yaml"), platform);
    expect(config).toEqual({
      name: "scoops-relay",
      main: "src/worker/index.ts",
      compatibility_date: "2026-08-11",
      workers_dev: true,
      preview_urls: false,
      observability: { enabled: true },
      routes: [{ pattern: "scoops-relay.andrenijman.com", custom_domain: true }],
      vars: { ALLOWED_ORIGINS: "https://scoops.andrenijman.com" },
      durable_objects: { bindings: [{ name: "ROOMS", class_name: "ScoopRoom" }, { name: "LOBBIES", class_name: "RoomRegistry" }] },
      migrations: [{ tag: "v1", new_sqlite_classes: ["ScoopRoom", "RoomRegistry"] }],
      services: [{ binding: "NETLOG", service: "games-guard", entrypoint: "NetLog" }],
    });
  });
  it("names a new relay <slug>-relay on its own domain, without netlog unless granted", () => {
    const config = relayConfig({ ...entry("newgame"), relay: { managed: true } }, manifest(), platform);
    expect(config.name).toBe("newgame-relay");
    expect(config.routes).toEqual([{ pattern: "newgame-relay.andrenijman.com", custom_domain: true }]);
    expect(config.workers_dev).toBe(false);
    expect(config.services).toBeUndefined();
    expect(config.vars.ALLOWED_ORIGINS).toBe("https://newgame.andrenijman.com");
  });
});

describe("dns plan", () => {
  const games = [
    { host: "new.andrenijman.com", guard: true, kind: "pages" },
    { host: "old.andrenijman.com", guard: true, kind: "pages" },
    { host: "bare.andrenijman.com", guard: true, kind: "pages" },
    { host: "mc.andrenijman.com", guard: true, kind: "external" },
  ];
  const existing = new Map([
    ["old.andrenijman.com", [{ type: "CNAME", content: "andrenijman.github.io", proxied: true }]],
    ["bare.andrenijman.com", [{ type: "CNAME", content: "x.github.io", proxied: false }]],
  ]);
  it("creates what is missing and never touches what exists", () => {
    expect(dnsPlan(games, existing, "org.github.io")).toEqual([
      { host: "new.andrenijman.com", action: "create", target: "org.github.io" },
      { host: "old.andrenijman.com", action: "keep", note: "points at andrenijman.github.io" },
      { host: "bare.andrenijman.com", action: "warn", note: "exists but is not proxied, so the guard cannot see it" },
    ]);
  });
});

describe("the platform webhook", () => {
  const catalog = { platformRepo: "org/platform", games: [{ slug: "scoops", repo: "org/scoop-trouble" }] };
  const push = (extra = {}) => ({
    ref: "refs/heads/main", after: "abc123", deleted: false,
    repository: { full_name: "org/scoop-trouble", default_branch: "main" },
    commits: [{ added: ["src/worker/rooms.ts"], modified: ["game.yaml"], removed: [] }],
    ...extra,
  });
  it("dispatches a push to a registered repo's default branch with the files it touched", () => {
    expect(dispatchFor("push", push(), catalog)).toEqual({
      event_type: "game-push",
      client_payload: { slug: "scoops", repo: "org/scoop-trouble", sha: "abc123", files: ["src/worker/rooms.ts", "game.yaml"] },
    });
  });
  it("ignores other branches, other repos and other events", () => {
    expect(dispatchFor("push", push({ ref: "refs/heads/dev" }), catalog)).toBeNull();
    expect(dispatchFor("push", push({ repository: { full_name: "org/other", default_branch: "main" } }), catalog)).toBeNull();
    expect(dispatchFor("issues", push(), catalog)).toBeNull();
  });
  it("refuses a request without the right signature", async () => {
    const body = JSON.stringify(push());
    const req = (sig: string) => new Request("https://games.andrenijman.com/_platform/hook", {
      method: "POST", body, headers: { "X-GitHub-Event": "push", "X-Hub-Signature-256": sig },
    });
    const env = { PLATFORM_WEBHOOK_SECRET: "s3cret", PLATFORM_DISPATCH_TOKEN: "t" };
    expect((await platformHook(req("sha256=00"), env, catalog)).status).toBe(401);
    expect((await platformHook(req(""), env, catalog)).status).toBe(401);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("s3cret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))).toString("hex");
    const calls: Request[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push(new Request(url, init)); return new Response(null, { status: 204 }); }) as typeof fetch;
    try {
      const res = await platformHook(req(`sha256=${mac}`), env, catalog);
      expect(res.status).toBe(202);
      expect(calls[0].url).toBe("https://api.github.com/repos/org/platform/dispatches");
      expect(calls[0].headers.get("Authorization")).toBe("Bearer t");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
