// The organisation's GitHub webhook lands here, at
// https://games.andrenijman.com/_platform/hook, so that a push to a game
// repository starts the platform workflow without the game repository holding
// any token for the platform repository. The webhook secret proves the call
// came from GitHub; the dispatch token never leaves this Worker.
//
// Secrets: PLATFORM_WEBHOOK_SECRET (the org webhook's secret) and
// PLATFORM_DISPATCH_TOKEN (a fine-grained token with Contents: write on the
// platform repository only, which is what repository_dispatch needs).

export const HOOK_PATH = "/_platform/hook";
// GitHub caps client_payload; a push touching more files than this is treated
// as touching everything.
const MAX_FILES = 300;

const encoder = new TextEncoder();

async function signatureValid(body, header, secret) {
  if (!header?.startsWith("sha256=") || !secret) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

/** The dispatch to send for a push event, or null when there is nothing to do. */
export function dispatchFor(event, payload, catalog) {
  if (event !== "push" || !payload?.repository) return null;
  const repo = payload.repository.full_name;
  const branch = `refs/heads/${payload.repository.default_branch}`;
  if (payload.ref !== branch || payload.deleted) return null;
  const game = catalog.games.find((g) => g.repo?.toLowerCase() === repo.toLowerCase());
  if (!game) return null;
  const files = new Set();
  for (const commit of payload.commits ?? []) {
    for (const f of [...(commit.added ?? []), ...(commit.modified ?? []), ...(commit.removed ?? [])]) files.add(f);
  }
  const all = files.size > MAX_FILES || (payload.commits ?? []).length >= 20;
  return {
    event_type: "game-push",
    client_payload: { slug: game.slug, repo, sha: payload.after, files: all ? null : [...files] },
  };
}

export async function platformHook(request, env, catalog) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  const body = await request.text();
  if (!(await signatureValid(body, request.headers.get("X-Hub-Signature-256"), env.PLATFORM_WEBHOOK_SECRET))) {
    return new Response("Bad signature", { status: 401 });
  }
  const event = request.headers.get("X-GitHub-Event");
  if (event === "ping") return new Response("pong");
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const dispatch = dispatchFor(event, payload, catalog);
  if (!dispatch) return new Response("Ignored", { status: 202 });
  const res = await fetch(`https://api.github.com/repos/${catalog.platformRepo}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.PLATFORM_DISPATCH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "games-guard",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dispatch),
  });
  // GitHub retries nothing on its own, but the platform's schedule catches up.
  if (!res.ok) return new Response(`Dispatch failed: ${res.status}`, { status: 502 });
  return new Response(`Dispatched ${dispatch.client_payload.slug}`, { status: 202 });
}
