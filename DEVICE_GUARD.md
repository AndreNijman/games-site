# Games access guard

This Worker puts browser-device access checks in front of every game subdomain. Visitors can use the site immediately without naming their device or creating an account. Accounts remain optional except for ONE WORLD, where the account username is the authenticated in-world name. Accounts can also sync supported game progress and named world saves across devices. The guard records a random signed browser ID, an automatically generated internal label, an optional account, browser/OS family and version, processor architecture, device model where the browser reports one, graphics adapter name, screen size and pixel ratio, core count, rough memory, touch support, time zone, languages, masked IP network, country/city/region, network operator name, last game, the first and most recent cross-site referrer, and first/last seen timestamps.

Referrers are recorded only for top-level document navigations, and only when the referring host is outside `*.andrenijman.com`, so an internal click never overwrites the arrival. `Referrer-Policy: strict-origin-when-cross-origin` means a cross-site referrer arrives as a bare origin with no path.

## Automated traffic

`classifyAgent()` names the agent behind a request — `Googlebot`, `Baiduspider`, `AdSense`, `curl`, `node` — and gives it a kind: `search`, `ads`, `ai`, `seo`, `scanner`, `social`, `monitor`, `tool`. The console badges each row with that name and shows the raw user agent, because browser and OS both read `Other` for anything that is not a mainstream browser, which is exactly when an operator needs the detail. A **Crawlers** tab filters the console down to automated rows, and search reaches the derived name, so `googlebot` finds rows whose agent string does not contain the word.

The same classifier decides what `recordVisit` excludes from the counters, so the console and the counters can never disagree. The older `BOT_AGENT` regex remains as a fallback beneath the named table: widening the classifier can only exclude more traffic, never less. The classification is derived on read and never stored, so it cannot go stale when the table changes.

Where an operator crawls only from its own network — Google, Microsoft, Apple, Yandex — a row whose agent claims that operator but arrives from elsewhere is badged `unverified`. That is a statement about the network, not an accusation: the usual cause is testing with a changed user agent. Baiduspider deliberately carries no network binding, because it legitimately reaches this site from China Unicom ranges rather than anything Baidu-named. A request with no recorded network is never called unverified.

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

## Discoverability

`GAMES` in `worker/index.js` is the single source of truth for every game: name, description, genre, hero image and dimensions, `origin`, and an optional `credit`. `GAME_TITLES` is derived from it. Descriptions and genres were generated from the hub's own structured data so the two cannot drift.

`gameFramePage()` renders each game subdomain as a real page rather than a bare iframe: descriptive title, meta description, canonical, Open Graph and Twitter tags with image dimensions, and three structured-data blocks — `VideoGame`, `BreadcrumbList` and `FAQPage`. Below the game stage sits an About section carrying the description, genres, the answers used in `FAQPage`, and links to all thirteen other games. **The FAQ answers must stay visible on the page**: search engines treat `FAQPage` markup whose answers are not in the rendered page as a violation, so `gameFaq()` feeds both the markup and the `<dl>`.

Every answer in `gameFaq()` restates a fact that already appears on the hub — free to play, runs in the browser, whether an account is needed, whether it is multiplayer, and who made it. Nothing about controls or gameplay is asserted, because that would mean inventing detail no source here confirms.

The game stage keeps its exact `height:100dvh` grid, so the iframe container is unchanged and nothing inside a game resizes; only the outer document scrolls. Only `/` and `/index.html` are indexable — every other path on a game host still renders the game shell but is `noindex,follow` and carries no canonical, because previously any path returned this page with a 200 and gave crawlers an unbounded supply of duplicate URLs.

`?_games_frame=1` inner documents are `noindex,follow` with a canonical to the clean URL, so the framed variant stops competing with the page that embeds it.

Seven hosts get generated crawler files. Six (`wildbound`, `tung`, `fishing`, `slope`, `motox3m`, `mc`) ship no `robots.txt` at all and fell back to Cloudflare's managed default, which carries no sitemap pointer. `bigtower` is the seventh and the one deliberate exception to leaving upstream files alone: its own `robots.txt` contains exactly the two default rules and declares no sitemap, and its `/sitemap.xml` returned 404, so generating both loses nothing — but adding rules to that repository later requires removing it from `GENERATED_CRAWLER_FILES`. `crawlerFileResponse()` generates `robots.txt` and `sitemap.xml` for exactly those seven, and `llms.txt` for the hub. The remaining eight hosts — the hub plus `topout`, `defenders`, `overpop`, `tree`, `isaac`, `bop` and `slingwreck` — serve their own files and are deliberately untouched — shadowing them would silently override files living in separate repositories, and `topout`'s `Disallow: /server/` would be the first casualty. `crawlerFileResponse()` runs ahead of the asset path because both filenames match the asset extension test.

`Content-Signal: search=yes, ai-input=yes` on the generated files. `ai-input` governs retrieval and grounding for generative answers, which is what earns a citation; `ai-train` is a separate rights question that affects neither and is left unspecified, granting and restricting nothing.

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
