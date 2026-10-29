#!/usr/bin/env node
// Makes sure every guarded Pages game has a proxied DNS record in the zone, so
// the guard's route can catch it. Relay domains are not handled here: wrangler
// creates those itself from the relay's custom_domain route.
//
//   CLOUDFLARE_API_TOKEN=... node platform/dns.mjs            show the plan
//   CLOUDFLARE_API_TOKEN=... node platform/dns.mjs --apply    create missing records
//
// An existing record is never changed or removed: one pointing somewhere else
// is reported, because it may be deliberate (ONE WORLD, a game moving over).
// The token needs Zone → DNS → Edit on the zone, nothing else.
import { parseArgs } from "node:util";
import { buildCatalog } from "./lib.mjs";

const API = "https://api.cloudflare.com/client/v4";

async function cf(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json();
  if (!body.success) throw new Error(`${init.method ?? "GET"} ${path}: ${JSON.stringify(body.errors)}`);
  return body;
}

/** What to do for each host, given the zone's existing records by name. */
export function dnsPlan(games, existing, target) {
  return games
    .filter((g) => g.guard && g.kind === "pages")
    .map((g) => {
      const records = existing.get(g.host) ?? [];
      if (!records.length) return { host: g.host, action: "create", target };
      const proxied = records.every((r) => r.proxied);
      if (!proxied) return { host: g.host, action: "warn", note: "exists but is not proxied, so the guard cannot see it" };
      const cname = records.find((r) => r.type === "CNAME");
      if (cname && cname.content !== target) return { host: g.host, action: "keep", note: `points at ${cname.content}` };
      return { host: g.host, action: "ok" };
    });
}

async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean" } } });
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error("CLOUDFLARE_API_TOKEN is not set");
    process.exit(2);
  }
  const { platform, games } = buildCatalog();
  const { zone, dnsTarget } = platform.cloudflare;
  const zones = await cf(`/zones?name=${encodeURIComponent(zone)}`, token);
  const zoneId = zones.result[0]?.id;
  if (!zoneId) throw new Error(`zone ${zone} not visible to this token`);

  const existing = new Map();
  for (let page = 1; ; page++) {
    const res = await cf(`/zones/${zoneId}/dns_records?per_page=500&page=${page}`, token);
    for (const r of res.result) existing.set(r.name, [...(existing.get(r.name) ?? []), r]);
    if (page >= res.result_info.total_pages) break;
  }

  const plan = dnsPlan(games, existing, dnsTarget);
  for (const step of plan) {
    if (step.action === "ok") continue;
    console.log(`${step.action.padEnd(6)} ${step.host}${step.note ? `  (${step.note})` : ""}`);
    if (step.action === "create" && values.apply) {
      await cf(`/zones/${zoneId}/dns_records`, token, {
        method: "POST",
        body: JSON.stringify({ type: "CNAME", name: step.host, content: dnsTarget, proxied: true, comment: "games platform" }),
      });
      console.log(`       created ${step.host} → ${dnsTarget}`);
    }
  }
  if (!values.apply && plan.some((s) => s.action === "create")) console.log("dry run: pass --apply to create");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
