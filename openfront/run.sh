#!/bin/sh
# OpenFront at openfront.andrenijman.com, run on the Orange Pi from an
# unmodified clone of https://github.com/openfrontio/OpenFrontIO (~/srv/openfront).
#
#   cd ~/srv/openfront && git pull && docker build -t openfront-selfhost .
#   sh run.sh
#
# The Cloudflare Tunnel (/etc/cloudflared/config.yml) sends
# openfront.andrenijman.com to 127.0.0.1:8796. api.openfront.andrenijman.com is
# the stub Worker in api-stub/ (why it exists is in its header).
#
# GAME_ENV=dev is what lets it run without OpenFront's API: joins take no
# Turnstile token and identities are the browser's own persistent id. It also
# drops the three-per-IP cap on public games. Nothing else; the game is the same.
# DOMAIN must be the public name: the page derives its game host from it.
# The Turnstile key is Cloudflare's always-pass test key; dev never renders it,
# but the server refuses to start without one.
set -eu
cd "${OPENFRONT_DIR:-$HOME/srv/openfront}"
docker rm -f openfront 2>/dev/null || true
docker run -d --name openfront --restart unless-stopped \
  --cpus=3 --memory=2g \
  -p 127.0.0.1:8796:80 \
  -e GAME_ENV=dev \
  -e DOMAIN=openfront.andrenijman.com \
  -e NUM_WORKERS=2 \
  -e TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  -e GIT_COMMIT="$(git rev-parse HEAD)" \
  "${OPENFRONT_IMAGE:-openfront-selfhost}"
