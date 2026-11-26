#!/usr/bin/env bash
# Builds the app and assembles a folder (and zip) ready to upload to cPanel's
# "Setup Node.js App". Usage: npm run package:cpanel
set -euo pipefail
cd "$(dirname "$0")/.."

npx prisma generate
npx next build

OUT=dist/trifold-cpanel
rm -rf dist && mkdir -p "$OUT"
# The self-contained server, its static files and the public folder (logo etc.).
cp -R .next/standalone/. "$OUT/"
mkdir -p "$OUT/.next" && cp -R .next/static "$OUT/.next/static"
cp -R public "$OUT/public"
# Schema and migrations, for reference and for running migrations from the server if needed.
mkdir -p "$OUT/prisma" && cp -R prisma/schema.prisma prisma/migrations "$OUT/prisma/"
# Passenger restarts the app when this file is touched.
mkdir -p "$OUT/tmp" && touch "$OUT/tmp/restart.txt"
cat > "$OUT/README.txt" <<'TXT'
Trifold Global - cPanel package
Application startup file: server.js
Set DATABASE_URL, DIRECT_URL and NODE_ENV=production in the Node.js app's environment variables.
Full instructions: DEPLOY-CPANEL.md in the GitHub repository.
TXT

(cd dist && zip -qr trifold-cpanel.zip trifold-cpanel)
echo "Package ready: dist/trifold-cpanel.zip ($(du -h dist/trifold-cpanel.zip | cut -f1))"
