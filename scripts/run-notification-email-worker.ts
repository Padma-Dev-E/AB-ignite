import "dotenv/config";
import { processNotificationEmailBatch } from "../src/lib/notifications/email-worker";

async function run() {
  while (true) {
    const result = await processNotificationEmailBatch();
    if (result.status !== "processed") break;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

run().catch(() => { process.exitCode = 1; });
