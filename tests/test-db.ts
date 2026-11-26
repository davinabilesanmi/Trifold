import fs from "node:fs";
import path from "node:path";

function fromEnvFile() {
  const file = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, "utf8").split("\n").find((l) => l.startsWith("TEST_DATABASE_URL="));
  return line?.slice("TEST_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
}

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? fromEnvFile() ?? "postgresql://trifold:trifold@localhost:5432/trifold_test";
