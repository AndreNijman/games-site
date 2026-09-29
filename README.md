# games.andrenijman.com

Two things live here:

- **The hub page**, built with Astro the way andrenijman.com and
  [rimeos.com](https://rimeos.com) are, and published to GitHub Pages.
- **The games-guard Worker** in `worker/`, which sits in front of the hub
  and every game host. See [DEVICE_GUARD.md](DEVICE_GUARD.md).

```sh
npm install
npm run dev          # the hub at http://localhost:4321 (no Worker in front)
npm run build        # astro build + the postbuild gate → dist/
npm run preview
npm test             # unit tests, including the hub against the Worker's GAMES table
npm run test:e2e     # Playwright: Chromium, Firefox, WebKit, with axe (needs a build)
npm run check        # astro check, and node --check on the Worker
npm run art          # public/*.png → public/art/*.webp for the cards
npm run fonts        # re-copy the woff2 files after bumping a Fontsource package
npm run worker:dev   # wrangler dev
npm run deploy       # wrangler deploy: the Worker, not the hub
```

## The hub

`src/data/games.ts` is the list: the cards, the number in the strip and the
CollectionPage structured data are all drawn from it. Adding a game there,
with its screenshot in `public/` and `npm run art`, is the edit.
`tests/unit/games.test.ts` then holds it to the Worker's own `GAMES` table
(names, screenshots, credits) and checks that the cards still fill every row.

The design is andrenijman.com's: `src/styles/tokens.css`, `fonts.css`,
`base.css` and `kit.css` are shared word for word with AndreNijman/portfolio.
Rime OS's default dark, stickers with a solid edge and a hard shadow,
Fraunces and Hanken Grotesk served from `/fonts/`. `hub.css` adds only what
the portfolio has no use for: the account controls and the advertising.

## What the Worker needs from the hub

The Worker fetches the hub from GitHub Pages and rewrites it on the way
through, so the page keeps to a contract that `scripts/postbuild.mjs` checks
on every build:

- a plain `<head>`, which the Worker prepends its status meta and
  `/_guard/client.js` to;
- `#account`, `#account-name`, `#nav-signin`, the `/_guard/logout` form and
  the `/_guard/login?return=` link, which the page's own script fills from
  that status meta;
- the three AdSense units and their ids;
- the screenshots at the root, `/<game>.png`, and `/og-image.png`: the
  Worker's pages for each game host use them as social cards.

## Deploy

The hub: GitHub Pages, built by `.github/workflows/site.yml` on every push to
`main` once it passes the tests. The repository's Pages source has to be
**GitHub Actions**; with the `main` branch as the source, Pages would serve
this source tree instead of the build.

The Worker: `npm run deploy`, as before.
