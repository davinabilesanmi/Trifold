#!/usr/bin/env node
/*
 * Trifold Global: set up or update the database from the cPanel Terminal.
 *
 *   node setup-database.js
 *
 * 1. Creates or updates the tables (applies any new migrations in prisma/migrations).
 * 2. If no one can manage staff yet, asks for the owner's name, email and password
 *    and creates that account.
 *
 * The database address comes from DIRECT_URL (or DATABASE_URL). If neither is set in
 * the Terminal, the script asks you to paste it; it is used for this run only and never
 * saved. Migrations are recorded in Prisma's own "_prisma_migrations" table, so this
 * stays compatible with `prisma migrate deploy`.
 *
 * Plain JavaScript on purpose: it runs from the cPanel package with only the files
 * already in it (no npm install, no downloads).
 */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const ROOT = __dirname;
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");
const OWNER_FILE = path.join(ROOT, "setup-owner.json");

// ---------------------------------------------------------------------------
// Prompts (hidden input for secrets when run in a real terminal)

// One reader for the whole run, so answers typed (or pasted) ahead aren't lost between questions.
let rl;
const pending = [];
const waiting = [];
function reader() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
    rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : pending.push(line)));
    rl.on("close", () => { while (waiting.length) waiting.shift()(""); });
  }
  return rl;
}

function ask(question, { hidden = false } = {}) {
  const r = reader();
  const tty = !!process.stdin.isTTY;
  const write = r._writeToOutput.bind(r);
  const mask = (s) => s.replace(/[^\r\n]/g, "*");
  if (tty) {
    // Show the question as the prompt; for passwords print * instead of what's typed.
    r.setPrompt(question);
    r._writeToOutput = hidden
      ? (s) => write(s.startsWith(question) ? question + mask(s.slice(question.length)) : mask(s))
      : write;
    r.prompt();
  } else {
    process.stdout.write(`${question}\n`);
  }
  return new Promise((resolve) => {
    const done = (line) => { r._writeToOutput = write; resolve(String(line).trim()); };
    pending.length ? done(pending.shift()) : waiting.push(done);
  });
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Migrations

/** Splits a Prisma-generated migration into single statements. */
function statements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.split(/\r?\n/).filter((line) => !line.trim().startsWith("--")).join("\n").trim())
    .filter(Boolean);
}

async function migrate(db) {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  )`);
  const applied = await db.$queryRawUnsafe(
    `SELECT "migration_name", "checksum" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`,
  );
  const done = new Map(applied.map((r) => [r.migration_name, r.checksum]));
  const unfinished = await db.$queryRawUnsafe(
    `SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL`,
  );
  if (unfinished.length) {
    fail(`A previous update didn't finish (${unfinished.map((r) => r.migration_name).join(", ")}). Contact your developer before trying again.`);
  }

  const folders = fs.readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(MIGRATIONS, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();

  let count = 0;
  for (const name of folders) {
    const file = fs.readFileSync(path.join(MIGRATIONS, name, "migration.sql"));
    const checksum = crypto.createHash("sha256").update(file).digest("hex");
    if (done.has(name)) {
      if (done.get(name) !== checksum) console.warn(`  ! ${name} has changed since it was applied (left as it is).`);
      continue;
    }
    process.stdout.write(`  Applying ${name} … `);
    const steps = statements(file.toString("utf8"));
    const started = new Date();
    // All or nothing: Postgres can undo table changes if any step fails.
    await db.$transaction(async (tx) => {
      for (const step of steps) await tx.$executeRawUnsafe(step);
      await tx.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
         VALUES ($1, $2, now(), $3, $4, 1)`,
        crypto.randomUUID(), checksum, name, started,
      );
    }, { timeout: 120_000, maxWait: 30_000 });
    console.log("done");
    count += 1;
  }
  console.log(count ? `✓ ${count} update(s) applied.` : "✓ Tables are already up to date.");
}

// ---------------------------------------------------------------------------
// Owner account

async function ensureOwner(db) {
  const { permissions, role } = JSON.parse(fs.readFileSync(OWNER_FILE, "utf8"));
  const admins = await db.user.count({ where: { active: true, permissions: { contains: "manageUsers" } } });
  if (admins > 0) {
    console.log("✓ An owner/admin account already exists, so none was created.");
    return;
  }
  console.log("\nNo one can sign in yet. Create the owner account (you can change everything later):");
  const name = process.env.OWNER_NAME || (await ask("  Full name: "));
  const email = (process.env.OWNER_EMAIL || (await ask("  Email (used to sign in): "))).toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Please enter a name and a valid email address.");
  let password = process.env.OWNER_PASSWORD;
  if (!password) {
    password = await ask("  Password (at least 8 characters, hidden): ", { hidden: true });
    const again = await ask("  Type the password again: ", { hidden: true });
    if (password !== again) fail("The passwords didn't match. Run the command again.");
  }
  if (password.length < 8) fail("The password must be at least 8 characters.");

  // The package carries bcryptjs's ES module build (the one the app uses), so import it that way.
  const mod = await import("bcryptjs");
  const bcrypt = mod.default ?? mod;
  await db.user.create({
    data: { name, email, jobTitle: "Owner / MD", role, permissions, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`✓ Owner account created for ${email}.`);
}

// ---------------------------------------------------------------------------

/** Reads settings a host saved in a .env file next to this script (environment variables win). */
function loadEnvFile() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let value = m[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    process.env[m[1]] = value;
  }
}

async function main() {
  console.log("\nTrifold Global: database setup\n");
  loadEnvFile();
  let url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log("Paste the Supabase *Session pooler* connection string (port 5432), with your password in it.");
    console.log("It is used for this run only and is not saved.");
    url = await ask("  Connection string (hidden): ", { hidden: true });
  }
  if (!/^postgres(ql)?:\/\//.test(url)) fail("That doesn't look like a Postgres connection string (it should start with postgresql://).");
  if (url.includes("[YOUR-PASSWORD]")) fail("Replace [YOUR-PASSWORD] in the connection string with your database password.");
  // pgbouncer's transaction mode can't run table changes; the session pooler (5432) can.
  if (/:6543\//.test(url)) console.warn("  ! This looks like the transaction pooler (port 6543). If setup fails, use the Session pooler (port 5432).");

  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$queryRawUnsafe("SELECT 1");
  } catch (e) {
    fail(`Couldn't connect to the database.\n  ${String(e.message).split("\n").filter(Boolean).pop()}\n  Check the connection string and password, and ask your host to allow outgoing ports 5432 and 6543.`);
  }
  console.log("✓ Connected to the database.");
  try {
    await migrate(db);
    await ensureOwner(db);
    console.log("\nAll done. Restart the app in Setup Node.js App, then sign in.\n");
  } catch (e) {
    fail(`Setup stopped: ${e.message}`);
  } finally {
    await db.$disconnect();
    if (rl) rl.close();
  }
}

main();
