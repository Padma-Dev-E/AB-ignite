import "dotenv/config";

import { createGeminiProvider } from "../src/lib/ai/gemini-provider-core";
import { getAiConfig } from "../src/lib/ai/config-core";
import { processNextAiRun } from "../src/lib/ai/worker";

const workerId = process.env.AI_WORKER_ID ?? `local-worker-${process.pid}`;
const runOnce = process.argv.includes("--once");
const config = getAiConfig();
const provider = config.apiKey ? createGeminiProvider(config) : undefined;
let stopping = false;

function stop() {
  stopping = true;
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function run() {
  do {
    const outcome = await processNextAiRun(workerId, { provider });
    console.log(JSON.stringify({ workerId, ...outcome }));
    if (runOnce || outcome.status === "idle") break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  } while (!stopping);
}

run().catch((error) => {
  console.error("AI worker failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
