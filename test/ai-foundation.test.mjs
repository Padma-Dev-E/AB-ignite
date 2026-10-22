import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("AI foundation declares server-side SDK dependencies and scripts", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.ok(packageJson.dependencies["@google/genai"]);
  assert.ok(packageJson.dependencies.zod);
  assert.equal(packageJson.scripts["test:ai"], "tsx --test test/*.test.ts");
  assert.equal(packageJson.scripts["ai:worker"], "tsx scripts/run-ai-worker.ts");
});

test("AI environment configuration is server-only and complete", async () => {
  const env = await source(".env.example");
  const config = await source("src/lib/ai/config.ts");

  for (const variable of [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "GEMINI_API_BASE_URL",
    "GEMINI_TIMEOUT_MS",
    "GEMINI_MAX_ATTEMPTS",
    "GEMINI_RETRY_INITIAL_DELAY_MS",
    "GEMINI_RETRY_MAX_DELAY_MS",
    "GEMINI_MAX_OUTPUT_TOKENS",
    "GEMINI_TEMPERATURE",
    "AI_MAX_INPUT_CHARS",
    "AI_MAX_OUTPUT_BYTES",
    "AI_ALLOWED_DATA_CLASSIFICATION",
    "AI_LOG_SENSITIVE",
    "AI_RATE_LIMIT_PER_USER",
    "AI_GLOBAL_CONCURRENCY",
    "AI_RETENTION_DAYS",
  ]) {
    assert.match(env, new RegExp(`^${variable}=`, "m"), `missing ${variable}`);
  }

  assert.match(config, /server-only/);
  assert.match(config, /GEMINI_API_KEY/);
  assert.match(config, /GOOGLE_API_KEY/);
  assert.doesNotMatch(env, /^NEXT_PUBLIC_GEMINI/m);
});

test("Gemini provider entrypoint is server-only", async () => {
  const provider = await source("src/lib/ai/gemini-provider.ts");
  assert.match(provider, /import\s+['"]server-only['"]/);
});
