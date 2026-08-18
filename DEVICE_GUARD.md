# Games access guard

This Worker puts browser-device access checks in front of every game subdomain. Accounts are optional and intended for future cross-device progress sync. It records a random signed browser ID, optional account, manually assigned label, browser/OS family, masked IP network, country, last game, and first/last seen timestamps.

It does not and cannot read a hardware serial number, MAC address, real name, or produce a permanent cross-browser hardware ban. Account bans are the durable identity-level control. A device ban applies to the signed browser profile; deleting cookies creates a new profile, although signing into the same banned account remains blocked.

## Deploy

1. Run `npm install` and `npx wrangler login`.
2. Create D1: `npx wrangler d1 create games-guard`.
3. Put the returned database ID in `wrangler.jsonc`.
4. Apply the schema: `npx wrangler d1 execute games-guard --remote --file worker/schema.sql`.
5. Create the cookie signing secret: `openssl rand -base64 48 | npx wrangler secret put COOKIE_SECRET`.
6. Set the one administrator email: `npx wrangler secret put ADMIN_EMAIL`.
7. In Cloudflare Zero Trust, protect `games.andrenijman.com/_guard/admin*` with an Access policy allowing only that email. The Worker verifies the resulting `CF-Access-Authenticated-User-Email` header as a second check.
8. Proxy the six game DNS records through Cloudflare. Keep each existing CNAME target; the Worker route uses that target as its origin.
9. Run `npm run deploy`.

Do not deploy before the Access policy exists. Otherwise the admin route returns 403, but it should still be protected at Cloudflare's edge.

## Offline games

Several games currently install service workers and cache enough files to run offline. No online ban system can revoke files that are already stored on somebody's device. To require enforceable access, each game must remove offline navigation caching and load `/_guard/client.js` as the first blocking script on every HTML entry point. The client performs an online status check and fails closed. Existing service-worker registrations may continue using their old cache until the browser refreshes the registration.

The Worker also sends `Clear-Site-Data: "cache"` on blocked online responses and disables edge/browser caching for guarded responses. This limits new offline copies but cannot delete files a visitor manually downloaded.

## Operations

- Dashboard: `https://games.andrenijman.com/_guard/admin`
- Health check: `https://games.andrenijman.com/_guard/health`
- Player disclosure: `https://games.andrenijman.com/_guard/privacy`
- Players can use the prominent guest option without creating an account.
- Device labels and ban reasons are editable in the dashboard.
- Account bans delete active sessions and block every device that signs into that account.
- Device bans block the current signed browser profile across all `*.andrenijman.com` games.
