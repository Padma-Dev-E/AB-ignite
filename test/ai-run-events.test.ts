import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/connection";
import { aiRuns, ideaVersions, ideas, users } from "../src/db/schema";
import {
  appendAiRunEvent,
  claimAiRun,
  completeAiRun,
  createAiRun,
  failAiRun,
  getAiRunEvents,
  requeueAiRun,
} from "../src/lib/ideas/repository";

let userId = 0;
let ideaId = 0;
let versionId = 0;

before(async () => {
  const [user] = await db.insert(users).values({
    name: "AI Event Test User",
    email: `ai-events-${Date.now()}@example.test`,
    passwordHash: "test-hash",
  }).returning({ id: users.id }).all();
  userId = user.id;

  const [idea] = await db.insert(ideas).values({
    authorId: userId,
    title: "AI event test idea",
    summary: "An idea used to verify safe AI progress evidence.",
    category: "Operations",
    reference: `AI-EVENT-${Date.now()}`,
  }).returning({ id: ideas.id }).all();
  ideaId = idea.id;

  const [version] = await db.insert(ideaVersions).values({
    ideaId,
    authorId: userId,
    version: 1,
    kind: "idea",
    title: "AI event test idea",
    summary: "An idea used to verify safe AI progress evidence.",
    category: "Operations",
    dataClassification: "internal",
    contentHash: "ai-event-input",
  }).returning({ id: ideaVersions.id }).all();
  versionId = version.id;
});

after(async () => {
  if (ideaId) await db.delete(ideas).where(eq(ideas.id, ideaId));
  if (userId) await db.delete(users).where(eq(users.id, userId));
});

function runInput(idempotencyKey: string) {
  return {
    ideaId,
    ideaVersionId: versionId,
    jobKey: "idea.preflight",
    jobVersion: "1",
    promptVersion: "1",
    model: "test-model",
    idempotencyKey,
    correlationId: `corr-${idempotencyKey}`,
    requestedBy: userId,
    inputHash: "input-hash",
  } as const;
}

test("AI run progress events are ordered and expose only safe metadata", async () => {
  const run = await createAiRun(runInput(`ai-event-order-${Date.now()}`));
  const claimed = await claimAiRun(run.id, "event-worker");
  assert.equal(claimed?.status, "running");

  await completeAiRun(run.id, {
    resultJson: JSON.stringify({ approved: true, sensitiveOutput: "must-not-be-an-event" }),
    usageJson: JSON.stringify({ inputTokens: 1, outputTokens: 2 }),
  });

  const events = await getAiRunEvents(ideaId, run.id);
  assert.deepEqual(events.map((event) => event.eventType), ["queued", "running", "succeeded"]);
  assert.deepEqual(events.map((event) => event.payload), [{ attempt: 0 }, { attempt: 1 }, { attempt: 1 }]);
  assert.ok(events.every((event, index) => index === 0 || events[index - 1]!.createdAt <= event.createdAt));
  assert.doesNotMatch(JSON.stringify(events), /prompt|raw|idea text|model output|credential|secret|sensitiveOutput/i);
});

test("failed runs emit a safe failure and retry trail", async () => {
  const run = await createAiRun(runInput(`ai-event-retry-${Date.now()}`));
  const claimed = await claimAiRun(run.id, "event-worker");
  assert.equal(claimed?.attemptCount, 1);

  await failAiRun(run.id, { errorCode: "provider_retry", errorMessage: "Transient provider failure with credential=redacted" });
  await requeueAiRun(run.id, { errorCode: "provider_retry", errorMessage: "Transient provider failure" }, new Date(Date.now() + 1000));

  const events = await getAiRunEvents(ideaId, run.id);
  assert.deepEqual(events.map((event) => event.eventType), ["queued", "running", "failed", "retry"]);
  assert.deepEqual(events.at(-2)?.payload, { attempt: 1, errorCode: "provider_retry" });
  assert.equal(events.at(-1)?.payload.attempt, 1);
  assert.equal("errorMessage" in events.at(-1)!.payload, false);
});

test("event appends reject unbounded or unsafe payloads", async () => {
  const run = await createAiRun(runInput(`ai-event-contract-${Date.now()}`));
  await assert.rejects(
    appendAiRunEvent(run, "failed", { attempt: 1, errorCode: "provider_retry", raw: "secret" } as never),
    /safe|payload|invalid/i,
  );
});
