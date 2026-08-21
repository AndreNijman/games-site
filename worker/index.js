const DEVICE_COOKIE = "games_device";
const SESSION_COOKIE = "games_session";
const GUEST_COOKIE = "games_guest";
const COOKIE_DOMAIN = ".andrenijman.com";
const SESSION_DAYS = 30;
const NAME_PROMPT_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const ACCEPT_CH = "Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Arch, Sec-CH-UA-Bitness";
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
]);
const TUNG_ADMINS = new Set(["andrenijman", "mechtical", "pojodragon365"]);
const GAME_TITLES = {
  "topout.andrenijman.com": "TOPOUT",
  "defenders.andrenijman.com": "Garden Defenders 2",
  "overpop.andrenijman.com": "OVERPOP",
  "wildbound.andrenijman.com": "Wildbound.io",
  "tree.andrenijman.com": "tree",
  "tung.andrenijman.com": "Tung Tung Tung Sahorror",
  "isaac.andrenijman.com": "ISUCK",
  "bop.andrenijman.com": "BOP",
};

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(error);
      return htmlPage("Service unavailable", "The access service could not complete this request.", 503);
    }
  },
};

async function handleRequest(request, env) {
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

  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  if (!identity.account && !identity.guest) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return withCookies(new Response("Sign in required", { status: 401 }), identity.cookies);
    }
    const login = new URL("https://games.andrenijman.com/_guard/login");
    login.searchParams.set("return", safeReturn(url.toString()));
    return withCookies(Response.redirect(login, 302), identity.cookies);
  }

  if (GAME_TITLES[url.hostname] && request.method === "GET" &&
      request.headers.get("Accept")?.includes("text/html") && !url.searchParams.has("_games_frame")) {
    return withCookies(gameFramePage(url, GAME_TITLES[url.hostname]), identity.cookies);
  }

  const upstream = await fetchFreshUpstream(request);
  const response = new Response(upstream.body, upstream);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Games-Guard", "active");
  response.headers.set("Accept-CH", ACCEPT_CH);
  const contentVersion = upstream.headers.get("ETag") || upstream.headers.get("Last-Modified") || "";
  const isHtml = response.headers.get("Content-Type")?.includes("text/html");
  if (isHtml) response.headers.set("Clear-Site-Data", '"cache"');
  const guarded = isHtml
    ? new HTMLRewriter().on("head", {
      element(element) {
        element.prepend(`<meta name="games-content-version" content="${escapeHtml(contentVersion)}"><script src="/_guard/client.js"></script>`, { html: true });
      },
    }).transform(response)
    : response;
  return withCookies(guarded, identity.cookies);
}

async function handleGuardRoute(request, env, url) {
  if (url.pathname === "/_guard/health") return Response.json({ ok: true });
  if (url.pathname === "/_guard/privacy") return privacyPage();
  if (url.pathname === "/_guard/client.js") {
    return new Response(CLIENT_JS, {
      headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (url.pathname === "/_guard/version") return contentVersion(request, url);
  if (url.pathname === "/_guard/tung-lobbies") return tungLobbies(request, env, url);
  if (url.pathname === "/_guard/tung-ws") return tungSocket(request, env, url);
  if (url.pathname === "/_guard/bop-lobbies") return bopLobbies(request, env, url);
  if (url.pathname.startsWith("/_guard/admin")) return handleAdmin(request, env, url);
  if (url.pathname === "/_guard/skip") return skipAccount(request, env, url);
  if (url.pathname === "/_guard/device-name") return deviceName(request, env, url);
  if (url.pathname === "/_guard/device-profile") return deviceProfile(request, env, url);
  if (url.pathname === "/_guard/logout") return logout(request, env);
  if (url.pathname === "/_guard/login") return login(request, env, url);
  if (url.pathname === "/_guard/register") return register(request, env, url);
  if (url.pathname === "/_guard/profile") return gameProfile(request, env, url);
  if (url.pathname === "/_guard/saves" || url.pathname === "/_guard/save") return gameSaves(request, env, url);
  if (url.pathname === "/_guard/status") {
    const identity = await identify(request, env, url.hostname);
    const allowed = !identity.blocked && Boolean(identity.account || identity.guest);
    const response = Response.json({
      allowed,
      signedIn: Boolean(identity.account),
      username: identity.account?.username || null,
      deviceName: identity.device?.label_source === "auto" ? null : identity.device?.label || null,
      needsName: allowed && needsName(identity.device),
      needsProfile: allowed && needsProfile(identity.device),
      reason: identity.blocked ? identity.reason : undefined,
    }, { status: identity.blocked ? 403 : identity.account || identity.guest ? 200 : 401 });
    response.headers.set("Cache-Control", "no-store");
    return withCookies(response, identity.cookies);
  }
  return new Response("Not found", { status: 404 });
}

function freshUpstreamRequest(request, path) {
  const source = new URL(request.url);
  const target = path ? new URL(path, `https://${source.hostname}`) : new URL(source);
  target.searchParams.set("__games_fresh", String(Date.now()));
  const headers = new Headers(request.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  headers.set("Cache-Control", "no-cache");
  return new Request(target, {
    method: path ? "HEAD" : request.method,
    headers,
    body: path || request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });
}

function fetchFreshUpstream(request, path) {
  return fetch(freshUpstreamRequest(request, path), {
    cf: { resolveOverride: "andrenijman.github.io", cacheTtl: 0 },
  });
}

async function contentVersion(request, url) {
  let path = url.searchParams.get("path") || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/_guard/")) path = "/";
  const upstream = await fetchFreshUpstream(request, path);
  const version = upstream.headers.get("ETag") || upstream.headers.get("Last-Modified") || "";
  return Response.json({ version }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

// Same-origin proxy for the BOP lobby directory. The relay lives on a
// workers.dev hostname, so fetching it straight from the game page would be a
// cross-origin request that the guard's session cookie never reaches.
async function bopLobbies(request, env, url) {
  if (url.hostname !== "bop.andrenijman.com" || request.method !== "GET") {
    return new Response("Not found", { status: 404 });
  }
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  if (!identity.account && !identity.guest) {
    return withCookies(Response.json({ error: "access required" }, { status: 401 }), identity.cookies);
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

async function tungLobbies(request, env, url) {
  if (url.hostname !== "tung.andrenijman.com" || request.method !== "GET") {
    return new Response("Not found", { status: 404 });
  }
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  if (!identity.account && !identity.guest) {
    return withCookies(Response.json({ error: "access required" }, { status: 401 }), identity.cookies);
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

async function tungSocket(request, env, url) {
  if (url.hostname !== "tung.andrenijman.com" || request.method !== "GET" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  if (!identity.account && !identity.guest) return new Response("Access required", { status: 401 });

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

async function gameProfile(request, env, url) {
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
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

async function gameSaves(request, env, url) {
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
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
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const responseCookies = [];
  let deviceId = await verifyDeviceCookie(cookies[DEVICE_COOKIE], env.COOKIE_SECRET);
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
  await env.DB.prepare(`
    INSERT INTO devices (
      id, account_id, label, user_agent, browser, browser_version, os, os_version,
      model, arch, ip_prefix, country, city, region, asn_org, last_game
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      last_seen_at = CURRENT_TIMESTAMP
  `).bind(deviceId, account?.id || null, defaultDeviceLabel(metadata, deviceId), metadata.userAgent,
    metadata.browser, metadata.browserVersion, metadata.os, metadata.osVersion, metadata.model,
    metadata.arch, metadata.ipPrefix, metadata.country, metadata.city, metadata.region,
    metadata.asnOrg, game).run();

  const device = await env.DB.prepare(`
    SELECT banned_at, ban_reason, label, label_source, name_asked_at, profile_at, model
    FROM devices WHERE id = ?
  `).bind(deviceId).first();
  const reason = device?.banned_at
    ? device.ban_reason || "This device has been blocked."
    : account?.banned_at
      ? account.ban_reason || "This account has been blocked."
      : null;
  return {
    account,
    device,
    deviceId,
    guest: cookies[GUEST_COOKIE] === "1",
    blocked: Boolean(reason),
    reason,
    cookies: responseCookies,
  };
}

// Only nag an unnamed device, and only once a month.
function needsName(device) {
  if (!device || device.label_source !== "auto") return false;
  const asked = timestampMs(device.name_asked_at);
  return !asked || Date.now() - asked > NAME_PROMPT_DAYS * 86400000;
}

function needsProfile(device) {
  return Boolean(device) && !device.profile_at;
}

function timestampMs(value) {
  if (!value) return 0;
  const parsed = Date.parse(`${String(value).replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function skipAccount(request, env, url) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  const form = await request.formData();
  const name = cleanText(form.get("name"), 80);
  if (name) {
    await env.DB.prepare(`
      UPDATE devices SET label = ?, label_source = 'self', named_at = CURRENT_TIMESTAMP,
        name_asked_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, identity.deviceId).run();
  }
  const returnTo = safeReturn(form.get("return"));
  return withCookies(Response.redirect(returnTo, 302), [
    ...identity.cookies,
    cookie(GUEST_COOKIE, "1", 31536000),
  ]);
}

async function deviceName(request, env, url) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  if (!identity.account && !identity.guest) {
    return withCookies(Response.json({ error: "access required" }, { status: 401 }), identity.cookies);
  }
  const text = await request.text();
  if (text.length > 512) return Response.json({ error: "name too long" }, { status: 413 });
  let body;
  try { body = JSON.parse(text || "{}"); } catch { return Response.json({ error: "invalid request" }, { status: 400 }); }
  const name = cleanText(body.name, 80);
  if (!name) {
    await env.DB.prepare("UPDATE devices SET name_asked_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(identity.deviceId).run();
    return withCookies(Response.json({ saved: false, asked: true }), identity.cookies);
  }
  await env.DB.prepare(`
    UPDATE devices SET label = ?, label_source = 'self', named_at = CURRENT_TIMESTAMP,
      name_asked_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(name, identity.deviceId).run();
  return withCookies(Response.json({ saved: true, name }), identity.cookies);
}

async function deviceProfile(request, env, url) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  if (!identity.account && !identity.guest) {
    return withCookies(Response.json({ error: "access required" }, { status: 401 }), identity.cookies);
  }
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

async function login(request, env, url) {
  const returnTo = safeReturn(url.searchParams.get("return"));
  if (request.method === "GET") return authPage("Sign in", returnTo);
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const account = await env.DB.prepare(
    "SELECT id, username, password_hash, password_salt, banned_at, ban_reason FROM accounts WHERE username = ?"
  ).bind(username).first();
  if (!account || !(await verifyPassword(password, account.password_salt, account.password_hash))) {
    return authPage("Sign in", returnTo, "Incorrect username or password.", 401);
  }
  if (account.banned_at) return blockedResponse(account.ban_reason || "This account has been blocked.");

  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), account.id, expires).run();
  const response = Response.redirect(returnTo || "https://games.andrenijman.com/", 303);
  return withCookies(response, [sessionCookie(token, SESSION_DAYS * 86400)]);
}

async function register(request, env, url) {
  const returnTo = safeReturn(url.searchParams.get("return"));
  if (request.method === "GET") return authPage("Create account", returnTo, "", 200, true);
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
    return authPage("Create account", returnTo, "Use 3-32 letters, numbers, underscores, or hyphens.", 400, true);
  }
  if (password.length < 12 || password.length > 128) {
    return authPage("Create account", returnTo, "Password must be 12-128 characters.", 400, true);
  }
  const salt = randomToken(16);
  const hash = await hashPassword(password, salt);
  let result;
  try {
    result = await env.DB.prepare(
      "INSERT INTO accounts (username, password_hash, password_salt) VALUES (?, ?, ?)"
    ).bind(username, hash, salt).run();
  } catch {
    return authPage("Create account", returnTo, "That username is already in use.", 409, true);
  }

  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), result.meta.last_row_id, expires).run();
  return withCookies(Response.redirect(returnTo || "https://games.andrenijman.com/", 303), [
    sessionCookie(token, SESSION_DAYS * 86400),
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
  const login = new URL("https://games.andrenijman.com/_guard/login");
  login.searchParams.set("return", returnTo);
  return withCookies(Response.redirect(login, 303), [sessionCookie("", 0), cookie(GUEST_COOKIE, "", 0)]);
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
      await env.DB.prepare("UPDATE devices SET label = ?, label_source = 'admin' WHERE id = ?")
        .bind(reason.slice(0, 80), id).run();
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

  const devices = await env.DB.prepare(`
    SELECT devices.*, accounts.username, accounts.banned_at AS account_banned_at
    FROM devices LEFT JOIN accounts ON accounts.id = devices.account_id
    ORDER BY devices.last_seen_at DESC LIMIT 1000
  `).all();
  return adminPage(groupDevices(devices.results || []), adminEmail, url);
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
  };
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

function authPage(title, returnTo, error = "", status = 200, registering = false) {
  const action = registering ? "register" : "login";
  const alternate = registering ? "login" : "register";
  const alternateLabel = registering ? "Already registered? Sign in" : "Need an account? Register";
  return shell(title, `
    <main class="auth">
      <p class="kicker">OPTIONAL ACCOUNT</p><h1>${title}</h1>
      <p class="account-purpose">Accounts sync supported game progress between devices. You can still play without an account.</p>
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/_guard/${action}?return=${encodeURIComponent(returnTo)}">
        <label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="32"></label>
        <label>Password<input name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" required minlength="12" maxlength="128"></label>
        <button type="submit">${title}</button>
      </form>
      <a class="alternate" href="/_guard/${alternate}?return=${encodeURIComponent(returnTo)}">${alternateLabel}</a>
      <div class="choice"><span>or</span></div>
      <form class="skip" method="post" action="/_guard/skip">
        <input type="hidden" name="return" value="${escapeHtml(returnTo)}">
        <label>Name this device <span>(optional)</span><input name="name" maxlength="80" autocomplete="nickname" placeholder="e.g. Andre's laptop"></label>
        <button class="skip-button" type="submit">Play without an account</button>
      </form>
      <p class="fine">No account is required. <a href="/_guard/privacy">Privacy information</a></p>
    </main>`, status);
}

function adminPage(groups, email, url) {
  const allowedViews = new Set(["all", "accounts", "unclaimed", "blocked"]);
  const requestedView = String(url.searchParams.get("view") || "all");
  const view = allowedViews.has(requestedView) ? requestedView : "all";
  const query = cleanText(url.searchParams.get("q"), 80);
  const queryLower = query.toLowerCase();
  const pageSize = 30;
  const requestedPage = boundedInt(url.searchParams.get("page"), 1, 1000);

  const accountGroups = groups.filter((group) => group.accountId);
  const unclaimed = groups.find((group) => !group.accountId);
  const deviceCount = groups.reduce((total, group) => total + group.devices.length, 0);
  const namedCount = groups.reduce((total, group) =>
    total + group.devices.filter((device) => device.label_source !== "auto").length, 0);
  const blockedCount = groups.filter((group) => group.blocked).length;

  let visible = groups.filter((group) => {
    if (view === "accounts") return Boolean(group.accountId);
    if (view === "unclaimed") return !group.accountId;
    if (view === "blocked") return group.blocked;
    return true;
  }).map((group) => {
    if (view === "blocked" && !group.accountId) {
      const blockedDevices = group.devices.filter((device) => device.banned_at);
      return { ...group, devices: blockedDevices, matchCount: blockedDevices.length };
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
    const confirmedNames = [...new Set(group.devices
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
      open: onlyResult || (!group.accountId && view === "unclaimed"),
      confirmedNames,
      query,
      view,
    });
  }).join("");

  const tabs = [
    ["all", "All", groups.length],
    ["accounts", "Accounts", accountGroups.length],
    ["unclaimed", "Unclaimed", unclaimed?.devices.length || 0],
    ["blocked", "Blocked", blockedCount],
  ].map(([value, label, count]) => `<a href="${escapeHtml(adminHref(value, query))}"${view === value ? ` aria-current="page"` : ""}>${label}<span>${count}</span></a>`).join("");

  return shell("Device access", `<main class="admin">
    <header class="admin-title"><div><p class="kicker">ACCESS CONTROL</p><h1>Who is playing</h1><p class="summary-line">${accountGroups.length} accounts · ${deviceCount} devices · ${namedCount} named</p></div><p>${escapeHtml(email)}</p></header>
    <form class="admin-search" method="get" action="/_guard/admin">
      <input type="hidden" name="view" value="${escapeHtml(view)}">
      <label class="sr-only" for="admin-q">Search accounts and devices</label>
      <input id="admin-q" type="search" name="q" value="${escapeHtml(query)}" maxlength="80" placeholder="Search name, account, model, network or ID">
      <button type="submit">Search</button>
      ${query ? `<a href="${escapeHtml(adminHref(view))}">Clear</a>` : ""}
    </form>
    <nav class="admin-tabs" aria-label="Device filters">${tabs}</nav>
    <details class="admin-help"><summary>How identification works</summary><p>Player and admin names are authoritative; measured hardware and network details are only hints. A device ban applies to one signed browser profile, not to a household or network.</p></details>
    ${query ? `<p class="result-line">${visible.length} matching ${visible.length === 1 ? "group" : "groups"} for “${escapeHtml(query)}”</p>` : ""}
    <div class="people">${sections || `<p class="empty-state">No accounts or devices match this view.</p>`}</div>
  </main>`);
}

function personSection(group, options) {
  const isAccount = Boolean(group.accountId);
  const title = isAccount ? group.username || `Account ${group.accountId}` : "Unclaimed devices";
  const names = options.confirmedNames;
  const named = names.length ? names.slice(0, 2).join(", ") : "No confirmed names";
  const accountControl = isAccount ? `<details class="manage account-manage"><summary>Account controls</summary>
    <form method="post"><input type="hidden" name="account_id" value="${escapeHtml(group.accountId)}"><label>Reason<input name="reason" maxlength="200" placeholder="Optional reason"></label><button class="danger" name="action" value="${group.accountBanned ? "unban-account" : "ban-account"}">${group.accountBanned ? "Unban account" : "Ban account"}</button></form>
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
      <span class="person-name">${escapeHtml(title)}${group.blocked ? `<span class="blocked-label">blocked</span>` : ""}<small>${escapeHtml(named)}</small></span>
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
  return [device.id, device.label, device.model, device.gpu, device.screen, device.os,
    device.os_version, device.browser, device.browser_version, device.arch, device.asn_org,
    device.city, device.region, device.country, device.ip_prefix, device.last_game]
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
    ? `<span class="badge">self-named</span>`
    : device.label_source === "admin"
      ? `<span class="badge">your label</span>`
      : `<span class="badge auto">auto</span>`;
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
  return `<tr class="${device.banned_at ? "blocked-row" : ""}">
    <td><strong>${escapeHtml(device.label || "Unlabelled")}</strong> ${badge}<small title="${escapeHtml(device.id)}">#${escapeHtml(String(device.id || "").slice(0, 8))}</small>${device.ban_reason ? `<small class="ban-reason">${escapeHtml(device.ban_reason)}</small>` : ""}</td>
    <td>${cell(identity, "Not reported yet")}</td>
    <td>${cell(network, "Unknown")}</td>
    <td>${escapeHtml(String(device.last_game || "").replace(".andrenijman.com", "")) || "&mdash;"}<small>${escapeHtml(formatAdminTime(device.last_seen_at))}</small><small>Since ${escapeHtml(formatAdminTime(device.first_seen_at))}</small></td>
    <td><details class="manage"><summary>Manage</summary><form method="post"><input type="hidden" name="id" value="${escapeHtml(device.id)}"><input type="hidden" name="account_id" value="${escapeHtml(device.account_id || "")}"><label>Label or reason<input name="reason" maxlength="200" placeholder="Label or ban reason"></label><span class="actions"><button name="action" value="label-device">Save label</button><button class="danger" name="action" value="${device.banned_at ? "unban-device" : "ban-device"}">${device.banned_at ? "Unban" : "Ban"}</button></span></form></details></td>
  </tr>`;
}

function cell(parts, empty) {
  if (!parts.length) return `<span class="muted">${escapeHtml(empty)}</span>`;
  const [first, ...rest] = parts;
  return `${escapeHtml(first)}${rest.map((part) => `<small>${escapeHtml(part)}</small>`).join("")}`;
}

function privacyPage() {
  return shell("Privacy", `<main class="auth privacy"><p class="kicker">PRIVACY</p><h1>Site data</h1>
    <p>The site records an optional account, a name you choose for your device, a random browser identifier, and the games you visit with first and last visit times.</p>
    <p>It also records what your browser reports about itself: browser and operating-system family and version, processor architecture, device model on Android, screen size and pixel ratio, processor core count, rough memory size, touch support, time zone, and languages, plus the graphics adapter name your browser exposes to web pages.</p>
    <p>From the network connection it records a partial IP network, country, city, region, and the network operator name. Signed-in players may also store supported game progress and named world saves in their account.</p>
    <p>None of this is a hardware serial number or a permanent identifier: it describes the browser and its device class so the site owner can tell one player apart from another and block abuse. It is not sold or shared. Ask the site owner to inspect or delete your record.</p>
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

function gameFramePage(url, title) {
  const gameUrl = new URL(url);
  gameUrl.searchParams.set("_games_frame", "1");
  const safeTitle = escapeHtml(title);
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#141110">
  <title>${safeTitle} | Andre Nijman</title>
  <style>
    :root{color-scheme:dark;--paper:#141110;--panel:#201c18;--ink:#f0ece3;--muted:#9c9282;--accent:#55a37c;--line:rgba(240,236,227,.2);font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,monospace}
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--paper);color:var(--ink)}
    .game-shell{height:100dvh;min-height:100%;display:grid;grid-template-rows:36px minmax(0,1fr) 30px;padding:8px}
    .game-chrome{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 4px;color:var(--muted);font-size:11px;letter-spacing:.04em;white-space:nowrap}
    .game-chrome a{display:flex;align-items:center;height:100%;color:inherit;text-decoration:none;transition:color 140ms ease-out}
    .game-chrome a:hover,.game-chrome a:focus-visible{color:var(--accent)}
    .game-chrome a:focus-visible{outline:1px solid var(--accent);outline-offset:-2px}
    .game-window{min-width:0;min-height:0;border:1px solid var(--line);background:#080907;box-shadow:0 18px 48px rgba(0,0,0,.32);overflow:hidden}
    .game-window iframe{display:block;width:100%;height:100%;border:0;background:#080907}
    .game-title{display:flex;align-items:end;justify-content:center;padding-top:6px;color:var(--ink);font:500 15px/1 Georgia,"Times New Roman",serif;letter-spacing:.01em}
    @media(max-width:640px){.game-shell{grid-template-rows:32px minmax(0,1fr) 26px;padding:4px}.game-chrome{font-size:9px;padding:0 2px}.game-title{font-size:13px;padding-top:5px}}
  </style>
</head>
<body>
  <main class="game-shell">
    <header class="game-chrome">
      <a href="https://andrenijman.com" aria-label="Visit Andre Nijman's portfolio">game made by Andre Nijman</a>
      <a href="https://games.andrenijman.com" aria-label="Back to all games">games.andrenijman.com &uarr;</a>
    </header>
    <div class="game-window">
      <iframe src="${escapeHtml(gameUrl.toString())}" title="${safeTitle}" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe>
    </div>
    <footer class="game-title">${safeTitle}</footer>
  </main>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; base-uri 'none'; frame-ancestors 'self'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "Accept-CH": ACCEPT_CH,
      "X-Games-Guard": "framed",
    },
  });
}

const CLIENT_JS = `(function () {
  var request = new XMLHttpRequest();
  var allowed = false;
  try {
    request.open('GET', '/_guard/status', false);
    request.send();
    var result = JSON.parse(request.responseText);
    allowed = request.status === 200 && result.allowed === true;
    window.__gamesGuardStatus = result;
  } catch (error) {}
  if (!allowed) {
    document.documentElement.innerHTML = '<head><title>Access required</title></head><body style="font:16px monospace;padding:2rem;background:#10110f;color:#eee">Online access check failed or access is blocked. <a style="color:#d1b24b" href="https://games.andrenijman.com/_guard/login?return=' + encodeURIComponent(location.href) + '">Sign in</a></body>';
    window.stop();
    throw new Error('Games access denied');
  }

  if (result && result.needsProfile) {
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
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) { registration.unregister(); });
    }).catch(function () {});
  }
  if ('caches' in window) {
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) { return caches.delete(key); }));
    }).catch(function () {});
  }

  var currentVersion = document.querySelector('meta[name="games-content-version"]')?.content || '';
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
}());`;

const RETIRED_SERVICE_WORKER = `self.addEventListener('install', function () { self.skipWaiting(); }); self.addEventListener('activate', function (event) { event.waitUntil(Promise.all([caches.keys().then(function (keys) { return Promise.all(keys.map(function (key) { return caches.delete(key); })); }), self.registration.unregister(), self.clients.claim()])); }); self.addEventListener('fetch', function (event) { event.respondWith(fetch(event.request)); });`;

const CSS = `
:root{--bg:#10110f;--surface:#181a17;--text:#ebe9df;--muted:#9b9d94;--line:#35382f;--accent:#d1b24b;--danger:#c76155;--s1:4px;--s2:8px;--s3:16px;--s4:24px;--s5:32px;--s6:48px;font-family:Arial,sans-serif;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}a{color:var(--accent)}h1{font:400 clamp(2.2rem,6vw,4.5rem)/.95 Georgia,serif;letter-spacing:-.04em;margin:var(--s2) 0 var(--s4)}p{line-height:1.6;color:var(--muted)}.kicker,th,small,button,label{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.kicker{font-size:.72rem;letter-spacing:.14em;color:var(--accent)}.account-purpose{margin:0 0 var(--s5)}.auth{width:min(100% - 40px,480px);margin:8vh auto}.auth form{display:grid;gap:var(--s3)}label{display:grid;gap:var(--s2);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase}input{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font:inherit}button{min-height:44px;padding:10px 16px;border:1px solid var(--line);border-radius:4px;background:var(--accent);color:var(--bg);cursor:pointer}button:hover{filter:brightness(1.08)}.alternate{display:inline-block;margin-top:var(--s4)}.choice{display:flex;align-items:center;gap:var(--s3);margin:var(--s4) 0;color:var(--muted);font:12px ui-monospace,SFMono-Regular,Consolas,monospace;text-transform:uppercase}.choice:before,.choice:after{content:"";height:1px;background:var(--line);flex:1}.skip-button{display:flex;min-height:56px;align-items:center;justify-content:center;padding:10px 16px;border-radius:4px;background:var(--text);color:var(--bg);font:1rem ui-monospace,SFMono-Regular,Consolas,monospace;text-decoration:none}.skip-button:hover{filter:brightness(1.08)}.fine{font-size:.78rem;margin-top:var(--s4)}.error,.notice{padding:var(--s3);border-left:3px solid var(--danger);background:var(--surface);color:var(--text)}.privacy{max-width:640px}.admin{width:min(100% - 40px,1500px);margin:var(--s6) auto}.admin header{display:flex;justify-content:space-between;align-items:start;gap:var(--s4)}.admin h1{margin-bottom:var(--s3)}.summary-line{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;letter-spacing:.04em}.person{margin-top:var(--s6);border-top:1px solid var(--line);padding-top:var(--s3)}.person>header{align-items:baseline;flex-wrap:wrap;gap:var(--s3)}.person h2{font:400 1.5rem/1.1 Georgia,serif;margin:0}.person h2.anon{color:var(--muted)}.person .summary{flex:1;margin:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.72rem;letter-spacing:.03em}.person>header form{display:flex;gap:var(--s2)}.person>header input{width:auto;min-width:150px}.person>header button{min-height:36px;padding:6px 10px;white-space:nowrap}.person .table{margin-top:var(--s3)}.blocked-person h2{color:var(--danger)}.badge{display:inline-block;padding:2px 7px;border:1px solid var(--accent);border-radius:999px;color:var(--accent);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;vertical-align:middle}.badge.auto{border-color:var(--line);color:var(--muted)}.muted{color:var(--muted)}.table{overflow:auto;border-top:1px solid var(--line);margin-top:var(--s5)}table{width:100%;border-collapse:collapse;min-width:1050px}th,td{text-align:left;padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.7rem;letter-spacing:.1em;color:var(--muted)}td{font-size:.88rem}small{display:block;color:var(--muted);font-size:.68rem;margin-top:var(--s1)}td form{display:grid;gap:var(--s2)}.actions{display:flex;gap:var(--s2)}.actions button{min-height:36px;padding:6px 10px}.danger{background:transparent;color:var(--danger);border-color:var(--danger)}tr.blocked-row{background:#281b18}@media(max-width:600px){.admin header{display:block}.auth{margin-top:var(--s5)}.actions{flex-wrap:wrap}}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}.admin{width:min(100% - 32px,1440px);margin:32px auto}.admin-title{align-items:start}.admin-title h1{font-size:clamp(2rem,4vw,3.5rem);margin:4px 0 8px}.admin-title>p{margin:4px 0;font:11px ui-monospace,SFMono-Regular,Consolas,monospace}.summary-line{margin:0}.admin-search{display:grid;grid-template-columns:minmax(220px,620px) max-content max-content;gap:8px;align-items:center;margin:24px 0 12px}.admin-search input{min-height:44px;padding:8px 12px}.admin-search button{min-height:44px;padding:8px 16px}.admin-search a{padding:8px;color:var(--muted);font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.admin-tabs{display:flex;gap:0;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:none}.admin-tabs::-webkit-scrollbar{display:none}.admin-tabs a{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border-bottom:2px solid transparent;color:var(--muted);font:11px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em;text-decoration:none;text-transform:uppercase;white-space:nowrap}.admin-tabs a:hover,.admin-tabs a:focus-visible{color:var(--text)}.admin-tabs a[aria-current="page"]{color:var(--accent);border-bottom-color:var(--accent)}.admin-tabs span{color:inherit;opacity:.7}.admin-help{margin:8px 0 0;color:var(--muted);font-size:.78rem}.admin-help summary{width:max-content;min-height:44px;padding:13px 0;cursor:pointer;font:11px ui-monospace,SFMono-Regular,Consolas,monospace}.admin-help p{max-width:900px;margin:0 0 12px;font-size:.78rem}.result-line,.empty-state{margin:16px 0;font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.people{margin-top:8px;border-top:1px solid var(--line)}.person{margin:0;padding:0;border:0;border-bottom:1px solid var(--line)}.person-summary{display:grid;grid-template-columns:8px minmax(170px,1fr) 84px 130px 12px;gap:12px;align-items:center;min-height:48px;padding:7px 12px;cursor:pointer;list-style:none}.person-summary::-webkit-details-marker{display:none}.person-summary:hover{background:var(--surface)}.person-summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.status-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}.blocked-person .status-dot{background:var(--danger)}.person-name{min-width:0;font:15px/1.2 Georgia,serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.blocked-label{display:inline;margin-left:7px;color:var(--danger);font:9px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}.person-name small{display:inline;margin:0 0 0 9px;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.person-count,.person-seen{color:var(--muted);font:10px ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right;white-space:nowrap}.disclosure{width:7px;height:7px;border-right:1px solid var(--muted);border-bottom:1px solid var(--muted);transform:rotate(45deg) translate(-2px,-2px);transition:transform 140ms ease-out}.person[open]>.person-summary .disclosure{transform:rotate(225deg) translate(-1px,-1px)}.person-body{padding:0 12px 12px;background:rgba(255,255,255,.012)}.person .table{margin:0;border-top:1px solid var(--line)}.person table{min-width:940px}.person th,.person td{padding:8px 10px}.person th{font-size:.62rem}.person td{font-size:.78rem}.person td:first-child{width:24%}.person td:nth-child(2){width:27%}.person td:nth-child(3){width:21%}.person td:nth-child(4){width:16%}.person td:last-child{width:12%}.person small{font-size:.62rem;margin-top:2px}.badge{padding:1px 5px;font-size:.52rem}.ban-reason{color:var(--danger)}.manage{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.manage>summary{width:max-content;min-height:44px;padding:14px 0;color:var(--muted);font-size:.68rem;cursor:pointer}.manage[open]>summary{color:var(--accent)}.manage form{min-width:190px;padding:8px 0}.manage label{gap:4px;font-size:.62rem}.manage input{min-height:44px;padding:7px 9px;font-size:.78rem}.actions{margin-top:6px}.actions button,.account-manage button{min-height:44px;padding:8px 10px;font-size:.68rem}.account-manage{margin-left:auto;padding:8px 0}.account-manage form{display:grid;grid-template-columns:minmax(180px,300px) auto;align-items:end;gap:8px}.pager{display:flex;justify-content:flex-end;align-items:center;gap:14px;padding:10px 0 0;color:var(--muted);font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.pager a{color:var(--accent)}.blocked-row{box-shadow:inset 2px 0 var(--danger)}@media(prefers-reduced-motion:reduce){.disclosure{transition:none}}@media(max-width:700px){.admin{width:min(100% - 24px,1440px);margin:20px auto}.admin-title{display:block}.admin-title>p{margin-top:8px}.admin-search{grid-template-columns:1fr auto}.admin-search a{grid-column:1/-1;padding:0}.person-summary{grid-template-columns:8px minmax(0,1fr) 68px 12px;gap:8px;padding:7px 8px}.person-seen{display:none}.person-name small{display:block;margin:2px 0 0;overflow:hidden;text-overflow:ellipsis}.person-body{padding:0 8px 8px}.person .table{overflow:visible}.person table,.person tbody,.person tr,.person td{display:block;min-width:0}.person thead{display:none}.person tr{padding:8px 0;border-bottom:1px solid var(--line)}.person td{width:auto!important;padding:3px 4px;border:0}.person td:before{display:block;margin-bottom:2px;color:var(--muted);font:9px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}.person td:nth-child(1):before{content:"Device"}.person td:nth-child(2):before{content:"Identity"}.person td:nth-child(3):before{content:"Network"}.person td:nth-child(4):before{content:"Activity"}.person td:nth-child(5):before{content:"Controls"}.account-manage form{grid-template-columns:1fr}.pager{justify-content:space-between}}
`;
