# The games platform

Every game on games.andrenijman.com is its own repository in the GitHub
organisation. This repository is the platform: it decides which games exist,
where they live and what they may run, and it keeps the hub, the guard and the
relays in step with that. Developers never touch Cloudflare, DNS or this
repository. They push their game; the rest follows.

The developer side is documented in the org's `.github` repository
(`CONTRIBUTING.md`) and in `template-game`.

## Two halves of every game

| | Who writes it | Where | What it says |
|---|---|---|---|
| **Registry entry** | Andre | `registry/<slug>.yaml` | The slug, host, repository, owners, whether it is enabled, listed and guarded, whether it may have a relay and under what name and domain. Everything that costs money or touches the zone. |
| **game.yaml** | The developer | the game repository's root | Name, description, card, credit, how to build it, whether it is published, and the relay's entry point and Durable Objects. |

Both are checked against `schema/registry.schema.json` and
`schema/game.schema.json`. A game is **live** when its registry entry is
`enabled` and its game.yaml says `publish: true`; it gets a hub card when it is
also `listed`. A developer can take their own game offline (`publish: false`);
only Andre can put a new host or a relay on the zone.

Until a game repository carries its own game.yaml, `manifests/<slug>.yaml`
stands in for it (the registry's `manifest:` line). The manifests were seeded
from the old hand-kept tables; the migration below moves each one into its
game's repository.

## What is generated

`npm run platform:generate` reads `platform.yaml`, `registry/` and every
game.yaml (with `--cache <dir>`, the copies `platform/fetch-manifests.mjs`
fetched there, which win over the staged ones in `manifests/`) and writes:

- `generated/catalog.json`, which the hub (`src/data/games.ts`), the guard
  (`worker/index.js`: hosts, games, offline pages, crawler files, llms.txt)
  and the match log (`worker/netlog.js`) all import. Nothing per game is listed
  by hand anywhere else.
- the top-level `routes` in `wrangler.jsonc`, one per guarded host.

`npm run check` ends with `generate --check`, so a stale catalog fails CI.

## The workflow

`.github/workflows/platform.yml` does nothing until the repository variable
`PLATFORM_ENABLED` is `true`. Then:

1. **sync** runs on a push to main here, on a `game-push` dispatch, every
   half hour, or by hand. It fetches each game.yaml at its repository's head,
   regenerates, commits the catalog and routes if they changed, and starts the
   hub build (`site.yml`).
2. **guard** deploys games-guard with the generated routes and creates any
   missing proxied DNS record (`platform/dns.mjs`: create only, it never edits
   or deletes an existing record). Environment `cloudflare`.
3. **relay-build** builds a game's relay with `wrangler deploy --dry-run` in a
   job that holds no secrets, because it runs the game's own install.
4. **relay-deploy** uploads that bundle with the config from
   `platform/relay-config.mjs` and checks its health URL. Environment
   `relays`. A relay is redeployed only when the push touched a file in its
   `watch` globs (`platform/relay-plan.mjs`), or by hand with the `relay`
   input.

The fast path is the org webhook: GitHub posts each push to
`https://games.andrenijman.com/_platform/hook`, the guard checks the signature
and sends `repository_dispatch` here (`worker/platform-hook.js`). The game
repositories hold no token for this one.

Each game's own workflow is five lines calling the org's shared
`game.yml@v1`, which checks game.yaml with `platform/check-game.mjs`, runs the
game's checks, builds it and publishes it to Pages from the default branch when
it is registered and `publish: true`.

## Relays

A relay's wrangler config is written from the two halves, never by the
developer: the name and domain from the registry, the entry point, Durable
Objects and migrations from game.yaml, `ALLOWED_ORIGINS` set to the game's own
address (a game.yaml cannot set it), and the NetLog service binding when the
registry says `netlog: true`. Relays are on the shared account, so the
`relays` environment reviewer is the gate on someone else's code going live.

Existing relays are `managed: false`: the platform knows their names and
domains (so nothing else can claim them) but does not deploy them. Switch one
to `managed: true` once its game.yaml relay block matches what is deployed;
`node platform/relay-config.mjs <slug> --manifest <game.yaml>` prints the
config to compare.

## Adding a game

1. The developer starts from `template-game` (or adds a game.yaml and the
   five-line workflow to their own repository) in the org.
2. Andre adds `registry/<slug>.yaml`: host, repo, owners, `enabled: true`,
   `listed`, `guard: true`, and a `relay:` block if one is allowed.
3. On merge, sync picks up the game.yaml, guard adds the route and DNS record,
   and the game's next push to its default branch publishes it.

## Moving the existing games over

`node platform/migrate.mjs` prints the plan. For each game:

1. `migrate.mjs <slug> --write <local clone>` commits game.yaml, the card at
   `.github/game-card.png` and the caller workflow on a branch
   `platform/join-org`, and removes the old Pages workflow. It pushes nothing.
2. Merge that branch, then `migrate.mjs <slug> --transfer` moves the
   repository into the org and points its Pages at GitHub Actions with the
   same custom domain.
3. Set the registry entry's `repo` to the new name and delete its `manifest:`
   line.

Two games are `kind: external` and stay as they are: `mc` (served from
andrenijman.github.io/one-world through a special path in the guard, relay on
the Orange Pi) and `krillion` (krillion.io reverse-proxied by the guard; no
repository, so `manifests/krillion.yaml` is its only game.yaml).

## Switching it on

One-time setup, in order:

- [ ] Create the organisation; replace `andrenijman-games` in `platform.yaml`,
      the org `.github` repository and `template-game`.
- [ ] Decide on private repositories: Pages from a private repository in an
      organisation needs a paid plan. Otherwise those games go public.
- [ ] Push the org `.github` repository with its `v1` tag, and
      `template-game` as a template repository.
- [ ] Move this repository into the org as `platform` (or update
      `platformRepo`).
- [ ] Secrets: `PLATFORM_READ_TOKEN` (repository); `CLOUDFLARE_API_TOKEN` and
      `CLOUDFLARE_ACCOUNT_ID` in the `cloudflare` and `relays` environments,
      each with Andre as required reviewer; `PLATFORM_WEBHOOK_SECRET` and
      `PLATFORM_DISPATCH_TOKEN` as guard Worker secrets.
- [ ] Org webhook (push events) to `https://games.andrenijman.com/_platform/hook`
      with the same secret.
- [ ] Set `PLATFORM_ENABLED` to `true`.
