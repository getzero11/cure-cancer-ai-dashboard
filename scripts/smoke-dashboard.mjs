import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 3100;
const url = `http://127.0.0.1:${port}/api/dashboard?cancerType=all`;
const nextBin = "node_modules/next/dist/bin/next";
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, CCWAI_API_KEY: "" },
  stdio: "ignore",
});

function stopServer() {
  if (!server.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

try {
  let response;
  let lastError;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      response = await fetch(url, { cache: "no-store" });
      if (response.ok) break;
      lastError = new Error(`Dashboard returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!response?.ok) {
    throw lastError ?? new Error("Dashboard did not become ready.");
  }

  const payload = await response.json();
  const trials = payload?.datasets?.clinicalTrials;
  const research = payload?.datasets?.research;
  assert.equal(payload.mode, "demo");
  assert.ok(Array.isArray(trials?.items), "clinical-trials items must be an array");
  assert.ok(trials.items.length > 0, "preview response must include trial rows");
  assert.ok(trials.items[0].nctId, "trial rows must include an NCT identifier");
  assert.ok(Array.isArray(research?.items), "research items must be an array");
  assert.ok(research.items.length >= 4, "preview response must include dated research activity");
  assert.ok(new Set(research.items.map((item) => item.publicationDate?.slice(0, 10))).size >= 4, "preview research activity must span multiple days");
  console.log("Dashboard smoke test passed: clinical-trials rows and research activity are available.");
} finally {
  stopServer();
}
