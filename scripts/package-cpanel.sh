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
# Next copies local .env files into the build; never ship them. On the server the
# settings come from the Node.js app's environment variables only.
find "$OUT" -maxdepth 1 -name ".env*" -delete
mkdir -p "$OUT/.next" && cp -R .next/static "$OUT/.next/static"
cp -R public "$OUT/public"
# Schema, migrations and the database setup command (run from the cPanel Terminal).
mkdir -p "$OUT/prisma" && cp -R prisma/schema.prisma prisma/migrations "$OUT/prisma/"
cp scripts/setup-database.js "$OUT/setup-database.js"
# The owner preset's responsibilities, so the setup command matches the app exactly.
npx tsx -e 'import { ROLE_PRESETS, serializePermissions } from "./lib/permissions"; console.log(JSON.stringify({ role: "OWNER", permissions: serializePermissions(ROLE_PRESETS.OWNER) }))' > "$OUT/setup-owner.json"
# Passenger restarts the app when this file is touched.
mkdir -p "$OUT/tmp" && touch "$OUT/tmp/restart.txt"
cat > "$OUT/README.txt" <<'TXT'
Trifold Global - cPanel package
Application startup file: server.js
Set DATABASE_URL, DIRECT_URL and NODE_ENV=production in the Node.js app's environment variables.
Set up or update the database from the cPanel Terminal:  node setup-database.js
Full instructions: DEPLOY-CPANEL.md in the GitHub repository.
TXT

if find "$OUT" -name ".env*" -not -path "*/node_modules/*" | grep -q .; then echo "A .env file is still in the package; stopping." >&2; exit 1; fi
(cd dist && zip -qr trifold-cpanel.zip trifold-cpanel)
echo "Package ready: dist/trifold-cpanel.zip ($(du -h dist/trifold-cpanel.zip | cut -f1))"
