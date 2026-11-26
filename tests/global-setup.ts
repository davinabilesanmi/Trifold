import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "./test-db";

/** Rebuilds the test database from the migrations before the tests run. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  // Refuse to wipe anything that doesn't look like a throwaway test database.
  if (!url.pathname.includes("test")) throw new Error(`TEST_DATABASE_URL must name a test database, got ${url.pathname}`);
  const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  await db.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await db.$executeRawUnsafe("CREATE SCHEMA public");
  await db.$disconnect();
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
}
