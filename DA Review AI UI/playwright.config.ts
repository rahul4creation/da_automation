import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

loadEnvFile(path.resolve(process.cwd(), ".env"));

const appHost = process.env.APP_HOST || "127.0.0.1";
const appPort = readPort(process.env.APP_PORT, 5173);

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: `http://${appHost}:${appPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Firefox"]
  }
});

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function readPort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}
