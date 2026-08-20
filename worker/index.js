const DEVICE_COOKIE = "games_device";
const SESSION_COOKIE = "games_session";
const GUEST_COOKIE = "games_guest";
const COOKIE_DOMAIN = ".andrenijman.com";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const HOSTS = new Set([
  "games.andrenijman.com",
  "topout.andrenijman.com",
  "defenders.andrenijman.com",
  "overpop.andrenijman.com",
  "wildbound.andrenijman.com",
  "tree.andrenijman.com",
  "tung.andrenijman.com",
  "isaac.andrenijman.com",
]);

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

  const upstream = await fetchFreshUpstream(request);
  const response = new Response(upstream.body, upstream);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Games-Guard", "active");
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
  if (url.pathname.startsWith("/_guard/admin")) return handleAdmin(request, env, url);
  if (url.pathname === "/_guard/skip") return skipAccount(request, env, url);
  if (url.pathname === "/_guard/logout") return logout(request, env);
  if (url.pathname === "/_guard/login") return login(request, env, url);
  if (url.pathname === "/_guard/register") return register(request, env, url);
  if (url.pathname === "/_guard/profile") return gameProfile(request, env, url);
  if (url.pathname === "/_guard/status") {
    const identity = await identify(request, env, url.hostname);
    const response = Response.json({
      allowed: !identity.blocked && Boolean(identity.account || identity.guest),
      signedIn: Boolean(identity.account),
      username: identity.account?.username || null,
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
    INSERT INTO devices (id, account_id, label, user_agent, browser, os, ip_prefix, country, last_game)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      account_id = COALESCE(excluded.account_id, devices.account_id),
      user_agent = excluded.user_agent,
      browser = excluded.browser,
      os = excluded.os,
      ip_prefix = excluded.ip_prefix,
      country = excluded.country,
      last_game = excluded.last_game,
      last_seen_at = CURRENT_TIMESTAMP
  `).bind(deviceId, account?.id || null, defaultDeviceLabel(metadata, deviceId), metadata.userAgent,
    metadata.browser, metadata.os, metadata.ipPrefix, metadata.country, game).run();

  const device = await env.DB.prepare(
    "SELECT banned_at, ban_reason FROM devices WHERE id = ?"
  ).bind(deviceId).first();
  const reason = device?.banned_at
    ? device.ban_reason || "This device has been blocked."
    : account?.banned_at
      ? account.ban_reason || "This account has been blocked."
      : null;
  return {
    account,
    deviceId,
    guest: cookies[GUEST_COOKIE] === "1",
    blocked: Boolean(reason),
    reason,
    cookies: responseCookies,
  };
}

async function skipAccount(request, env, url) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const identity = await identify(request, env, url.hostname);
  if (identity.blocked) return blockedResponse(identity.reason, identity.cookies);
  const form = await request.formData();
  const name = String(form.get("name") || "").trim().slice(0, 80);
  if (name) {
    await env.DB.prepare("UPDATE devices SET label = ? WHERE id = ?").bind(name, identity.deviceId).run();
  }
  const returnTo = safeReturn(form.get("return"));
  return withCookies(Response.redirect(returnTo, 302), [
    ...identity.cookies,
    cookie(GUEST_COOKIE, "1", 31536000),
  ]);
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
  const token = parseCookies(request.headers.get("Cookie") || "")[SESSION_COOKIE];
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return withCookies(Response.redirect("https://games.andrenijman.com/_guard/login", 303), [sessionCookie("", 0)]);
}

async function handleAdmin(request, env, url) {
  const adminEmail = request.headers.get("CF-Access-Authenticated-User-Email") || "";
  if (!env.ADMIN_EMAIL || adminEmail.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    return htmlPage("Forbidden", "This dashboard requires the configured Cloudflare Access administrator.", 403);
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
      await env.DB.prepare("UPDATE devices SET label = ? WHERE id = ?").bind(reason.slice(0, 80), id).run();
    } else if (action === "ban-account") {
      await env.DB.prepare("UPDATE accounts SET banned_at = CURRENT_TIMESTAMP, ban_reason = ? WHERE id = ?")
        .bind(reason, accountId).run();
      await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(accountId).run();
    } else if (action === "unban-account") {
      await env.DB.prepare("UPDATE accounts SET banned_at = NULL, ban_reason = NULL WHERE id = ?").bind(accountId).run();
    } else {
      return new Response("Unknown action", { status: 400 });
    }
    return Response.redirect("https://games.andrenijman.com/_guard/admin", 303);
  }

  const devices = await env.DB.prepare(`
    SELECT devices.*, accounts.username, accounts.banned_at AS account_banned_at
    FROM devices LEFT JOIN accounts ON accounts.id = devices.account_id
    ORDER BY devices.banned_at IS NOT NULL DESC, devices.last_seen_at DESC LIMIT 500
  `).all();
  return adminPage(devices.results || [], adminEmail);
}

function deviceMetadata(request) {
  const userAgent = (request.headers.get("User-Agent") || "").slice(0, 500);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  return {
    userAgent,
    browser: detectBrowser(userAgent),
    os: detectOs(userAgent),
    ipPrefix: maskIp(ip),
    country: (request.cf?.country || "").slice(0, 2),
  };
}

function defaultDeviceLabel(metadata, deviceId) {
  return `${metadata.os} ${metadata.browser} · ${metadata.country || "Unknown"} · ${deviceId.slice(0, 4)}`;
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

function adminPage(devices, email) {
  const rows = devices.map((device) => `<tr class="${device.banned_at ? "blocked-row" : ""}">
    <td><strong>${escapeHtml(device.label || "Unlabelled")}</strong><small>${escapeHtml(device.id)}</small></td>
    <td>${escapeHtml(device.username || "Not signed in")}</td>
    <td>${escapeHtml(device.os)} / ${escapeHtml(device.browser)}<small>${escapeHtml(device.ip_prefix)} ${escapeHtml(device.country)}</small></td>
    <td>${escapeHtml(device.last_game.replace(".andrenijman.com", ""))}<small>${escapeHtml(device.last_seen_at)}</small></td>
    <td><form method="post"><input type="hidden" name="id" value="${escapeHtml(device.id)}"><input type="hidden" name="account_id" value="${escapeHtml(device.account_id || "")}"><input name="reason" maxlength="200" placeholder="Label or reason"><span class="actions"><button name="action" value="label-device">Label</button><button class="danger" name="action" value="${device.banned_at ? "unban-device" : "ban-device"}">${device.banned_at ? "Unban" : "Ban device"}</button>${device.account_id ? `<button class="danger" name="action" value="${device.account_banned_at ? "unban-account" : "ban-account"}">${device.account_banned_at ? "Unban account" : "Ban account"}</button>` : ""}</span></form></td>
  </tr>`).join("");
  return shell("Device access", `<main class="admin"><header><div><p class="kicker">ACCESS CONTROL</p><h1>Known devices</h1></div><p>${escapeHtml(email)}</p></header><p class="notice">A device ban applies only to that signed browser profile and its known duplicate IDs. It does not block other devices sharing the same network.</p><div class="table"><table><thead><tr><th>Device</th><th>Account</th><th>Client</th><th>Last seen</th><th>Control</th></tr></thead><tbody>${rows || `<tr><td colspan="5">No devices recorded.</td></tr>`}</tbody></table></div></main>`);
}

function privacyPage() {
  return shell("Privacy", `<main class="auth privacy"><p class="kicker">PRIVACY</p><h1>Site data</h1><p>The site records an optional account or device name, a browser identifier, browser and operating-system family, partial IP network, country, games visited, and first/last visit times.</p><p>This information is used to operate and secure the games site. Ask the site owner to inspect or delete your record.</p><a class="alternate" href="/_guard/login">Return to the games</a></main>`);
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
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
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
  } catch (error) {}
  if (!allowed) {
    document.documentElement.innerHTML = '<head><title>Access required</title></head><body style="font:16px monospace;padding:2rem;background:#10110f;color:#eee">Online access check failed or access is blocked. <a style="color:#d1b24b" href="https://games.andrenijman.com/_guard/login?return=' + encodeURIComponent(location.href) + '">Sign in</a></body>';
    window.stop();
    throw new Error('Games access denied');
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
:root{--bg:#10110f;--surface:#181a17;--text:#ebe9df;--muted:#9b9d94;--line:#35382f;--accent:#d1b24b;--danger:#c76155;--s1:4px;--s2:8px;--s3:16px;--s4:24px;--s5:32px;--s6:48px;font-family:Arial,sans-serif;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}a{color:var(--accent)}h1{font:400 clamp(2.2rem,6vw,4.5rem)/.95 Georgia,serif;letter-spacing:-.04em;margin:var(--s2) 0 var(--s4)}p{line-height:1.6;color:var(--muted)}.kicker,th,small,button,label{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.kicker{font-size:.72rem;letter-spacing:.14em;color:var(--accent)}.account-purpose{margin:0 0 var(--s5)}.auth{width:min(100% - 40px,480px);margin:8vh auto}.auth form{display:grid;gap:var(--s3)}label{display:grid;gap:var(--s2);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase}input{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font:inherit}button{min-height:44px;padding:10px 16px;border:1px solid var(--line);border-radius:4px;background:var(--accent);color:var(--bg);cursor:pointer}button:hover{filter:brightness(1.08)}.alternate{display:inline-block;margin-top:var(--s4)}.choice{display:flex;align-items:center;gap:var(--s3);margin:var(--s4) 0;color:var(--muted);font:12px ui-monospace,SFMono-Regular,Consolas,monospace;text-transform:uppercase}.choice:before,.choice:after{content:"";height:1px;background:var(--line);flex:1}.skip-button{display:flex;min-height:56px;align-items:center;justify-content:center;padding:10px 16px;border-radius:4px;background:var(--text);color:var(--bg);font:1rem ui-monospace,SFMono-Regular,Consolas,monospace;text-decoration:none}.skip-button:hover{filter:brightness(1.08)}.fine{font-size:.78rem;margin-top:var(--s4)}.error,.notice{padding:var(--s3);border-left:3px solid var(--danger);background:var(--surface);color:var(--text)}.privacy{max-width:640px}.admin{width:min(100% - 40px,1500px);margin:var(--s6) auto}.admin header{display:flex;justify-content:space-between;align-items:start;gap:var(--s4)}.admin h1{margin-bottom:var(--s3)}.table{overflow:auto;border-top:1px solid var(--line);margin-top:var(--s5)}table{width:100%;border-collapse:collapse;min-width:1050px}th,td{text-align:left;padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.7rem;letter-spacing:.1em;color:var(--muted)}td{font-size:.88rem}small{display:block;color:var(--muted);font-size:.68rem;margin-top:var(--s1)}td form{display:grid;gap:var(--s2)}.actions{display:flex;gap:var(--s2)}.actions button{min-height:36px;padding:6px 10px}.danger{background:transparent;color:var(--danger);border-color:var(--danger)}tr.blocked-row{background:#281b18}@media(max-width:600px){.admin header{display:block}.auth{margin-top:var(--s5)}.actions{flex-wrap:wrap}}
`;
