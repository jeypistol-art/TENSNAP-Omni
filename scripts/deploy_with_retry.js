const { spawnSync } = require("node:child_process");

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 180_000;
const TRANSIENT_ERROR_PATTERNS = [
  /Service unavailable/i,
  /\[code:\s*7010\]/i,
  /assets-upload-session/i,
  /A request to the Cloudflare API .* failed/i,
  /internal error/i,
  /timed out/i,
  /timeout/i,
  /temporar(?:y|ily)/i,
  /network connection was lost/i,
  /fetch failed/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EAI_AGAIN/i,
  /503\b/i,
  /502\b/i,
  /504\b/i,
];

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    code: result.status ?? 1,
    output: `${result.stdout || ""}\n${result.stderr || ""}`,
  };
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isTransientDeployError(output) {
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(output));
}

function getRetryDelayMs(attempt) {
  const exponential = Math.min(BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1)), MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * 5_000);
  return exponential + jitter;
}

console.log("[deploy] building worker bundle...");
const buildResult = run("opennextjs-cloudflare", ["build"]);
if (buildResult.code !== 0) {
  process.exit(buildResult.code);
}

for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
  console.log(`[deploy] deploy attempt ${attempt}/${MAX_RETRIES}...`);
  const deployResult = run("opennextjs-cloudflare", ["deploy"]);
  if (deployResult.code === 0) {
    console.log("[deploy] success");
    process.exit(0);
  }

  const transient = isTransientDeployError(deployResult.output);
  if (!transient) {
    console.error("[deploy] failed with a non-transient error; stopping retries");
    process.exit(deployResult.code);
  }

  if (attempt < MAX_RETRIES) {
    const delayMs = getRetryDelayMs(attempt);
    console.log(`[deploy] transient Cloudflare error detected; retrying in ${Math.round(delayMs / 1000)}s...`);
    sleep(delayMs);
    continue;
  }

  console.error("[deploy] failed after max retries");
  process.exit(deployResult.code);
}
