import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB_FILE = path.resolve(__dirname, "../prisma/test.db");

export default function setup() {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) fs.rmSync(f, { force: true });
  process.env.DATABASE_URL = `file:${DB_FILE}`;
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: process.env });
}
