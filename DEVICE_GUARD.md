# Games access guard

This Worker puts browser-device access checks in front of every game subdomain. Visitors can use the site immediately without naming their device or creating an account. Accounts remain optional except for ONE WORLD, where the account username is the authenticated in-world name. Accounts can also sync supported game progress and named world saves across devices. The guard records a random signed browser ID, an automatically generated internal label, an optional account, browser/OS family and version, processor architecture, device model where the browser reports one, graphics adapter name, screen size and pixel ratio, core count, rough memory, touch support, time zone, languages, masked IP network, country/city/region, network operator name, last game, and first/last seen timestamps.

Labels have a `label_source`: `auto` is the generated internal label, `admin` is an optional label an administrator typed, and `self` is retained only for historical labels supplied before device naming was removed. Logging in or out never clears the signed device cookie. Visitors are never prompted for a device label.

Identification is a device *class*, not a device identity. Browsers expose no computer name, hardware serial or MAC address, and there is no permanent cross-browser hardware ban. `Sec-CH-UA-Model` only returns a real model on Chromium mobile; desktop Chromium returns nothing and Firefox and Safari send no client hints at all. The graphics adapter name is masked by Firefox's resistFingerprinting and generic on Safari. Treat all measured details as hints; account identity and optional administrator labels are the authoritative controls. Account bans are the durable identity-level control. A device ban applies to the signed browser profile; deleting cookies creates a new profile, although signing into the same banned account remains blocked.

## Deploy

1. Run `npm install` and `npx wrangler login`.
2. Create D1: `npx wrangler d1 create games-guard`.
3. Put the returned database ID in `wrangler.jsonc`.
4. Apply the schema: `npx wrangler d1 execute games-guard --remote --file worker/schema.sql`.
5. Create the cookie signing secret: `openssl rand -base64 48 | npx wrangler secret put COOKIE_SECRET`.
6. Set the administrator emails: `npx wrangler secret put ADMIN_EMAILS` (comma- or space-separated; the older single-value `ADMIN_EMAIL` is still honoured). Emails live in a secret because this repository is public.
7. Create the ONE WORLD ticket secret with `openssl rand -base64 48 | npx wrangler secret put MC_JOIN_SECRET`, and install that same value in the Orange Pi relay environment. Never commit it.
8. In Cloudflare Zero Trust, protect `games.andrenijman.com/_guard/admin*` with an Access policy allowing exactly those emails. The Worker verifies the resulting `CF-Access-Authenticated-User-Email` header as a second check, so both lists must be updated together — Access decides who reaches the Worker, and `ADMIN_EMAILS` decides who the Worker accepts.
9. Proxy every configured game DNS record through Cloudflare. Keep each existing CNAME target; the Worker route uses that target as its origin.
10. Run `npm run deploy`.

Do not deploy before the Access policy exists. Otherwise the admin route returns 403, but it should still be protected at Cloudflare's edge.

## Offline games

Several games previously installed service workers and cached enough files to run offline. No online ban system can revoke files that somebody already downloaded. Document navigations and protected APIs are identity-gated, while ordinary static assets are cached without a D1 lookup so game startup does not perform hundreds of database writes. Guarded HTML receives the already-verified status from the Worker and loads `/_guard/client.js` without a second render-blocking status request.

The client unregisters old service workers and automatically reloads once if one was still controlling the current tab. The retired service-worker response clears its old caches, and blocked online responses still send `Clear-Site-Data: "cache"`. Personalized HTML remains private and uncached; raw upstream HTML has a 30-second edge cache and static assets have a one-hour edge cache with five-minute browser freshness.

## Operations

- Dashboard: `https://games.andrenijman.com/_guard/admin`
- Two independent admin surfaces exist. The device console is gated on **email** (Cloudflare Access policy plus `ADMIN_EMAILS`). Tung lobby admin is gated on **game account username** via `TUNG_ADMINS` in `worker/index.js`, and the same username list is duplicated in the Tung client and the Tung relay. Granting one does not grant the other.
- Health check: `https://games.andrenijman.com/_guard/health`
- Player disclosure: `https://games.andrenijman.com/_guard/privacy`
- The site is available without an account, except ONE WORLD. A guest can sign into or create an account later without changing the signed browser identity.
- Internal device labels and ban reasons are editable in the dashboard.
- Administrators can rename accounts and reset passwords. Existing passwords and hashes are never shown; a reset stores a new salted hash and deletes every active session for that account.
- Account bans delete active sessions and block every device that signs into that account.
- Device bans block the current signed browser profile across all `*.andrenijman.com` games.
