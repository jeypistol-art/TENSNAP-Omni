const { spawnSync } = require("node:child_process");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000;

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

console.log(`[deploy] building worker bundle...`);
const buildCode = run("opennextjs-cloudflare", ["build"]);
if (buildCode !== 0) {
  process.exit(buildCode);
}

for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
  console.log(`[deploy] deploy attempt ${attempt}/${MAX_RETRIES}...`);
  const deployCode = run("opennextjs-cloudflare", ["deploy"]);
  if (deployCode === 0) {
    console.log("[deploy] success");
    process.exit(0);
  }
  if (attempt < MAX_RETRIES) {
    console.log(`[deploy] failed; retrying in ${RETRY_DELAY_MS / 1000}s...`);
    sleep(RETRY_DELAY_MS);
  } else {
    console.error("[deploy] failed after max retries");
    process.exit(deployCode);
  }
}
