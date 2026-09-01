const DEVICE_COOKIE = "games_device";
const SESSION_COOKIE = "games_session";
const COOKIE_DOMAIN = ".andrenijman.com";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const ACCEPT_CH = "Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Arch, Sec-CH-UA-Bitness";
const MC_HOST = "mc.andrenijman.com";
const HUB_HOST = "games.andrenijman.com";
const HUB_ORIGIN = `https://${HUB_HOST}`;
const MC_PAGES_ORIGIN = "https://andrenijman.github.io";
const MC_PAGES_BASE = "/one-world";
// The admin view holds every returned row in memory to group and search it, so
// the query is windowed rather than unbounded. Raise this if the device table
// ever outgrows it; the page reports honestly when the window is full.
const ADMIN_ROW_WINDOW = 25000;
// Visits before this date were reconstructed from device first/last seen times
// by worker/migrations/2026-08-24-visit-backfill.sql and undercount.
const VISITS_MEASURED_FROM = "24 August 2026";
const HOSTS = new Set([
  "games.andrenijman.com",
  "topout.andrenijman.com",
  "defenders.andrenijman.com",
  "overpop.andrenijman.com",
  "wildbound.andrenijman.com",
  "tree.andrenijman.com",
  "tung.andrenijman.com",
  "isaac.andrenijman.com",
  "bop.andrenijman.com",
  "slingwreck.andrenijman.com",
  MC_HOST,
]);
const TUNG_ADMINS = new Set(["andrenijman", "mechtical", "pojodragon365"]);
// Single source of truth for what each game is. Descriptions and genres are
// lifted from the hub's own structured data so the two cannot drift, and the
// hub had no entry at all for Slope or Moto X3M until this table existed.
//
// `origin` drives attribution, not decoration. The hub states outright that the
// hosted games are not Andre's work, so their pages must not credit him as the
// author and must not claim authorship in structured data.
const GAMES = {
  "topout.andrenijman.com": {
    name: "TOPOUT",
    description: "A free competitive block-stacking game with modern mechanics, online versus multiplayer, CPU battles, replays and a global leaderboard.",
    genre: ["Puzzle", "Action"],
    image: "topout.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "original",
  },
  "defenders.andrenijman.com": {
    name: "Garden Defenders 2",
    description: "A free, original fan-made lane-defense tower defense game: five worlds, 40 levels, boss fights, endless mode, installable as a PWA.",
    genre: ["Tower defense", "Strategy"],
    image: "defenders.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "original",
  },
  "overpop.andrenijman.com": {
    name: "OVERPOP",
    description: "A free, original round-based tower defense game: 25 woodland-critter towers with three-branch upgrade trees, 100 rounds, 16 maps, levelling heroes, paragons and eleven game modes. Installable as a PWA and playable offline.",
    genre: ["Tower defense", "Strategy"],
    image: "overpop.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "original",
  },
  "wildbound.andrenijman.com": {
    name: "Wildbound.io",
    description: "A free multiplayer survival game with gathering, age upgrades, base building, rotating seasons, bosses, CPU rivals and 60 tameable companion species.",
    genre: ["Survival", "Action", "Multiplayer"],
    image: "wildbound.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "original",
  },
  "tree.andrenijman.com": {
    name: "tree",
    description: "A full-progression procedural browser sandbox with mining, crafting, building, towns, fishing, invasions, events, and bosses through the Moon Lord.",
    genre: ["Sandbox", "Adventure", "Action"],
    image: "tree.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "original",
  },
  "tung.andrenijman.com": {
    name: "Tung Tung Tung Sahorror",
    description: "A free first-person raycaster horror game in a single HTML file. Gather six offerings in the dark and carry them home before the call to Subuh, while a drumming creature hunts by sight, sound and your own panic. Originally by tim.",
    genre: ["Horror", "Survival"],
    image: "tung.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "original",
    // The hub carries this credit visibly on the card and it is the only
    // original-section game that does, so the game's own page must carry it too.
    credit: "originally by tim",
  },
  "isaac.andrenijman.com": {
    name: "ISUCK",
    description: "A free, from-scratch browser roguelike with seeded floors, 732 collectibles, 34 playable characters, alternate paths, 208 enemies and 80 bosses.",
    genre: ["Roguelike", "Action", "Shooter"],
    image: "isuck.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "original",
  },
  "bop.andrenijman.com": {
    name: "BOP",
    description: "A free browser physics brawler: draft one of three wild abilities every round, squish opponents off floating terrain, online multiplayer for eight, couch play and bots.",
    genre: ["Action", "Fighting", "Multiplayer"],
    image: "bop.png",
    imageWidth: 2000,
    imageHeight: 1050,
    origin: "original",
  },
  "slingwreck.andrenijman.com": {
    name: "SLINGWRECK",
    description: "A free browser slingshot demolition game: fling nine kinds of critter at pig fortresses across a 52-level campaign, with a hand-written rigid-body physics engine and a fortress workshop for building your own.",
    genre: ["Action", "Puzzle", "Physics"],
    image: "slingwreck.png",
    imageWidth: 2000,
    imageHeight: 1050,
    origin: "original",
  },
  [MC_HOST]: {
    name: "ONE WORLD",
    description: "A persistent shared anarchy survival world where every signed-in player joins the same map using their games.andrenijman.com username, with a private local-world option and consent-based teleport requests.",
    genre: ["Sandbox", "Survival", "Multiplayer"],
    image: "mc.png",
    imageWidth: 1000,
    imageHeight: 525,
    origin: "curated",
    // The one game that needs an account: the username is the in-world name.
    requiresAccount: true,
  },
};

const GAME_TITLES = Object.fromEntries(
  Object.entries(GAMES).map(([host, game]) => [host, game.name]));

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error(error);
      const url = new URL(request.url);
      if (url.pathname === "/_guard/health") {
        return Response.json({ ok: false, database: false }, {
          status: 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "10" },
        });
      }
      if (!isNavigationRequest(request)) {
        return new Response("Service unavailable", {
          status: 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "10" },
        });
      }
      return htmlPage("Service unavailable", "The access service could not complete this request.", 503);
    }
  },
};

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  if (!HOSTS.has(url.hostname)) return new Response("Unknown host", { status: 404 });

  if (/\/(?:sw|service-worker)\.js$/i.test(url.pathname)) {
    return new Response(RETIRED_SERVICE_WORKER, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Clear-Site-Data": '"cache"',
      },
    });
  }

  if (url.pathname.startsWith("/_guard/")) return handleGuardRoute(request, env, url);

  // Ahead of the asset path: robots.txt and sitemap.xml both match the asset
  // extension test and would otherwise be proxied straight to upstream.
  const crawlerFile = crawlerFileResponse(url);
  if (crawlerFile) return crawlerFile;

  if (isAssetRequest(request)) return cachedAssetResponse(request);

  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  if (url.hostname === MC_HOST && !identity.account) {
    return accountRequired(request, url, identity.cookies);
  }

  // Counted here so a visit means a page actually served: gate redirects above
  // never reach this line, and the inner game iframe is skipped so a single
  // game view is not counted twice.
  if (request.method === "GET" && isTopLevelNavigation(request) &&
      !url.searchParams.has("_games_frame")) {
    recordVisit(env, ctx, url.hostname, identity.deviceId, request.headers.get("User-Agent") || "");
  }

  // Only ever wrap a top-level document. The _games_frame marker alone is not
  // enough: the game navigates itself (service-worker force update, Reset App)
  // in ways that drop the query string, and wrapping the resulting iframe
  // request nests another chrome bar inside the last one, forever.
  if (GAME_TITLES[url.hostname] && request.method === "GET" &&
      isTopLevelNavigation(request) && !url.searchParams.has("_games_frame")) {
    return withCookies(gameFramePage(url, GAMES[url.hostname]), identity.cookies);
  }



  const upstream = await fetchDocumentUpstream(request);
  const response = new Response(upstream.body, upstream);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Games-Guard", "active");
  response.headers.set("Accept-CH", ACCEPT_CH);
  const contentVersion = upstream.headers.get("ETag") || upstream.headers.get("Last-Modified") || "";
  const isHtml = response.headers.get("Content-Type")?.includes("text/html");
  const guardStatus = JSON.stringify({
    allowed: true,
    signedIn: Boolean(identity.account),
    username: identity.account?.username || null,
    needsProfile: needsProfile(identity.device),
  });
  // The inner document of a framed game is the same game at a query-string
  // variant of its own URL. Left alone it competes with the clean URL for the
  // same content and wins nothing, so it is pointed at the canonical page and
  // kept out of the index. `follow` so the game's own internal links still
  // carry weight.
  const framedGame = GAMES[url.hostname] && url.searchParams.has("_games_frame")
    ? `<meta name="robots" content="noindex,follow"><link rel="canonical" href="https://${escapeHtml(url.hostname)}/">`
    : "";
  const guarded = isHtml
    ? new HTMLRewriter().on("head", {
      element(element) {
        element.prepend(`${framedGame}<meta name="games-content-version" content="${escapeHtml(contentVersion)}"><meta name="games-guard-status" content="${escapeHtml(guardStatus)}"><script defer src="/_guard/client.js"></script>`, { html: true });
      },
    }).transform(response)
    : response;
  return withCookies(guarded, identity.cookies);
}

async function handleGuardRoute(request, env, url) {
  if (url.pathname === "/_guard/health") {
    const database = await env.DB.prepare("SELECT 1 AS ok").first();
    return Response.json({ ok: database?.ok === 1, database: database?.ok === 1 }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (url.pathname === "/_guard/privacy") return privacyPage();
  if (url.pathname === "/_guard/client.js") {
    return new Response(CLIENT_JS, {
      headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (url.pathname === "/_guard/version") return contentVersion(request, url);

  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) {
    if (url.pathname === "/_guard/status") {
      return withCookies(Response.json({
        allowed: false, signedIn: Boolean(identity.account), reason: identity.reason,
      }, { status: 403 }), identity.cookies);
    }
    return blockedResponse(identity.reason, identity.cookies);
  }
  if (url.pathname === "/_guard/tung-lobbies") return tungLobbies(request, env, url, identity);
  if (url.pathname === "/_guard/tung-ws") return tungSocket(request, env, url, identity);
  if (url.pathname === "/_guard/bop-lobbies") return bopLobbies(request, url, identity);
  if (url.pathname.startsWith("/_guard/admin")) {
    return withCookies(await handleAdmin(request, env, url), identity.cookies);
  }
  if (url.pathname === "/_guard/device-profile") return deviceProfile(request, env, identity);
  if (url.pathname === "/_guard/logout") return logout(request, env);
  if (url.pathname === "/_guard/login") return login(request, env, url, identity);
  if (url.pathname === "/_guard/register") return register(request, env, url, identity);
  if (url.pathname === "/_guard/mc-ticket") return minecraftJoinTicket(request, env, url, identity);
  if (url.pathname === "/_guard/profile") return gameProfile(request, env, url, identity);
  if (url.pathname === "/_guard/saves" || url.pathname === "/_guard/save") return gameSaves(request, env, url, identity);
  if (url.pathname === "/_guard/status") {
    const response = Response.json({
      allowed: true,
      signedIn: Boolean(identity.account),
      username: identity.account?.username || null,
      needsProfile: needsProfile(identity.device),
    });
    response.headers.set("Cache-Control", "no-store");
    return withCookies(response, identity.cookies);
  }
  return new Response("Not found", { status: 404 });
}

async function minecraftJoinTicket(request, env, url, identity) {
  if (url.hostname !== MC_HOST || request.method !== "POST") {
    return new Response("Not found", { status: 404 });
  }
  if (!identity.account) {
    return withCookies(Response.json({
      error: "account required",
      loginUrl: accountLoginUrl(url).toString(),
    }, { status: 401, headers: { "Cache-Control": "no-store" } }), identity.cookies);
  }
  const username = String(identity.account.username || "");
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    return withCookies(Response.json({
      error: "Minecraft usernames must be 3-16 letters, numbers, or underscores. Ask Andre to rename this games.andrenijman.com account.",
      code: "MC_USERNAME_INVALID",
    }, { status: 422, headers: { "Cache-Control": "no-store" } }), identity.cookies);
  }
  if (!env.MC_JOIN_SECRET || String(env.MC_JOIN_SECRET).length < 32) {
    console.error("MC_JOIN_SECRET is missing or too short");
    return Response.json({ error: "The shared world is not configured yet." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "30" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    username,
    iat: now,
    exp: now + 60,
    nonce: randomToken(18),
    aud: "games-mc-relay",
  };
  const encodedPayload = bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(encodedPayload, env.MC_JOIN_SECRET);
  return withCookies(Response.json({
    ticket: `${encodedPayload}.${signature}`,
    username,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    server: "127.0.0.1:25565",
    proxy: "https://mc-relay.andrenijman.com",
    version: "1.20.1",
  }, { headers: { "Cache-Control": "no-store" } }), identity.cookies);
}

function documentUpstreamRequest(request, path) {
  const source = new URL(request.url);
  const target = upstreamTarget(source, path);
  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  headers.delete("Cookie");
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  headers.delete("Cache-Control");
  return new Request(target, {
    method: path ? "HEAD" : request.method,
    headers,
    body: path || request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });
}

function fetchDocumentUpstream(request, path) {
  const hostname = new URL(request.url).hostname;
  return fetch(documentUpstreamRequest(request, path), pagesFetchOptions(hostname, {
    "200-299": 30, "404": 10, "500-599": 0,
  }));
}

function upstreamTarget(source, path) {
  const target = path ? new URL(path, `https://${source.hostname}`) : new URL(source);
  if (source.hostname === MC_HOST) {
    const upstream = new URL(MC_PAGES_ORIGIN);
    upstream.pathname = `${MC_PAGES_BASE}${target.pathname}`;
    upstream.search = target.search;
    return upstream;
  }
  return target;
}

function pagesFetchOptions(hostname, cacheTtlByStatus) {
  const cf = { cacheEverything: true, cacheTtlByStatus };
  if (hostname !== MC_HOST) cf.resolveOverride = "andrenijman.github.io";
  return { cf };
}

function isAssetRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (isNavigationRequest(request)) return false;
  const destination = request.headers.get("Sec-Fetch-Dest") || "";
  if (destination && destination !== "empty") return true;
  return /\.(?:avif|bin|bmp|css|csv|data|gif|glb|gltf|ico|jpe?g|js|json|m4a|map|mem|mp3|mp4|mtl|obj|ogg|otf|pck|png|svg|tga|ttf|txt|unityweb|wasm|wav|webm|webmanifest|webp|woff2?|xml)$/i
    .test(new URL(request.url).pathname);
}

function isNavigationRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const destination = request.headers.get("Sec-Fetch-Dest") || "";
  return destination === "document" || destination === "iframe" ||
    request.headers.get("Accept")?.includes("text/html");
}

// A navigation of the tab itself, excluding anything already inside a frame.
// Used for the chrome wrapper and visit counting so a nested frame can neither
// be wrapped again nor counted twice. Browsers always send Sec-Fetch-Dest; only
// when it is absent do we fall back to the looser Accept check.
function isTopLevelNavigation(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const destination = request.headers.get("Sec-Fetch-Dest");
  if (destination) return destination === "document";
  return Boolean(request.headers.get("Accept")?.includes("text/html"));
}

async function cachedAssetResponse(request) {
  const source = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  headers.delete("Cookie");
  const upstreamRequest = new Request(upstreamTarget(source), {
    method: request.method,
    headers,
    redirect: "follow",
  });
  const upstream = await fetch(upstreamRequest, pagesFetchOptions(source.hostname, {
    "200-299": 3600, "404": 60, "500-599": 0,
  }));
  const response = new Response(upstream.body, upstream);
  const cacheable = upstream.ok || upstream.status === 304;
  response.headers.delete("Set-Cookie");
  response.headers.set("Cache-Control", cacheable
    ? "public, max-age=300, stale-while-revalidate=86400"
    : "no-store");
  response.headers.set("X-Games-Guard", cacheable ? "asset" : "asset-error");
  return response;
}

async function contentVersion(request, url) {
  let path = url.searchParams.get("path") || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/_guard/")) path = "/";
  const upstream = await fetchDocumentUpstream(request, path);
  const version = upstream.headers.get("ETag") || upstream.headers.get("Last-Modified") || "";
  return Response.json({ version }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

// Same-origin proxy for the BOP lobby directory. The relay lives on a
// workers.dev hostname, so fetching it straight from the game page would be a
// cross-origin request that the guard's session cookie never reaches.
async function bopLobbies(request, url, identity) {
  if (url.hostname !== "bop.andrenijman.com" || request.method !== "GET") {
    return new Response("Not found", { status: 404 });
  }
  const upstream = await fetch("https://bop-relay.tung-tung-tung-sahur.workers.dev/lobbies", {
    headers: { Accept: "application/json", Origin: "https://bop.andrenijman.com" },
  });
  const response = new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
  return withCookies(response, identity.cookies);
}

async function tungLobbies(request, env, url, identity) {
  if (url.hostname !== "tung.andrenijman.com" || request.method !== "GET") {
    return new Response("Not found", { status: 404 });
  }
  const wantsAdmin = url.searchParams.get("admin") === "1";
  const isAdmin = identity.account && TUNG_ADMINS.has(String(identity.account.username).toLowerCase());
  if (wantsAdmin && !isAdmin) {
    return withCookies(Response.json({ error: "admin account required" }, { status: 403 }), identity.cookies);
  }
  const path = wantsAdmin ? "/admin/lobbies" : "/lobbies";
  const headers = {
    Accept: "application/json",
    Cookie: request.headers.get("Cookie") || "",
    Origin: "https://tung.andrenijman.com",
  };
  if (wantsAdmin) {
    headers["X-Tung-Proxy-Authorization"] = `Bearer ${env.TUNG_PROXY_SECRET}`;
    headers["X-Tung-Proxy-Admin-Name"] = String(identity.account.username).toLowerCase();
  }
  const upstream = await fetch(`https://relay.tung.andrenijman.com${path}`, {
    headers,
  });
  const response = new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
  return withCookies(response, identity.cookies);
}

async function tungSocket(request, env, url, identity) {
  if (url.hostname !== "tung.andrenijman.com" || request.method !== "GET" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }
  const username = String(identity.account?.username || "").toLowerCase();
  const target = new URL("https://relay.tung.andrenijman.com/ws");
  target.search = url.search;
  const upstream = new Request(target, request);
  upstream.headers.set("Origin", "https://tung.andrenijman.com");
  upstream.headers.set("X-Tung-Proxy-Authorization", `Bearer ${env.TUNG_PROXY_SECRET}`);
  upstream.headers.set("X-Tung-Proxy-Admin-Name", TUNG_ADMINS.has(username) ? username : "");
  upstream.headers.delete("Cookie");
  return fetch(upstream);
}

async function gameProfile(request, env, url, identity) {
  if (!identity.account) {
    return withCookies(Response.json({ error: "account required" }, { status: 401 }), identity.cookies);
  }
  const game = url.hostname.split('.')[0].slice(0, 32);
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT profile_json, updated_at FROM game_profiles WHERE account_id = ? AND game = ?"
    ).bind(identity.account.id, game).first();
    const response = Response.json({ profile: row ? JSON.parse(row.profile_json) : null, updatedAt: row?.updated_at || null });
    response.headers.set("Cache-Control", "no-store");
    return withCookies(response, identity.cookies);
  }
  if (request.method !== "PUT") return new Response("Method not allowed", { status: 405 });
  const text = await request.text();
  if (text.length > 32768) return Response.json({ error: "profile too large" }, { status: 413 });
  let profile;
  try { profile = JSON.parse(text); } catch { return Response.json({ error: "invalid profile" }, { status: 400 }); }
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return Response.json({ error: "invalid profile" }, { status: 400 });
  }
  await env.DB.prepare(`
    INSERT INTO game_profiles (account_id, game, profile_json) VALUES (?, ?, ?)
    ON CONFLICT(account_id, game) DO UPDATE SET profile_json = excluded.profile_json, updated_at = CURRENT_TIMESTAMP
  `).bind(identity.account.id, game, JSON.stringify(profile)).run();
  return withCookies(Response.json({ saved: true }), identity.cookies);
}

async function gameSaves(request, env, url, identity) {
  if (!identity.account) {
    return withCookies(Response.json({ error: "account required" }, { status: 401 }), identity.cookies);
  }
  const game = url.hostname.split('.')[0].slice(0, 32);
  if (url.pathname === "/_guard/saves") {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    const result = await env.DB.prepare(`
      SELECT save_id, name, updated_at, deleted_at, evil, hardmode, victory
      FROM game_saves WHERE account_id = ? AND game = ? ORDER BY updated_at DESC
    `).bind(identity.account.id, game).all();
    const worlds = (result.results || []).map(row => ({
      id: row.save_id,
      name: row.name,
      updatedAt: Number(row.updated_at),
      deletedAt: row.deleted_at == null ? null : Number(row.deleted_at),
      evil: row.evil,
      hardmode: Boolean(row.hardmode),
      victory: Boolean(row.victory),
      data: null,
    }));
    return withCookies(Response.json({ worlds }, { headers: { "Cache-Control": "no-store" } }), identity.cookies);
  }

  const id = url.searchParams.get("id") || "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return Response.json({ error: "invalid save id" }, { status: 400 });
  if (request.method === "GET") {
    const row = await env.DB.prepare(`
      SELECT save_id, name, save_json, updated_at, deleted_at, evil, hardmode, victory
      FROM game_saves WHERE account_id = ? AND game = ? AND save_id = ?
    `).bind(identity.account.id, game, id).first();
    if (!row || row.deleted_at != null) return Response.json({ error: "world not found" }, { status: 404 });
    const world = {
      id: row.save_id,
      name: row.name,
      createdAt: Number(row.updated_at),
      updatedAt: Number(row.updated_at),
      deletedAt: null,
      evil: row.evil,
      hardmode: Boolean(row.hardmode),
      victory: Boolean(row.victory),
      data: JSON.parse(row.save_json),
    };
    return withCookies(Response.json({ world }, { headers: { "Cache-Control": "no-store" } }), identity.cookies);
  }
  if (request.method !== "PUT" && request.method !== "DELETE") {
    return new Response("Method not allowed", { status: 405 });
  }
  const text = await request.text();
  if (text.length > 1900000) return Response.json({ error: "world save is too large" }, { status: 413 });
  let body;
  try { body = JSON.parse(text || "{}"); } catch { return Response.json({ error: "invalid save" }, { status: 400 }); }
  const name = String(body.name || "Unnamed World").replace(/\s+/g, " ").trim().slice(0, 32) || "Unnamed World";
  const updatedAt = Number.isFinite(body.updatedAt) && body.updatedAt > 0 ? Math.floor(body.updatedAt) : Date.now();

  if (request.method === "DELETE") {
    await env.DB.prepare(`
      INSERT INTO game_saves (account_id, game, save_id, name, save_json, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, '{}', ?, ?)
      ON CONFLICT(account_id, game, save_id) DO UPDATE SET
        name = excluded.name, save_json = '{}', updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      WHERE excluded.updated_at >= game_saves.updated_at
    `).bind(identity.account.id, game, id, name, updatedAt, updatedAt).run();
    return withCookies(Response.json({ deleted: true, updatedAt }), identity.cookies);
  }

  if (!body.save || typeof body.save !== "object" || Array.isArray(body.save) ||
      body.save.format !== 1 || typeof body.save.tiles !== "string") {
    return Response.json({ error: "invalid world save" }, { status: 400 });
  }
  const saveJson = JSON.stringify(body.save);
  if (saveJson.length > 1850000) return Response.json({ error: "world save is too large" }, { status: 413 });
  const evil = body.evil === "crimson" ? "crimson" : body.evil === "corrupt" ? "corrupt" : "random";
  await env.DB.prepare(`
    INSERT INTO game_saves (account_id, game, save_id, name, save_json, updated_at, deleted_at, evil, hardmode, victory)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    ON CONFLICT(account_id, game, save_id) DO UPDATE SET
      name = excluded.name, save_json = excluded.save_json, updated_at = excluded.updated_at,
      deleted_at = NULL, evil = excluded.evil, hardmode = excluded.hardmode, victory = excluded.victory
    WHERE excluded.updated_at >= game_saves.updated_at
  `).bind(identity.account.id, game, id, name, saveJson, updatedAt, evil, body.hardmode ? 1 : 0, body.victory ? 1 : 0).run();
  return withCookies(Response.json({ saved: true, updatedAt }), identity.cookies);
}

async function identify(request, env, game) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const responseCookies = [];
  let deviceId = null;
  for (const value of cookieValues(cookieHeader, DEVICE_COOKIE).reverse()) {
    deviceId = await verifyDeviceCookie(value, env.COOKIE_SECRET);
    if (deviceId) break;
  }
  if (deviceId) {
    const alias = await env.DB.prepare("SELECT device_id FROM device_aliases WHERE alias_id = ?")
      .bind(deviceId).first();
    if (alias) {
      deviceId = alias.device_id;
      responseCookies.push(await deviceCookie(deviceId, env.COOKIE_SECRET));
    }
  }
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    responseCookies.push(await deviceCookie(deviceId, env.COOKIE_SECRET));
  }

  const sessionHash = cookies[SESSION_COOKIE] ? await sha256(cookies[SESSION_COOKIE]) : null;
  let account = null;
  if (sessionHash) {
    account = await env.DB.prepare(`
      SELECT accounts.id, accounts.username, accounts.banned_at, accounts.ban_reason
      FROM sessions JOIN accounts ON accounts.id = sessions.account_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP
    `).bind(sessionHash).first();
  }

  const metadata = deviceMetadata(request);
  // The arrival referrer is written once and then left alone; the latest
  // external one keeps moving. Both ignore empty values, so an internal
  // navigation or a sub-resource fetch never erases a real referrer.
  const device = await env.DB.prepare(`
    INSERT INTO devices (
      id, account_id, label, user_agent, browser, browser_version, os, os_version,
      model, arch, ip_prefix, country, city, region, asn_org, last_game,
      first_referrer, referrer
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      account_id = COALESCE(excluded.account_id, devices.account_id),
      label = CASE WHEN devices.label_source = 'auto' THEN excluded.label ELSE devices.label END,
      user_agent = excluded.user_agent,
      browser = excluded.browser,
      browser_version = CASE WHEN excluded.browser_version <> '' THEN excluded.browser_version ELSE devices.browser_version END,
      os = excluded.os,
      os_version = CASE WHEN excluded.os_version <> '' THEN excluded.os_version ELSE devices.os_version END,
      model = CASE WHEN excluded.model <> '' THEN excluded.model ELSE devices.model END,
      arch = CASE WHEN excluded.arch <> '' THEN excluded.arch ELSE devices.arch END,
      ip_prefix = excluded.ip_prefix,
      country = excluded.country,
      city = excluded.city,
      region = excluded.region,
      asn_org = excluded.asn_org,
      last_game = excluded.last_game,
      first_referrer = CASE WHEN devices.first_referrer <> '' THEN devices.first_referrer ELSE excluded.first_referrer END,
      referrer = CASE WHEN excluded.referrer <> '' THEN excluded.referrer ELSE devices.referrer END,
      last_seen_at = CURRENT_TIMESTAMP
    RETURNING banned_at, ban_reason, label, label_source, profile_at, model
  `).bind(deviceId, account?.id || null, defaultDeviceLabel(metadata, deviceId), metadata.userAgent,
    metadata.browser, metadata.browserVersion, metadata.os, metadata.osVersion, metadata.model,
    metadata.arch, metadata.ipPrefix, metadata.country, metadata.city, metadata.region,
    metadata.asnOrg, game, metadata.referrer, metadata.referrer).first();
  const reason = device?.banned_at
    ? device.ban_reason || "This device has been blocked."
    : account?.banned_at
      ? account.ban_reason || "This account has been blocked."
      : null;
  return {
    account,
    device,
    deviceId,
    blocked: Boolean(reason),
    reason,
    cookies: responseCookies,
  };
}

function needsProfile(device) {
  return Boolean(device) && !device.profile_at;
}

// Crawlers, previewers and monitors are not visits. This only has to be good
// enough to keep the counters honest, not to be a security control.
//
// Kept as the fallback below CRAWLERS so that widening the classifier can only
// ever exclude more traffic from the counters, never less. Its broad `monitor`
// and `preview` tokens are deliberately left alone for that reason.
const BOT_AGENT = /bot|crawl|spider|slurp|bingpreview|headless|phantom|puppeteer|playwright|curl|wget|python-requests|libwww|java\/|go-http|okhttp|axios|facebookexternalhit|embedly|quora link|whatsapp|telegram|slackbot|discordbot|twitterbot|linkedinbot|pinterest|redditbot|applebot|petalbot|ahrefs|semrush|mj12|dotbot|screaming frog|lighthouse|gtmetrix|pingdom|uptime|monitor|preview/i;

// Named agents, so a console row says "Baiduspider" instead of leaving an
// operator to read a raw string and guess. First match wins, so the generic
// tool patterns sit at the end and a named crawler is never labelled "curl".
//
// `asn` is the operator's own network, set only where that network is the sole
// legitimate source. A mismatch there means the user agent is lying. It is
// deliberately absent for Baiduspider, which reaches this site from China
// Unicom ranges rather than anything Baidu-named.
const CRAWLERS = [
  { re: /googlebot/i, name: "Googlebot", kind: "search", asn: /google/i },
  { re: /google-inspectiontool|googleother|apis-google|feedfetcher-google|google-read-aloud/i,
    name: "Google tools", kind: "search", asn: /google/i },
  { re: /bingbot|bingpreview|adidxbot/i, name: "Bingbot", kind: "search", asn: /microsoft/i },
  { re: /applebot/i, name: "Applebot", kind: "search", asn: /apple/i },
  { re: /yandex(bot|images)/i, name: "YandexBot", kind: "search", asn: /yandex/i },
  { re: /baiduspider/i, name: "Baiduspider", kind: "search" },
  { re: /duckduckbot|duckassistbot/i, name: "DuckDuckBot", kind: "search" },
  { re: /petalbot/i, name: "PetalBot", kind: "search" },
  { re: /seznambot/i, name: "SeznamBot", kind: "search" },
  { re: /sogou/i, name: "Sogou", kind: "search" },
  { re: /slurp/i, name: "Yahoo Slurp", kind: "search" },

  { re: /mediapartners-google/i, name: "AdSense", kind: "ads", asn: /google/i },
  { re: /adsbot-google/i, name: "AdsBot-Google", kind: "ads", asn: /google/i },

  { re: /claude-user|claudebot|anthropic/i, name: "Anthropic", kind: "ai" },
  { re: /gptbot|oai-searchbot|chatgpt-user/i, name: "OpenAI", kind: "ai" },
  { re: /perplexity/i, name: "Perplexity", kind: "ai" },
  { re: /bytespider/i, name: "Bytespider", kind: "ai" },
  { re: /amazonbot/i, name: "Amazonbot", kind: "ai" },
  { re: /ccbot/i, name: "CCBot", kind: "ai" },
  { re: /meta-externalagent|facebookexternalhit/i, name: "Meta", kind: "ai" },

  { re: /ahrefs/i, name: "AhrefsBot", kind: "seo" },
  { re: /semrush/i, name: "SemrushBot", kind: "seo" },
  { re: /mj12/i, name: "MJ12bot", kind: "seo" },
  { re: /dotbot/i, name: "DotBot", kind: "seo" },
  { re: /screaming frog/i, name: "Screaming Frog", kind: "seo" },
  { re: /domaincrawler|dataprovider/i, name: "Domain crawler", kind: "seo" },

  { re: /censys/i, name: "Censys", kind: "scanner" },
  { re: /paloaltonetworks|expanse/i, name: "Palo Alto scan", kind: "scanner" },
  { re: /zgrab|masscan|nuclei|sqlmap|nmap/i, name: "Scanner", kind: "scanner" },
  { re: /internet-?measurement|driftnet/i, name: "Measurement", kind: "scanner" },

  { re: /whatsapp|telegram|slackbot|discordbot|twitterbot|linkedinbot|pinterest|redditbot|embedly|quora link/i,
    name: "Link preview", kind: "social" },

  { re: /chrome privacy preserving prefetch proxy/i, name: "Prefetch proxy", kind: "monitor" },
  { re: /lighthouse|gtmetrix|pingdom|statuscake|betteruptime|uptimerobot/i, name: "Monitor", kind: "monitor" },

  { re: /headless|puppeteer|playwright|phantom/i, name: "Headless browser", kind: "tool" },
  { re: /^curl\//i, name: "curl", kind: "tool" },
  { re: /^wget/i, name: "wget", kind: "tool" },
  { re: /^node$|node-fetch|undici/i, name: "node", kind: "tool" },
  { re: /python-requests|python-httpx|httpx|aiohttp|urllib|scrapy|libwww/i, name: "Python", kind: "tool" },
  { re: /java\/|okhttp|go-http|axios|dalvik|guzzle|postman|insomnia/i, name: "HTTP client", kind: "tool" },
];

// The console classifies every loaded device several times per render — tab
// count, view filter, search and row — and ADMIN_ROW_WINDOW is 25000. Agent
// strings repeat heavily, so memoising by string turns that back into one walk
// of the table per distinct agent. Results are shared and must be treated as
// read-only. Cleared wholesale at the cap so a stream of unique agents cannot
// grow the isolate without bound.
const AGENT_CACHE = new Map();
const AGENT_CACHE_MAX = 2000;

function classifyAgent(userAgent) {
  const ua = String(userAgent || "");
  const cached = AGENT_CACHE.get(ua);
  if (cached) return cached;
  const result = classifyAgentUncached(ua);
  if (AGENT_CACHE.size >= AGENT_CACHE_MAX) AGENT_CACHE.clear();
  AGENT_CACHE.set(ua, result);
  return result;
}

function classifyAgentUncached(ua) {
  if (!ua) return { bot: true, name: "No user agent", kind: "other" };
  for (const entry of CRAWLERS) {
    if (entry.re.test(ua)) return { bot: true, name: entry.name, kind: entry.kind, asn: entry.asn };
  }
  if (BOT_AGENT.test(ua)) return { bot: true, name: "Bot", kind: "other" };
  return { bot: false, name: "", kind: "" };
}

function isBotAgent(userAgent) {
  return classifyAgent(userAgent).bot;
}

// A user agent is a claim, not evidence. Where an operator crawls only from its
// own network, arriving from anywhere else means the claim is unsupported —
// this catches a request calling itself Googlebot while coming from a rented
// VPS or a consumer ISP. Deliberately "unverified" rather than "spoofed": the
// observable fact is the network mismatch, and the commonest cause here is the
// operator testing with a changed user agent rather than anyone lying.
// An unrecorded network proves nothing, so it never counts as a mismatch.
function agentUnverified(device) {
  const { asn } = classifyAgent(device.user_agent);
  if (!asn || !device.asn_org) return false;
  return !asn.test(String(device.asn_org));
}

// Perth is UTC+8 with no daylight saving, so a fixed offset gives the operator
// their own calendar day rather than a UTC one that rolls over mid-morning.
function perthDay(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// Counters are aggregated per day per host, and unique visitors come from one
// row per device per day, so nothing grows with traffic except a fixed few
// rows a day. Writes never block the response.
function recordVisit(env, ctx, host, deviceId, userAgent) {
  if (isBotAgent(userAgent) || !deviceId) return;
  const day = perthDay();
  const work = env.DB.batch([
    env.DB.prepare(`
      INSERT INTO visit_days (day, host, views) VALUES (?, ?, 1)
      ON CONFLICT(day, host) DO UPDATE SET views = views + 1
    `).bind(day, host),
    env.DB.prepare("INSERT OR IGNORE INTO visit_device_days (day, host, device_id) VALUES (?, ?, ?)")
      .bind(day, host, deviceId),
  ]).catch((error) => console.error("visit not recorded", error));
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work);
}

// Views and unique devices for today, the last 7 days and the last 30 days,
// counted in Perth days to match the dashboard's clock.
async function visitStats(env) {
  const today = perthDay();
  const dayBefore = (days) => perthDay(new Date(Date.now() - days * 86400000));
  const window7 = dayBefore(6);
  const window30 = dayBefore(29);
  const [views, uniques, hosts] = await Promise.all([
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN day = ?1 THEN views ELSE 0 END) AS today,
        SUM(CASE WHEN day >= ?2 THEN views ELSE 0 END) AS week,
        SUM(CASE WHEN day >= ?3 THEN views ELSE 0 END) AS month
      FROM visit_days
    `).bind(today, window7, window30).first(),
    env.DB.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN day = ?1 THEN device_id END) AS today,
        COUNT(DISTINCT CASE WHEN day >= ?2 THEN device_id END) AS week,
        COUNT(DISTINCT CASE WHEN day >= ?3 THEN device_id END) AS month
      FROM visit_device_days
    `).bind(today, window7, window30).first(),
    env.DB.prepare(`
      SELECT host, SUM(views) AS views FROM visit_days
      WHERE day >= ?1 GROUP BY host ORDER BY views DESC LIMIT 12
    `).bind(window30).all(),
  ]);
  return {
    views: {
      today: Number(views?.today || 0),
      week: Number(views?.week || 0),
      month: Number(views?.month || 0),
    },
    uniques: {
      today: Number(uniques?.today || 0),
      week: Number(uniques?.week || 0),
      month: Number(uniques?.month || 0),
    },
    hosts: (hosts?.results || []).map((row) => ({ host: row.host, views: Number(row.views || 0) })),
  };
}

async function deviceProfile(request, env, identity) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const text = await request.text();
  if (text.length > 2048) return Response.json({ error: "profile too large" }, { status: 413 });
  let body;
  try { body = JSON.parse(text || "{}"); } catch { return Response.json({ error: "invalid profile" }, { status: 400 }); }
  const screen = /^\d{2,5}x\d{2,5}@\d(?:\.\d{1,3})?$/.test(String(body.screen || "")) ? String(body.screen) : "";
  // NULLIF keeps a previously reported value when this report omits the field;
  // the integer columns are always sent together, and 0 is meaningful for touch.
  await env.DB.prepare(`
    UPDATE devices SET
      gpu = COALESCE(NULLIF(?, ''), gpu),
      screen = COALESCE(NULLIF(?, ''), screen),
      cpu_cores = ?, device_memory = ?, touch_points = ?,
      timezone = COALESCE(NULLIF(?, ''), timezone),
      languages = COALESCE(NULLIF(?, ''), languages),
      profile_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(cleanText(body.gpu, 80), screen, boundedInt(body.cores, 0, 512),
    boundedInt(body.memory, 0, 1024), boundedInt(body.touch, 0, 32),
    cleanText(body.timezone, 48), cleanText(body.languages, 64), identity.deviceId).run();
  return withCookies(Response.json({ saved: true }), identity.cookies);
}

function cleanText(value, max) {
  return String(value ?? "").replace(/[\s\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

function boundedInt(value, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

async function login(request, env, url, identity) {
  const returnTo = safeReturn(url.searchParams.get("return"));
  if (request.method === "GET") {
    return withCookies(authPage("Sign in", returnTo), identity.cookies);
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const account = await env.DB.prepare(
    "SELECT id, username, password_hash, password_salt, banned_at, ban_reason FROM accounts WHERE username = ?"
  ).bind(username).first();
  if (!account || !(await verifyPassword(password, account.password_salt, account.password_hash))) {
    return withCookies(authPage("Sign in", returnTo, "Incorrect username or password.", 401), identity.cookies);
  }
  if (account.banned_at) return blockedResponse(account.ban_reason || "This account has been blocked.");

  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), account.id, expires).run();
  const response = Response.redirect(returnTo || "https://games.andrenijman.com/", 303);
  return withCookies(response, [...identity.cookies, sessionCookie(token, SESSION_DAYS * 86400)]);
}

async function register(request, env, url, identity) {
  const returnTo = safeReturn(url.searchParams.get("return"));
  if (request.method === "GET") {
    return withCookies(authPage("Create account", returnTo, "", 200, true), identity.cookies);
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
    return withCookies(authPage("Create account", returnTo, "Use 3-32 letters, numbers, underscores, or hyphens.", 400, true), identity.cookies);
  }
  if (password.length < 12 || password.length > 128) {
    return withCookies(authPage("Create account", returnTo, "Password must be 12-128 characters.", 400, true), identity.cookies);
  }
  const salt = randomToken(16);
  const hash = await hashPassword(password, salt);
  let result;
  try {
    result = await env.DB.prepare(
      "INSERT INTO accounts (username, password_hash, password_salt) VALUES (?, ?, ?)"
    ).bind(username, hash, salt).run();
  } catch {
    return withCookies(authPage("Create account", returnTo, "That username is already in use.", 409, true), identity.cookies);
  }

  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), result.meta.last_row_id, expires).run();
  return withCookies(Response.redirect(returnTo || "https://games.andrenijman.com/", 303), [
    ...identity.cookies, sessionCookie(token, SESSION_DAYS * 86400),
  ]);
}

async function logout(request, env) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = parseCookies(request.headers.get("Cookie") || "")[SESSION_COOKIE];
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  let returnTo = "https://games.andrenijman.com/";
  try {
    const form = await request.formData();
    returnTo = safeReturn(form.get("return"));
  } catch {}
  return withCookies(Response.redirect(returnTo, 303), [sessionCookie("", 0)]);
}

async function handleAdmin(request, env, url) {
  const adminEmail = request.headers.get("CF-Access-Authenticated-User-Email") || "";
  if (!isAdminEmail(adminEmail, env)) {
    return htmlPage("Forbidden", "This dashboard requires a configured Cloudflare Access administrator.", 403);
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const action = String(form.get("action") || "");
    const id = String(form.get("id") || "");
    const accountId = String(form.get("account_id") || "");
    const reason = String(form.get("reason") || "").trim().slice(0, 200);
    if (action === "ban-device") {
      await env.DB.prepare("UPDATE devices SET banned_at = CURRENT_TIMESTAMP, ban_reason = ? WHERE id = ?")
        .bind(reason, id).run();
    } else if (action === "unban-device") {
      await env.DB.prepare("UPDATE devices SET banned_at = NULL, ban_reason = NULL WHERE id = ?").bind(id).run();
    } else if (action === "label-device") {
      const label = cleanText(form.get("device_label"), 80);
      if (label.length < 2) return new Response("Device label must be at least 2 characters", { status: 400 });
      await env.DB.prepare("UPDATE devices SET label = ?, label_source = 'admin' WHERE id = ?")
        .bind(label, id).run();
    } else if (action === "rename-account") {
      const username = String(form.get("account_name") || "").trim();
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
        return new Response("Account name must use 3-32 letters, numbers, underscores, or hyphens", { status: 400 });
      }
      try {
        await env.DB.prepare("UPDATE accounts SET username = ? WHERE id = ?").bind(username, accountId).run();
      } catch {
        return new Response("That account name is already in use", { status: 409 });
      }
    } else if (action === "reset-account-password") {
      const password = String(form.get("new_password") || "");
      const confirmation = String(form.get("confirm_password") || "");
      if (password.length < 12 || password.length > 128) {
        return new Response("Password must be 12-128 characters", { status: 400 });
      }
      if (password !== confirmation) return new Response("Passwords do not match", { status: 400 });
      const salt = randomToken(16);
      const hash = await hashPassword(password, salt);
      await env.DB.batch([
        env.DB.prepare("UPDATE accounts SET password_hash = ?, password_salt = ? WHERE id = ?")
          .bind(hash, salt, accountId),
        env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(accountId),
      ]);
    } else if (action === "ban-account") {
      await env.DB.prepare("UPDATE accounts SET banned_at = CURRENT_TIMESTAMP, ban_reason = ? WHERE id = ?")
        .bind(reason, accountId).run();
      await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(accountId).run();
    } else if (action === "unban-account") {
      await env.DB.prepare("UPDATE accounts SET banned_at = NULL, ban_reason = NULL WHERE id = ?").bind(accountId).run();
    } else {
      return new Response("Unknown action", { status: 400 });
    }
    const redirect = new URL("https://games.andrenijman.com/_guard/admin");
    redirect.search = url.search;
    return Response.redirect(redirect, 303);
  }

  // Grouping, search and paging all happen in memory, so the row window is
  // bounded to protect the isolate. The headline counts come from SQL instead,
  // so they stay truthful even when the window is not big enough to hold
  // every device.
  const [devices, totals, visits] = await Promise.all([
    env.DB.prepare(`
      SELECT devices.*, accounts.username, accounts.banned_at AS account_banned_at
      FROM devices LEFT JOIN accounts ON accounts.id = devices.account_id
      ORDER BY devices.last_seen_at DESC LIMIT ${ADMIN_ROW_WINDOW}
    `).all(),
    env.DB.prepare(`
      SELECT COUNT(*) AS devices,
             SUM(CASE WHEN label_source != 'auto' THEN 1 ELSE 0 END) AS custom_labelled
      FROM devices
    `).first(),
    visitStats(env),
  ]);
  const rows = devices.results || [];
  return adminPage(groupDevices(rows), adminEmail, url, {
    totalDevices: Number(totals?.devices || 0),
    totalLabelled: Number(totals?.custom_labelled || 0),
    loaded: rows.length,
    truncated: rows.length >= ADMIN_ROW_WINDOW,
    visits,
  });
}

// One row per browser profile is unreadable once a person owns four of them.
// Devices that have signed into the same account are the same person, so group
// on that and leave everything else in a single unclaimed bucket.
function groupDevices(devices) {
  const people = new Map();
  const unclaimed = { key: "unclaimed", accountId: null, username: null, accountBanned: null, devices: [] };
  for (const device of devices) {
    if (!device.account_id) {
      unclaimed.devices.push(device);
      continue;
    }
    const key = String(device.account_id);
    if (!people.has(key)) {
      people.set(key, {
        key,
        accountId: device.account_id,
        username: device.username,
        accountBanned: device.account_banned_at,
        devices: [],
      });
    }
    people.get(key).devices.push(device);
  }
  const groups = [...people.values()];
  for (const group of groups) {
    group.lastSeen = group.devices[0]?.last_seen_at || "";
    group.blocked = Boolean(group.accountBanned) || group.devices.some((device) => device.banned_at);
  }
  groups.sort((a, b) => (Number(b.blocked) - Number(a.blocked)) || String(b.lastSeen).localeCompare(String(a.lastSeen)));
  if (unclaimed.devices.length) {
    unclaimed.lastSeen = unclaimed.devices[0]?.last_seen_at || "";
    unclaimed.blocked = unclaimed.devices.some((device) => device.banned_at);
    groups.push(unclaimed);
  }
  return groups;
}

function isAdminEmail(email, env) {
  const candidate = String(email || "").trim().toLowerCase();
  if (!candidate) return false;
  const allowed = `${env.ADMIN_EMAILS || ""} ${env.ADMIN_EMAIL || ""}`
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(candidate);
}

function deviceMetadata(request) {
  const userAgent = (request.headers.get("User-Agent") || "").slice(0, 500);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const bitness = hintValue(request.headers.get("Sec-CH-UA-Bitness"));
  const arch = [hintValue(request.headers.get("Sec-CH-UA-Arch")), bitness ? `${bitness}-bit` : ""]
    .filter(Boolean).join(" ");
  return {
    userAgent,
    browser: detectBrowser(userAgent),
    browserVersion: (brandVersion(request.headers.get("Sec-CH-UA-Full-Version-List")) || uaVersion(userAgent)).slice(0, 40),
    // Kept UA-derived on purpose: hints are absent on the first navigation and
    // on Firefox/Safari entirely, so mixing sources makes the column flip.
    os: detectOs(userAgent),
    osVersion: hintValue(request.headers.get("Sec-CH-UA-Platform-Version")).slice(0, 20),
    model: hintValue(request.headers.get("Sec-CH-UA-Model")).slice(0, 60),
    arch: arch.slice(0, 30),
    ipPrefix: maskIp(ip),
    country: (request.cf?.country || "").slice(0, 2),
    city: String(request.cf?.city || "").slice(0, 60),
    region: String(request.cf?.region || "").slice(0, 60),
    asnOrg: String(request.cf?.asOrganization || "").slice(0, 80),
    referrer: externalReferrer(request),
  };
}

// Only a cross-site referrer answers "how did this device get here". Every game
// is a *.andrenijman.com host, so once somebody is inside the site almost every
// navigation carries an internal referrer that would bury the real one.
// Sub-resource requests are skipped for the same reason: their referrer is the
// game page itself, not the arrival. Referrer-Policy is
// strict-origin-when-cross-origin, so a cross-site value arrives as a bare
// origin with no path — search referrers land as "https://www.baidu.com/".
function externalReferrer(request) {
  if (!isTopLevelNavigation(request)) return "";
  const raw = request.headers.get("Referer") || "";
  if (!raw) return "";
  let host;
  try { host = new URL(raw).hostname; } catch { return ""; }
  if (host === "andrenijman.com" || host.endsWith(COOKIE_DOMAIN)) return "";
  return raw.slice(0, 200);
}

// Client hints arrive as RFC 8941 structured headers: quoted strings for single
// values, an empty string on platforms that have no answer (desktop Chromium
// reports no model). Firefox and Safari send nothing at all.
function hintValue(value) {
  if (!value) return "";
  return value.trim().replace(/^"(.*)"$/s, "$1").replace(/\\"/g, '"').trim();
}

function brandVersion(list) {
  if (!list) return "";
  const brands = [...list.matchAll(/"([^"]+)";\s*v="([^"]+)"/g)]
    .map(([, brand, version]) => ({ brand: brand.trim(), version }))
    .filter(({ brand }) => !/not.?a.?brand/i.test(brand));
  const preferred = brands.find(({ brand }) => !/^chromium$/i.test(brand)) || brands[0];
  return preferred ? `${preferred.brand} ${preferred.version}` : "";
}

function uaVersion(ua) {
  const firefox = ua.match(/Firefox\/([\d.]+)/);
  if (firefox) return `Firefox ${firefox[1]}`;
  const safari = ua.match(/Version\/([\d.]+)[^)]*Safari\//);
  if (safari) return `Safari ${safari[1]}`;
  const edge = ua.match(/Edg\/([\d.]+)/);
  if (edge) return `Edge ${edge[1]}`;
  const chrome = ua.match(/(?:CriOS|Chrome)\/([\d.]+)/);
  if (chrome) return `Chrome ${chrome[1]}`;
  return "";
}

function defaultDeviceLabel(metadata, deviceId) {
  const hardware = metadata.model || `${metadata.os} ${metadata.browser}`;
  const place = [metadata.city, metadata.country].filter(Boolean).join(" ") || "Unknown";
  return `${hardware} · ${place} · ${deviceId.slice(0, 4)}`;
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/CriOS|Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

function detectOs(ua) {
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS/iPadOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

function maskIp(ip) {
  if (ip.includes(".")) return ip.split(".").slice(0, 3).join(".") + ".0/24";
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + "::/64";
  return "";
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split(/=(.*)/s)).filter(([key]) => key));
}

function cookieValues(header, name) {
  return header.split(";").map((part) => part.trim().split(/=(.*)/s))
    .filter(([key]) => key === name).map(([, value]) => value);
}

async function deviceCookie(id, secret) {
  if (!secret) throw new Error("COOKIE_SECRET is not configured");
  const signature = await hmac(id, secret);
  return cookie(DEVICE_COOKIE, `${id}.${signature}`, 31536000);
}

async function verifyDeviceCookie(value, secret) {
  if (!value || !secret) return null;
  const split = value.lastIndexOf(".");
  if (split < 1) return null;
  const id = value.slice(0, split);
  const signature = value.slice(split + 1);
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return timingSafeEqual(signature, await hmac(id, secret)) ? id : null;
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function sessionCookie(value, maxAge) {
  return cookie(SESSION_COOKIE, value, maxAge);
}

function withCookies(response, cookies = []) {
  if (!cookies.length) return response;
  const mutable = new Response(response.body, response);
  for (const value of cookies) mutable.headers.append("Set-Cookie", value);
  return mutable;
}

function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToBase64(data);
}

async function sha256(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS,
  }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

async function verifyPassword(password, salt, expected) {
  return timingSafeEqual(await hashPassword(password, salt), expected);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeReturn(value) {
  try {
    const url = new URL(value || "https://games.andrenijman.com/");
    return HOSTS.has(url.hostname) && url.protocol === "https:" ? url.toString() : "https://games.andrenijman.com/";
  } catch {
    return "https://games.andrenijman.com/";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function blockedResponse(reason, cookies = []) {
  const response = htmlPage("Access blocked", `${escapeHtml(reason)} Contact the site owner if this is a mistake.`, 403);
  response.headers.set("Clear-Site-Data", '"cache"');
  return withCookies(response, cookies);
}

function accountLoginUrl(url) {
  const loginUrl = new URL("https://games.andrenijman.com/_guard/login");
  loginUrl.searchParams.set("return", `https://${url.hostname}/`);
  return loginUrl;
}

function accountRequired(request, url, cookies = []) {
  const loginUrl = accountLoginUrl(url);
  if (isNavigationRequest(request)) return withCookies(Response.redirect(loginUrl, 302), cookies);
  return withCookies(Response.json({
    error: "account required",
    accountRequired: true,
    loginUrl: loginUrl.toString(),
  }, { status: 401, headers: { "Cache-Control": "no-store" } }), cookies);
}

function authPage(title, returnTo, error = "", status = 200, registering = false) {
  const action = registering ? "register" : "login";
  const alternate = registering ? "login" : "register";
  const alternateLabel = registering ? "Already registered? Sign in" : "Need an account? Register";
  let minecraftRequired = false;
  try {
    minecraftRequired = new URL(returnTo).hostname === MC_HOST;
  } catch {}
  return shell(title, `
    <main class="auth">
      <p class="kicker">${minecraftRequired ? "ACCOUNT REQUIRED FOR ONE WORLD" : "OPTIONAL ACCOUNT"}</p><h1>${title}</h1>
      <p class="account-purpose">${minecraftRequired
        ? "Your account username is your in-world name. ONE WORLD requires a signed-in games.andrenijman.com account; use 3-16 letters, numbers, or underscores for compatibility."
        : "Accounts sync supported game progress between devices. You can still play without an account."}</p>
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/_guard/${action}?return=${encodeURIComponent(returnTo)}">
        <label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="32"></label>
        <label>Password<input name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" required minlength="12" maxlength="128"></label>
        <button type="submit">${title}</button>
      </form>
      <a class="alternate" href="/_guard/${alternate}?return=${encodeURIComponent(returnTo)}">${alternateLabel}</a>
      <div class="choice"><span>or</span></div>
      <a class="skip-button" href="${escapeHtml(returnTo)}">Continue without an account</a>
      <p class="fine"><a href="/_guard/privacy">Privacy information</a></p>
    </main>`, status);
}

function adminPage(groups, email, url, stats = {}) {
  const allowedViews = new Set(["all", "accounts", "unclaimed", "blocked", "crawlers"]);
  const requestedView = String(url.searchParams.get("view") || "all");
  const view = allowedViews.has(requestedView) ? requestedView : "all";
  const query = cleanText(url.searchParams.get("q"), 80);
  const queryLower = query.toLowerCase();
  const pageSize = 30;
  const requestedPage = boundedInt(url.searchParams.get("page"), 1, 1000);

  const accountGroups = groups.filter((group) => group.accountId);
  const unclaimed = groups.find((group) => !group.accountId);
  const loadedCount = groups.reduce((total, group) => total + group.devices.length, 0);
  const loadedLabelled = groups.reduce((total, group) =>
    total + group.devices.filter((device) => device.label_source !== "auto").length, 0);
  const deviceCount = stats.totalDevices ?? loadedCount;
  const labelledCount = stats.totalLabelled ?? loadedLabelled;
  const blockedCount = groups.filter((group) => group.blocked).length;
  // Counted over the loaded window, like the unclaimed tab, not over the whole
  // table. Automated traffic is the bulk of what fills this console, so it gets
  // a tab rather than making the operator search for it.
  const isCrawler = (device) => classifyAgent(device.user_agent).bot;
  const crawlerCount = groups.reduce((total, group) => total + group.devices.filter(isCrawler).length, 0);

  let visible = groups.filter((group) => {
    if (view === "accounts") return Boolean(group.accountId);
    if (view === "unclaimed") return !group.accountId;
    if (view === "blocked") return group.blocked;
    if (view === "crawlers") return group.devices.some(isCrawler);
    return true;
  }).map((group) => {
    if (view === "blocked" && !group.accountId) {
      const blockedDevices = group.devices.filter((device) => device.banned_at);
      return { ...group, devices: blockedDevices, matchCount: blockedDevices.length };
    }
    if (view === "crawlers") {
      const crawlers = group.devices.filter((device) =>
        isCrawler(device) && (!queryLower || deviceMatches(device, queryLower)));
      return { ...group, devices: crawlers, matchCount: crawlers.length };
    }
    if (!queryLower) return { ...group, matchCount: group.devices.length };
    const groupMatch = [group.username, group.accountId, group.key]
      .some((value) => String(value || "").toLowerCase().includes(queryLower));
    const matchingDevices = group.devices.filter((device) => deviceMatches(device, queryLower));
    return {
      ...group,
      devices: groupMatch ? group.devices : matchingDevices,
      matchCount: groupMatch ? group.devices.length : matchingDevices.length,
    };
  }).filter((group) => group.matchCount > 0);

  const onlyResult = visible.length === 1 && Boolean(queryLower || view !== "all");
  const sections = visible.map((group) => {
    const total = group.devices.length;
    const customLabels = [...new Set(group.devices
      .filter((device) => device.label_source !== "auto" && device.label)
      .map((device) => device.label))];
    const pages = group.accountId ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const page = group.accountId ? 1 : Math.min(requestedPage, pages);
    const start = (page - 1) * pageSize;
    const devices = group.accountId ? group.devices : group.devices.slice(start, start + pageSize);
    return personSection({ ...group, devices }, {
      total,
      page,
      pages,
      pageSize,
      open: onlyResult || (!group.accountId && (view === "unclaimed" || view === "crawlers")),
      customLabels,
      query,
      view,
    });
  }).join("");

  const tabs = [
    ["all", "All", groups.length],
    ["accounts", "Accounts", accountGroups.length],
    ["unclaimed", "Unclaimed", unclaimed?.devices.length || 0],
    ["blocked", "Blocked", blockedCount],
    ["crawlers", "Crawlers", crawlerCount],
  ].map(([value, label, count]) => `<a href="${escapeHtml(adminHref(value, query))}"${view === value ? ` aria-current="page"` : ""}>${label}<span>${count}</span></a>`).join("");

  return shell("Device access", `<main class="admin">
    <header class="admin-title"><div><p class="kicker">ACCESS CONTROL</p><h1>Who is playing</h1><p class="summary-line">${accountGroups.length} accounts · ${deviceCount} devices · ${labelledCount} custom-labelled</p></div><p>${escapeHtml(email)}</p></header>
    <form class="admin-search" method="get" action="/_guard/admin">
      <input type="hidden" name="view" value="${escapeHtml(view)}">
      <label class="sr-only" for="admin-q">Search accounts and devices</label>
      <input id="admin-q" type="search" name="q" value="${escapeHtml(query)}" maxlength="80" placeholder="Search label, account, model, network or ID">
      <button type="submit">Search</button>
      ${query ? `<a href="${escapeHtml(adminHref(view))}">Clear</a>` : ""}
    </form>
    ${visitPanel(stats.visits)}
    <nav class="admin-tabs" aria-label="Device filters">${tabs}</nav>
    ${stats.truncated ? `<p class="result-line">Showing the ${loadedCount} most recently seen of ${deviceCount} devices. Search to reach older records.</p>` : ""}
    <details class="admin-help"><summary>How identification works</summary><p>Account names and admin labels are authoritative; measured hardware and network details are only hints. Visitors are never asked to name a device. A device ban applies to one signed browser profile, not to a household or network.</p></details>
    ${query ? `<p class="result-line">${visible.length} matching ${visible.length === 1 ? "group" : "groups"} for “${escapeHtml(query)}”</p>` : ""}
    <div class="people">${sections || `<p class="empty-state">No accounts or devices match this view.</p>`}</div>
  </main>`);
}

function visitPanel(visits) {
  if (!visits) return "";
  const cards = [
    ["Today so far", visits.views.today, visits.uniques.today],
    ["Last 7 days", visits.views.week, visits.uniques.week],
    ["Last 30 days", visits.views.month, visits.uniques.month],
  ].map(([label, views, uniques]) => `<div class="visit-card">
      <span class="visit-label">${label}</span>
      <strong class="visit-views">${views.toLocaleString("en-AU")}</strong>
      <span class="visit-sub">page views</span>
      <span class="visit-uniques">${uniques.toLocaleString("en-AU")} unique ${uniques === 1 ? "visitor" : "visitors"}</span>
    </div>`).join("");
  const busiest = visits.hosts.length
    ? `<div class="visit-hosts"><span class="visit-label">By site, last 30 days</span><ul>${visits.hosts.map((row) =>
        `<li><span>${escapeHtml(row.host.replace(".andrenijman.com", ""))}</span><span>${row.views.toLocaleString("en-AU")}</span></li>`).join("")}</ul></div>`
    : "";
  return `<section class="visits" aria-label="Site visits">
    <div class="visit-cards">${cards}</div>
    ${busiest}
    <p class="visit-note">Real visits only: pages served to non-crawler browsers, counted in Perth days, with the game frame counted once rather than twice. Live recording began ${VISITS_MEASURED_FROM}. Earlier days are reconstructed from each device's first and last seen times, which is why their views and unique visitors match: only two events per device survived, so those days are a floor and the true figures were higher.</p>
  </section>`;
}

function personSection(group, options) {
  const isAccount = Boolean(group.accountId);
  const title = isAccount ? group.username || `Account ${group.accountId}` : "Unclaimed devices";
  const labels = options.customLabels;
  const labelled = labels.length ? labels.slice(0, 2).join(", ") : "Automatic labels only";
  const accountControl = isAccount ? `<details class="manage account-manage"><summary>Account controls</summary>
    <div class="account-controls">
      <form method="post"><input type="hidden" name="account_id" value="${escapeHtml(group.accountId)}"><label>Account name<input name="account_name" value="${escapeHtml(group.username || "")}" autocomplete="off" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]{3,32}"></label><button name="action" value="rename-account">Save account name</button></form>
      <form method="post"><input type="hidden" name="account_id" value="${escapeHtml(group.accountId)}"><label>New password<input type="password" name="new_password" autocomplete="new-password" required minlength="12" maxlength="128"></label><label>Confirm password<input type="password" name="confirm_password" autocomplete="new-password" required minlength="12" maxlength="128"></label><button name="action" value="reset-account-password">Reset password</button></form>
      <form method="post"><input type="hidden" name="account_id" value="${escapeHtml(group.accountId)}"><label>Ban reason<input name="reason" maxlength="200" placeholder="Optional reason"></label><button class="danger" name="action" value="${group.accountBanned ? "unban-account" : "ban-account"}">${group.accountBanned ? "Unban account" : "Ban account"}</button></form>
    </div>
    <p class="password-note">Existing passwords are never available. A reset stores a new salted hash and signs the account out everywhere.</p>
  </details>` : "";
  const from = options.total ? (options.page - 1) * options.pageSize + 1 : 0;
  const to = Math.min(options.page * options.pageSize, options.total);
  const pager = options.pages > 1 ? `<nav class="pager" aria-label="Unclaimed device pages">
    ${options.page > 1 ? `<a href="${escapeHtml(adminHref(options.view, options.query, options.page - 1))}">Previous</a>` : `<span>Previous</span>`}
    <span>${from}–${to} of ${options.total}</span>
    ${options.page < options.pages ? `<a href="${escapeHtml(adminHref(options.view, options.query, options.page + 1))}">Next</a>` : `<span>Next</span>`}
  </nav>` : "";
  return `<details class="person${group.blocked ? " blocked-person" : ""}"${options.open ? " open" : ""}>
    <summary class="person-summary">
      <span class="status-dot" aria-hidden="true"></span>
      <span class="person-name">${escapeHtml(title)}${group.blocked ? `<span class="blocked-label">blocked</span>` : ""}<small>${escapeHtml(labelled)}</small></span>
      <span class="person-count">${options.total} device${options.total === 1 ? "" : "s"}</span>
      <span class="person-seen">${escapeHtml(formatAdminTime(group.lastSeen))}</span>
      <span class="disclosure" aria-hidden="true"></span>
    </summary>
    <div class="person-body">${accountControl}
      <div class="table"><table><thead><tr><th>Device</th><th>Identity</th><th>Network</th><th>Activity</th><th></th></tr></thead><tbody>${group.devices.map(deviceRow).join("")}</tbody></table></div>
      ${pager}
    </div>
  </details>`;
}

function deviceMatches(device, query) {
  const agent = classifyAgent(device.user_agent);
  return [device.id, device.label, device.model, device.gpu, device.screen, device.os,
    device.os_version, device.browser, device.browser_version, device.arch, device.asn_org,
    device.city, device.region, device.country, device.ip_prefix, device.last_game,
    device.user_agent, device.first_referrer, device.referrer,
    // So "googlebot", "adsense" or "scanner" find rows whose raw agent string
    // spells none of those, and "unverified" finds the network mismatches.
    agent.name, agent.kind, agentUnverified(device) ? "unverified" : ""]
    .some((value) => String(value || "").toLowerCase().includes(query));
}

function adminHref(view = "all", query = "", page = 1) {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/_guard/admin${suffix ? `?${suffix}` : ""}`;
}

function formatAdminTime(value) {
  if (!value) return "Never";
  const date = new Date(`${String(value).replace(" ", "T")}Z`);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Perth",
  }).format(date);
}

function deviceRow(device) {
  const badge = device.label_source === "self"
    ? `<span class="badge">legacy label</span>`
    : device.label_source === "admin"
      ? `<span class="badge">admin label</span>`
      : `<span class="badge auto">auto</span>`;
  // Derived from the same classifier the visit counter uses, so the console and
  // the counters never disagree about what a crawler is. Storing it would go
  // stale the moment CRAWLERS changes.
  const agentKind = classifyAgent(device.user_agent);
  const crawler = agentKind.bot
    ? `<span class="badge crawler" title="${escapeHtml(agentKind.kind)}">${escapeHtml(agentKind.name)}</span>${
      agentUnverified(device) ? `<span class="badge spoof" title="Says ${escapeHtml(agentKind.name)} but arrived from ${escapeHtml(device.asn_org)}, not that operator's network">unverified</span>` : ""}`
    : "";
  const hardware = [
    device.model || "",
    device.gpu || "",
    device.screen || "",
    [device.cpu_cores ? `${device.cpu_cores} cores` : "", device.device_memory ? `${device.device_memory} GB` : "",
      device.touch_points ? `${device.touch_points}-touch` : ""].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const client = [
    [device.os, device.os_version].filter(Boolean).join(" "),
    device.browser_version || device.browser,
    device.arch || "",
  ].filter(Boolean);
  const network = [
    device.asn_org || "",
    [device.city, device.region, device.country].filter(Boolean).join(", "),
    device.ip_prefix || "",
  ].filter(Boolean);
  const identity = [...hardware, ...client];
  // The raw agent string is the one field that settles what an "Other Other"
  // row actually is, so it is shown rather than left in the database.
  const agent = device.user_agent
    ? `<small class="ua" title="${escapeHtml(device.user_agent)}">${escapeHtml(device.user_agent)}</small>`
    : "";
  return `<tr class="${device.banned_at ? "blocked-row" : ""}">
    <td><strong>${escapeHtml(device.label || "Unlabelled")}</strong> ${badge}${crawler}<small title="${escapeHtml(device.id)}">#${escapeHtml(String(device.id || "").slice(0, 8))}</small>${device.ban_reason ? `<small class="ban-reason">${escapeHtml(device.ban_reason)}</small>` : ""}</td>
    <td>${cell(identity, "Not reported yet")}${agent}</td>
    <td>${cell(network, "Unknown")}</td>
    <td>${escapeHtml(String(device.last_game || "").replace(".andrenijman.com", "")) || "&mdash;"}<small>${escapeHtml(formatAdminTime(device.last_seen_at))}</small><small>Since ${escapeHtml(formatAdminTime(device.first_seen_at))}</small>${referrerLine(device)}</td>
    <td><details class="manage device-manage"><summary>Manage</summary><form method="post"><input type="hidden" name="id" value="${escapeHtml(device.id)}"><label>Admin label<input name="device_label" value="${escapeHtml(device.label || "")}" required minlength="2" maxlength="80"></label><button name="action" value="label-device">Save label</button></form><form method="post"><input type="hidden" name="id" value="${escapeHtml(device.id)}"><label>Ban reason<input name="reason" maxlength="200" placeholder="Optional reason"></label><button class="danger" name="action" value="${device.banned_at ? "unban-device" : "ban-device"}">${device.banned_at ? "Unban" : "Ban"}</button></form></details></td>
  </tr>`;
}

function cell(parts, empty) {
  if (!parts.length) return `<span class="muted">${escapeHtml(empty)}</span>`;
  const [first, ...rest] = parts;
  return `${escapeHtml(first)}${rest.map((part) => `<small>${escapeHtml(part)}</small>`).join("")}`;
}

// Nothing is rendered when no referrer was recorded. An empty column would read
// as "arrived directly", but it also covers a device first seen before the
// referrer columns existed, and those two cannot be told apart.
function referrerLine(device) {
  if (!device.first_referrer) return "";
  const moved = device.referrer && device.referrer !== device.first_referrer;
  const title = moved
    ? `First: ${device.first_referrer} · Latest: ${device.referrer}`
    : device.first_referrer;
  return `<small title="${escapeHtml(title)}">via ${escapeHtml(referrerHost(device.first_referrer))}${moved ? ` → ${escapeHtml(referrerHost(device.referrer))}` : ""}</small>`;
}

function referrerHost(value) {
  try { return new URL(value).host; } catch { return String(value || "").slice(0, 60); }
}

function privacyPage() {
  return shell("Privacy", `<main class="auth privacy"><p class="kicker">PRIVACY</p><h1>Site data</h1>
    <p>You can use the site without naming your device or creating an account. The site records an automatically generated internal device label, an optional account, a random signed browser identifier, and the games you visit with first and last visit times. Older records may retain a device label supplied before device naming was removed.</p>
    <p>It also records what your browser reports about itself: browser and operating-system family and version, processor architecture, device model on Android, screen size and pixel ratio, processor core count, rough memory size, touch support, time zone, and languages, plus the graphics adapter name your browser exposes to web pages.</p>
    <p>From the network connection it records a partial IP network, country, city, region, and the network operator name. If you arrived from another website it records the address that site's browser sent, for your first arrival and for the most recent one. Browsers send only the site's address and not the page within it, and moving between pages of this site is never recorded as a referral. Signed-in players may also store supported game progress and named world saves in their account.</p>
    <p>ONE WORLD uses your account username as your in-world name. When you join its shared world, the site creates a short-lived signed ticket containing that username and sends it to the private game relay. The shared world stores normal game data such as your inventory, location, builds, and chat in its persistent world files.</p>
    <p>None of this is a hardware serial number or a permanent identifier: it describes the browser and its device class so the site owner can tell one player apart from another and block abuse. It is not sold or shared. Ask the site owner to inspect or delete your record.</p>
    <h2>Advertising</h2>
    <p>The hub index page at games.andrenijman.com shows advertising supplied by Google AdSense. The games themselves carry no advertising. Google and its partners may set or read cookies on the hub page and use them, together with your IP address, to serve and measure ads. Google may use advertising cookies to serve ads based on your prior visits to this or other websites.</p>
    <p>You can opt out of personalised advertising in <a href="https://adssettings.google.com">Google Ads settings</a>, and review how Google uses data from sites that use its services at <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>. Visitors in the European Economic Area, the United Kingdom and Switzerland are asked for consent before any personalised advertising cookie is set.</p>
    <a class="alternate" href="/_guard/login">Return to the games</a></main>`);
}

function htmlPage(title, message, status = 200) {
  return shell(title, `<main class="auth"><p class="kicker">GAMES / ACCESS</p><h1>${escapeHtml(title)}</h1><p>${message}</p></main>`, status);
}

function shell(title, content, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Andre Nijman</title><style>${CSS}</style></head><body>${content}</body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Accept-CH": ACCEPT_CH,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// These three hosts ship no robots.txt of their own, so Cloudflare answers with
// its managed default: no rules, and no sitemap pointer either. The other eight
// serve real files from their own repositories and are deliberately NOT handled
// here — shadowing them would silently override a file edited elsewhere, and
// topout's `Disallow: /server/` would be the first casualty.
const GENERATED_CRAWLER_FILES = new Set([
  "wildbound.andrenijman.com",
  "tung.andrenijman.com",
  MC_HOST,
]);

function crawlerFileResponse(url) {
  if (url.hostname === HUB_HOST && url.pathname === "/llms.txt") return llmsTxt();
  if (!GENERATED_CRAWLER_FILES.has(url.hostname)) return null;
  if (url.pathname === "/robots.txt") return robotsTxt(url.hostname);
  if (url.pathname === "/sitemap.xml") return sitemapXml(url.hostname);
  return null;
}

function crawlerText(body, type) {
  return new Response(body, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// search=yes and ai-input=yes are the two signals that matter for being found
// and being cited: ai-input is what governs retrieval and grounding for
// generative answers. ai-train is a separate rights question that affects
// neither, so it is deliberately left unspecified, which under the content
// signals spec grants and restricts nothing.
function robotsTxt(host) {
  return crawlerText(`User-agent: *
Content-Signal: search=yes, ai-input=yes
Allow: /

Sitemap: https://${host}/sitemap.xml
`, "text/plain");
}

// No lastmod: an invented date is worse than none, and the game repositories do
// not report one through this path.
function sitemapXml(host) {
  return crawlerText(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${host}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`, "application/xml");
}

// An assistant reading this should be able to answer "what is on this site and
// who made it" without executing the games. The origin split is stated because
// it is the fact most likely to be got wrong: one of these is a curated
// open-source client, not written here, and calling it Andre's work would be
// inaccurate. Everything else on the site is his.
function llmsTxt() {
  const section = (origin) => Object.entries(GAMES)
    .filter(([, game]) => game.origin === origin)
    .map(([host, game]) => `- [${game.name}](https://${host}/): ${game.description} Genres: ${game.genre.join(", ")}.`)
    .join("\n");
  return crawlerText(`# Games by Andre Nijman

> Free browser games at ${HUB_ORIGIN}. Every game runs in the browser with
> nothing to download and no payment. Each game lives on its own subdomain.

## Original games made by Andre Nijman

${section("original")}

## Curated open-source client

${section("curated")}

## Notes

- Author of the original games: Andre Nijman, ${"https://andrenijman.com/"}
- All games are free and require no account, except ONE WORLD, which uses a
  site account as the in-world player name.
- Canonical hub page: ${HUB_ORIGIN}/
`, "text/plain");
}

// Embeds JSON-LD safely: the only sequence that can break out of a script
// element is "</", so escaping "<" is sufficient and keeps the JSON valid.
function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// Attribution follows GAMES.origin. The curated client is upstream open source,
// so its page credits curation rather than authorship and its structured data
// names the upstream projects in isBasedOn. Claiming authorship would be false.
function gameCredit(game) {
  if (game.origin === "curated") return "open-source client curated by Andre Nijman";
  return game.credit ? `game made by Andre Nijman, ${game.credit}` : "game made by Andre Nijman";
}

function gameStructuredData(url, game) {
  const origin = `https://${url.hostname}/`;
  const entity = {
    "@type": "VideoGame",
    name: game.name,
    url: origin,
    description: game.description,
    genre: game.genre,
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any browser",
    isAccessibleForFree: true,
    inLanguage: "en",
    image: {
      "@type": "ImageObject",
      url: `${HUB_ORIGIN}/${game.image}`,
      width: game.imageWidth,
      height: game.imageHeight,
    },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
  };
  if (game.origin !== "hosted") {
    // Same @id as the Person node on the hub, so all eleven hostnames resolve
    // to one author entity rather than eleven unrelated ones.
    entity.author = {
      "@type": "Person",
      "@id": "https://andrenijman.com/#person",
      name: "Andre Nijman",
      url: "https://andrenijman.com/",
    };
  }
  if (game.credit) entity.creditText = game.credit;
  return [entity, {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Games", item: `${HUB_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: game.name, item: origin },
    ],
  }, {
    "@type": "FAQPage",
    mainEntity: gameFaq(game).map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  }].map((node) => Object.assign({ "@context": "https://schema.org" }, node));
}

// Every other game, not a rotating sample of three. Ten hostnames each build
// authority from zero and every link between them is cross-domain, so a full
// mesh is the cheapest way to stop that being wasted.
function otherGames(hostname) {
  const pick = (origin) => Object.entries(GAMES)
    .filter(([host, game]) => host !== hostname && game.origin === origin)
    .map(([host, game]) => ({ host, name: game.name }));
  return [
    { heading: "More games made by Andre Nijman", games: pick("original").concat(pick("curated")) },
  ].filter((group) => group.games.length);
}

// Every answer restates a fact already on the hub — free to play, runs in the
// browser, who made it, whether it is multiplayer. Nothing about controls or
// gameplay is asserted, because that would mean inventing detail no source
// here confirms. Questions are the ones an assistant is actually asked, and
// authorship is the one it is most likely to get wrong.
function gameFaq(game) {
  const entries = [
    [`Is ${game.name} free to play?`,
      `Yes. ${game.name} is free to play in a web browser with nothing to pay.`],
    [`Do I need to download or install ${game.name}?`,
      `No. ${game.name} runs in the browser, so there is nothing to download.`],
  ];
  entries.push([`Do I need an account to play ${game.name}?`,
    game.requiresAccount
      ? `Yes. ${game.name} uses a games.andrenijman.com account, because the account username is your name inside the shared world.`
      : `No. ${game.name} can be played without creating an account.`]);
  if (game.genre.includes("Multiplayer")) {
    entries.push([`Does ${game.name} have multiplayer?`,
      `Yes. ${game.name} supports online multiplayer.`]);
  }
  entries.push([`Who made ${game.name}?`, gameAuthorAnswer(game)]);
  return entries.map(([question, answer]) => ({ question, answer }));
}

function gameAuthorAnswer(game) {
  if (game.origin === "curated") {
    return `${game.name} is an open-source client curated and hosted by Andre Nijman.`;
  }
  return game.credit
    ? `${game.name} was made by Andre Nijman, ${game.credit}.`
    : `${game.name} was made by Andre Nijman.`;
}

function gameFramePage(url, game) {
  const gameUrl = new URL(url);
  gameUrl.searchParams.set("_games_frame", "1");
  const safeTitle = escapeHtml(game.name);
  const canonical = `https://${url.hostname}/`;
  const genreLine = game.genre.join(" · ");
  // Kept under ~160 characters so search results show it whole.
  const summary = game.description.length > 158
    ? `${game.description.slice(0, 155).replace(/[\s,;:]+\S*$/, "")}…`
    : game.description;
  const pageTitle = `${game.name} · free browser ${game.genre[0] ? game.genre[0].toLowerCase() : "game"} game`;
  const image = `${HUB_ORIGIN}/${game.image}`;
  // Only the root path is the game. Every other path on the host used to return
  // this same page with a 200, which is an unbounded supply of duplicate URLs
  // for a crawler and a broken game for a visitor, because the iframe then
  // points at a subpath upstream does not have. Those paths stay out of the
  // index, and carry no canonical: noindex already settles where they belong,
  // and pairing the two sends a crawler contradictory instructions.
  const isRoot = url.pathname === "/" || url.pathname === "/index.html";
  const indexing = isRoot
    ? `<link rel="canonical" href="${escapeHtml(canonical)}">`
    : `<meta name="robots" content="noindex,follow">`;
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#141110">
  <title>${escapeHtml(pageTitle)} | Andre Nijman</title>
  <meta name="description" content="${escapeHtml(summary)}">
  ${indexing}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Games by Andre Nijman">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(summary)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="${game.imageWidth}">
  <meta property="og:image:height" content="${game.imageHeight}">
  <meta property="og:image:alt" content="${escapeHtml(`${game.name} gameplay`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(summary)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${gameStructuredData(url, game).map(jsonLd).join("</script>\n  <script type=\"application/ld+json\">")}</script>
  <style>
    :root{color-scheme:dark;--paper:#141110;--panel:#201c18;--ink:#f0ece3;--muted:#9c9282;--accent:#55a37c;--line:rgba(240,236,227,.2);font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,monospace}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    html,body{width:100%;margin:0;background:var(--paper);color:var(--ink);overscroll-behavior-y:contain}
    .game-shell{height:100dvh;display:grid;grid-template-rows:36px minmax(0,1fr) 30px;padding:8px}
    .game-chrome{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:16px;padding:0 4px;color:var(--muted);font-size:11px;letter-spacing:.04em;white-space:nowrap}
    .game-chrome a{display:flex;align-items:center;height:100%;color:inherit;text-decoration:none;transition:color 140ms ease-out}
    .game-chrome a:first-child{justify-self:start;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .game-chrome a:last-child{justify-self:end;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .game-chrome a:hover,.game-chrome a:focus-visible{color:var(--accent)}
    .game-chrome a:focus-visible{outline:1px solid var(--accent);outline-offset:-2px}
    .game-window{min-width:0;min-height:0;border:1px solid var(--line);background:#080907;box-shadow:0 18px 48px rgba(0,0,0,.32);overflow:hidden}
    .game-window iframe{display:block;width:100%;height:100%;border:0;background:#080907}
    .game-title{display:flex;align-items:end;justify-content:center;padding-top:6px;margin:0;color:var(--ink);font:500 15px/1 Georgia,"Times New Roman",serif;letter-spacing:.01em}
    .game-about{max-width:720px;margin:0 auto;padding:56px 20px 72px;border-top:1px solid var(--line)}
    .game-about h2{margin:0 0 4px;font:500 22px/1.2 Georgia,"Times New Roman",serif}
    .game-about .genre{margin:0 0 20px;color:var(--accent);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
    .game-about p{margin:0 0 20px;color:var(--ink);font-size:14px;line-height:1.65}
    .game-about .credit{color:var(--muted);font-size:12px}
    .game-about h3{margin:32px 0 10px;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
    .faq{margin:0}
    .faq dt{margin:16px 0 5px;color:var(--ink);font-size:13px;font-weight:400}
    .faq dd{margin:0;color:var(--muted);font-size:13px;line-height:1.6}
    .game-about ul{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:10px}
    .game-about li a{display:inline-block;padding:7px 12px;border:1px solid var(--line);color:var(--ink);font-size:12px;text-decoration:none}
    .game-about li a:hover,.game-about li a:focus-visible{border-color:var(--accent);color:var(--accent)}
    @media(max-width:640px){.game-shell{grid-template-rows:32px minmax(0,1fr) 26px;padding:4px}.game-chrome{font-size:9px;padding:0 2px}.game-title{font-size:13px;padding-top:5px}.game-about{padding:40px 16px 56px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style>
</head>
<body>
  <main class="game-shell">
    <header class="game-chrome">
      <a href="https://andrenijman.com" aria-label="Visit Andre Nijman's portfolio">${escapeHtml(gameCredit(game))}</a>
      <a href="#about">about ${safeTitle} &darr;</a>
      <a href="${HUB_ORIGIN}" aria-label="Back to all games">games.andrenijman.com &uarr;</a>
    </header>
    <div class="game-window">
      <iframe src="${escapeHtml(gameUrl.toString())}" title="${safeTitle}" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe>
    </div>
    <h1 class="game-title">${safeTitle}</h1>
  </main>
  <section class="game-about" id="about">
    <h2>About ${safeTitle}</h2>
    <p class="genre">${escapeHtml(genreLine)}</p>
    <p>${escapeHtml(game.description)}</p>
    <p class="credit">Free to play in the browser, nothing to download. ${escapeHtml(gameCredit(game).replace(/^./, (c) => c.toUpperCase()))}.</p>
    <h3>Questions</h3>
    <dl class="faq">${gameFaq(game).map(({ question, answer }) =>
      `<dt>${escapeHtml(question)}</dt><dd>${escapeHtml(answer)}</dd>`).join("")}</dl>
    ${otherGames(url.hostname).map((group) => `<h3>${escapeHtml(group.heading)}</h3>
    <ul>${group.games.map((other) =>
      `<li><a href="https://${other.host}/">${escapeHtml(other.name)}</a></li>`).join("")}</ul>`).join("\n    ")}
  </section>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      // script-src is stated rather than inherited from default-src to make the
      // intent unambiguous: this page carries no executable script. The JSON-LD
      // blocks are data, not script — a script element whose type is not a
      // JavaScript MIME type is never prepared for execution, so it is not
      // subject to script-src. Worth confirming once in devtools.
      "Content-Security-Policy": "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; img-src https://games.andrenijman.com; base-uri 'none'; frame-ancestors 'self'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "Accept-CH": ACCEPT_CH,
      "X-Games-Guard": "framed",
    },
  });
}

const CLIENT_JS = `(function () {
  function deny() {
    var accessUrl = 'https://games.andrenijman.com/_guard/login?return=' + encodeURIComponent(location.href);
    document.documentElement.innerHTML = '<head><title>Access required</title></head><body style="font:16px monospace;padding:2rem;background:#10110f;color:#eee">Online access check failed or access is blocked. <a target="_top" style="color:#d1b24b" href="' + accessUrl + '">Sign in</a></body>';
    window.stop();
  }

  function activate(result) {
    window.__gamesGuardStatus = result;
    if (!result || result.allowed !== true) {
      deny();
      return;
    }

    if (result.needsProfile) {
      try {
        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        var renderer = '';
        if (gl) {
          var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          renderer = String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
        }
        fetch('/_guard/device-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            gpu: renderer,
            screen: screen.width + 'x' + screen.height + '@' + (Math.round((window.devicePixelRatio || 1) * 100) / 100),
            cores: navigator.hardwareConcurrency || 0,
            memory: navigator.deviceMemory || 0,
            touch: navigator.maxTouchPoints || 0,
            timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
            languages: (navigator.languages || [navigator.language || '']).slice(0, 3).join(',')
          })
        }).catch(function () {});
      } catch (error) {}
    }

    if ('serviceWorker' in navigator) {
      var hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        return Promise.all(registrations.map(function (registration) { return registration.unregister(); }));
      }).then(function () {
        if (hadController && !sessionStorage.getItem('games-sw-retired')) {
          sessionStorage.setItem('games-sw-retired', '1');
          location.reload();
        }
      }).catch(function () {});
    }

    var versionMeta = document.querySelector('meta[name="games-content-version"]');
    var currentVersion = versionMeta ? versionMeta.content : '';
    function checkForUpdate() {
      if (document.hidden || !currentVersion) return;
      fetch('/_guard/version?path=' + encodeURIComponent(location.pathname + location.search), { cache: 'no-store' })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (data) {
          if (data && data.version && data.version !== currentVersion) location.reload();
        }).catch(function () {});
    }
    setInterval(checkForUpdate, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkForUpdate(); });
  }

  var statusMeta = document.querySelector('meta[name="games-guard-status"]');
  if (statusMeta) {
    try {
      activate(JSON.parse(statusMeta.content));
      return;
    } catch (error) {}
  }
  fetch('/_guard/status', { cache: 'no-store', credentials: 'same-origin' })
    .then(function (response) { return response.json(); })
    .then(activate)
    .catch(function () { deny(null); });
}());`;

const RETIRED_SERVICE_WORKER = `self.addEventListener('install', function () { self.skipWaiting(); }); self.addEventListener('activate', function (event) { event.waitUntil(Promise.all([caches.keys().then(function (keys) { return Promise.all(keys.map(function (key) { return caches.delete(key); })); }), self.registration.unregister(), self.clients.claim()])); }); self.addEventListener('fetch', function (event) { event.respondWith(fetch(event.request)); });`;

const CSS = `
:root{--bg:#10110f;--surface:#181a17;--text:#ebe9df;--muted:#9b9d94;--line:#35382f;--accent:#d1b24b;--danger:#c76155;--info:#8fb4d9;--s1:4px;--s2:8px;--s3:16px;--s4:24px;--s5:32px;--s6:48px;font-family:Arial,sans-serif;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}a{color:var(--accent)}h1{font:400 clamp(2.2rem,6vw,4.5rem)/.95 Georgia,serif;letter-spacing:-.04em;margin:var(--s2) 0 var(--s4)}p{line-height:1.6;color:var(--muted)}.kicker,th,small,button,label{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.kicker{font-size:.72rem;letter-spacing:.14em;color:var(--accent)}.account-purpose{margin:0 0 var(--s5)}.auth{width:min(100% - 40px,480px);margin:8vh auto}.auth form{display:grid;gap:var(--s3)}label{display:grid;gap:var(--s2);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase}input{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font:inherit}button{min-height:44px;padding:10px 16px;border:1px solid var(--line);border-radius:4px;background:var(--accent);color:var(--bg);cursor:pointer}button:hover{filter:brightness(1.08)}.alternate{display:inline-block;margin-top:var(--s4)}.choice{display:flex;align-items:center;gap:var(--s3);margin:var(--s4) 0;color:var(--muted);font:12px ui-monospace,SFMono-Regular,Consolas,monospace;text-transform:uppercase}.choice:before,.choice:after{content:"";height:1px;background:var(--line);flex:1}.skip-button{display:flex;min-height:56px;align-items:center;justify-content:center;padding:10px 16px;border-radius:4px;background:var(--text);color:var(--bg);font:1rem ui-monospace,SFMono-Regular,Consolas,monospace;text-decoration:none}.skip-button:hover{filter:brightness(1.08)}.fine{font-size:.78rem;margin-top:var(--s4)}.error,.notice{padding:var(--s3);border-left:3px solid var(--danger);background:var(--surface);color:var(--text)}.privacy{max-width:640px}.admin{width:min(100% - 40px,1500px);margin:var(--s6) auto}.admin header{display:flex;justify-content:space-between;align-items:start;gap:var(--s4)}.admin h1{margin-bottom:var(--s3)}.summary-line{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;letter-spacing:.04em}.person{margin-top:var(--s6);border-top:1px solid var(--line);padding-top:var(--s3)}.person>header{align-items:baseline;flex-wrap:wrap;gap:var(--s3)}.person h2{font:400 1.5rem/1.1 Georgia,serif;margin:0}.person h2.anon{color:var(--muted)}.person .summary{flex:1;margin:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.72rem;letter-spacing:.03em}.person>header form{display:flex;gap:var(--s2)}.person>header input{width:auto;min-width:150px}.person>header button{min-height:36px;padding:6px 10px;white-space:nowrap}.person .table{margin-top:var(--s3)}.blocked-person h2{color:var(--danger)}.badge{display:inline-block;padding:2px 7px;border:1px solid var(--accent);border-radius:999px;color:var(--accent);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;vertical-align:middle}.badge.auto{border-color:var(--line);color:var(--muted)}.muted{color:var(--muted)}.table{overflow:auto;border-top:1px solid var(--line);margin-top:var(--s5)}table{width:100%;border-collapse:collapse;min-width:1050px}th,td{text-align:left;padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.7rem;letter-spacing:.1em;color:var(--muted)}td{font-size:.88rem}small{display:block;color:var(--muted);font-size:.68rem;margin-top:var(--s1)}td form{display:grid;gap:var(--s2)}.actions{display:flex;gap:var(--s2)}.actions button{min-height:36px;padding:6px 10px}.danger{background:transparent;color:var(--danger);border-color:var(--danger)}tr.blocked-row{background:#281b18}@media(max-width:600px){.admin header{display:block}.auth{margin-top:var(--s5)}.actions{flex-wrap:wrap}}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}.admin{width:min(100% - 32px,1440px);margin:32px auto}.admin-title{align-items:start}.admin-title h1{font-size:clamp(2rem,4vw,3.5rem);margin:4px 0 8px}.admin-title>p{margin:4px 0;font:11px ui-monospace,SFMono-Regular,Consolas,monospace}.summary-line{margin:0}.admin-search{display:grid;grid-template-columns:minmax(220px,620px) max-content max-content;gap:8px;align-items:center;margin:24px 0 12px}.admin-search input{min-height:44px;padding:8px 12px}.admin-search button{min-height:44px;padding:8px 16px}.admin-search a{padding:8px;color:var(--muted);font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.admin-tabs{display:flex;gap:0;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:none}.admin-tabs::-webkit-scrollbar{display:none}.admin-tabs a{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border-bottom:2px solid transparent;color:var(--muted);font:11px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em;text-decoration:none;text-transform:uppercase;white-space:nowrap}.admin-tabs a:hover,.admin-tabs a:focus-visible{color:var(--text)}.admin-tabs a[aria-current="page"]{color:var(--accent);border-bottom-color:var(--accent)}.admin-tabs span{color:inherit;opacity:.7}.admin-help{margin:8px 0 0;color:var(--muted);font-size:.78rem}.admin-help summary{width:max-content;min-height:44px;padding:13px 0;cursor:pointer;font:11px ui-monospace,SFMono-Regular,Consolas,monospace}.admin-help p{max-width:900px;margin:0 0 12px;font-size:.78rem}.result-line,.empty-state{margin:16px 0;font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.people{margin-top:8px;border-top:1px solid var(--line)}.person{margin:0;padding:0;border:0;border-bottom:1px solid var(--line)}.person-summary{display:grid;grid-template-columns:8px minmax(170px,1fr) 84px 130px 12px;gap:12px;align-items:center;min-height:48px;padding:7px 12px;cursor:pointer;list-style:none}.person-summary::-webkit-details-marker{display:none}.person-summary:hover{background:var(--surface)}.person-summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.status-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}.blocked-person .status-dot{background:var(--danger)}.person-name{min-width:0;font:15px/1.2 Georgia,serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.blocked-label{display:inline;margin-left:7px;color:var(--danger);font:9px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}.person-name small{display:inline;margin:0 0 0 9px;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.person-count,.person-seen{color:var(--muted);font:10px ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right;white-space:nowrap}.disclosure{width:7px;height:7px;border-right:1px solid var(--muted);border-bottom:1px solid var(--muted);transform:rotate(45deg) translate(-2px,-2px);transition:transform 140ms ease-out}.person[open]>.person-summary .disclosure{transform:rotate(225deg) translate(-1px,-1px)}.person-body{padding:0 12px 12px;background:rgba(255,255,255,.012)}.person .table{margin:0;border-top:1px solid var(--line)}.person table{min-width:940px}.person th,.person td{padding:8px 10px}.person th{font-size:.62rem}.person td{font-size:.78rem}.person td:first-child{width:24%}.person td:nth-child(2){width:27%}.person td:nth-child(3){width:21%}.person td:nth-child(4){width:16%}.person td:last-child{width:12%}.person small{font-size:.62rem;margin-top:2px}.badge{padding:1px 5px;font-size:.52rem}.badge.crawler{border-color:var(--info);color:var(--info)}.badge.spoof{border-color:var(--danger);color:var(--danger)}.ua{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:1.35;opacity:.85}.ban-reason{color:var(--danger)}.manage{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.manage>summary{width:max-content;min-height:44px;padding:14px 0;color:var(--muted);font-size:.68rem;cursor:pointer}.manage[open]>summary{color:var(--accent)}.manage form{min-width:190px;padding:8px 0}.manage label{gap:4px;font-size:.62rem}.manage input{min-height:44px;padding:7px 9px;font-size:.78rem}.actions{margin-top:6px}.actions button,.account-manage button{min-height:44px;padding:8px 10px;font-size:.68rem}.account-manage{margin-left:auto;padding:8px 0}.account-manage form{display:grid;grid-template-columns:minmax(180px,300px) auto;align-items:end;gap:8px}.pager{display:flex;justify-content:flex-end;align-items:center;gap:14px;padding:10px 0 0;color:var(--muted);font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.pager a{color:var(--accent)}.blocked-row{box-shadow:inset 2px 0 var(--danger)}@media(prefers-reduced-motion:reduce){.disclosure{transition:none}}@media(max-width:700px){.admin{width:min(100% - 24px,1440px);margin:20px auto}.admin-title{display:block}.admin-title>p{margin-top:8px}.admin-search{grid-template-columns:1fr auto}.admin-search a{grid-column:1/-1;padding:0}.person-summary{grid-template-columns:8px minmax(0,1fr) 68px 12px;gap:8px;padding:7px 8px}.person-seen{display:none}.person-name small{display:block;margin:2px 0 0;overflow:hidden;text-overflow:ellipsis}.person-body{padding:0 8px 8px}.person .table{overflow:visible}.person table,.person tbody,.person tr,.person td{display:block;min-width:0}.person thead{display:none}.person tr{padding:8px 0;border-bottom:1px solid var(--line)}.person td{width:auto!important;padding:3px 4px;border:0}.person td:before{display:block;margin-bottom:2px;color:var(--muted);font:9px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}.person td:nth-child(1):before{content:"Device"}.person td:nth-child(2):before{content:"Identity"}.person td:nth-child(3):before{content:"Network"}.person td:nth-child(4):before{content:"Activity"}.person td:nth-child(5):before{content:"Controls"}.account-manage form{grid-template-columns:1fr}.pager{justify-content:space-between}}
.device-manage form+form{border-top:1px solid var(--line)}
.visits{margin:20px 0 4px;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.visit-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:var(--line)}
.visit-card{display:grid;gap:2px;padding:14px 16px;background:var(--bg)}
.visit-label{color:var(--muted);font:10px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase}
.visit-views{font:400 2rem/1 Georgia,serif;color:var(--text);letter-spacing:-.02em}
.visit-sub{color:var(--muted);font:10px ui-monospace,SFMono-Regular,Consolas,monospace}
.visit-uniques{margin-top:4px;color:var(--accent);font:11px ui-monospace,SFMono-Regular,Consolas,monospace}
.visit-hosts{margin-top:16px}
.visit-hosts ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0 24px;margin:8px 0 0;padding:0;list-style:none}
.visit-hosts li{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--line);font:11px ui-monospace,SFMono-Regular,Consolas,monospace}
.visit-hosts li span:last-child{color:var(--accent)}
.visit-note{margin:14px 0 0;color:var(--muted);font-size:.7rem;line-height:1.5}
.account-controls{display:grid;grid-template-columns:minmax(180px,1fr) minmax(260px,1.5fr) minmax(180px,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.account-controls form{display:grid;grid-template-columns:1fr;align-content:start;gap:8px;padding:12px 16px 12px 0}
.account-controls form+form{padding-left:16px;border-left:1px solid var(--line)}
.password-note{margin:8px 0 0;font-size:.72rem}
@media(max-width:700px){.account-controls{grid-template-columns:1fr}.account-controls form{padding:12px 0}.account-controls form+form{padding-left:0;border-top:1px solid var(--line);border-left:0}}
`;
