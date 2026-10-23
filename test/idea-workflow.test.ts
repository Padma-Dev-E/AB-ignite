import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/connection";
import {
  aiRuns,
  ideaAiResults,
  ideaEvents,
  ideaReviews,
  ideaVersions,
  ideas,
  notifications,
  users,
} from "../src/db/schema";
import { AiProviderError } from "../src/lib/ai/errors";
import { processNextAiRun } from "../src/lib/ai/worker";
import {
  canTransitionIdeaStatus,
  runIdeaScreeningWorkflow,
  transitionIdeaStatus,
} from "../src/lib/ideas/workflow";
import {
  appendIdeaEvent,
  claimNextAiRun,
  completeAiRun,
  createAiRun,
  createIdeaVersion,
  getAuthorizedIdeaSnapshot,
  recordHumanReview,
} from "../src/lib/ideas/repository";

let userId = 0;
let otherUserId = 0;
let ideaId = 0;
let versionId = 0;

before(async () => {
  const [user] = await db.insert(users).values({
    name: "Workflow Test User",
    email: `workflow-${Date.now()}@example.test`,
    role: "admin",
    profile: "admin",
    passwordHash: "test-hash",
  }).returning({ id: users.id }).all();
  userId = user.id;

  const [otherUser] = await db.insert(users).values({
    name: "Other Workflow User",
    email: `workflow-other-${Date.now()}@example.test`,
    role: "user",
    passwordHash: "test-hash",
  }).returning({ id: users.id }).all();
  otherUserId = otherUser.id;

  const [idea] = await db.insert(ideas).values({
    authorId: userId,
    title: "Workflow test idea",
    summary: "A test idea used for repository behavior.",
    category: "Operations",
    reference: `WF-${Date.now()}`,
  }).returning({ id: ideas.id }).all();
  ideaId = idea.id;
});

after(async () => {
  if (ideaId) await db.delete(ideas).where(eq(ideas.id, ideaId));
  if (otherUserId) await db.delete(users).where(eq(users.id, otherUserId));
  if (userId) await db.delete(users).where(eq(users.id, userId));
});

test("creates immutable idea versions and authorized snapshots", async () => {
  const version = await createIdeaVersion({
    ideaId,
    authorId: userId,
    version: 1,
    kind: "idea",
    title: "Workflow test idea",
    summary: "A test idea used for repository behavior.",
    category: "Operations",
    dataClassification: "internal",
    contentHash: "hash-v1",
  });

  assert.equal(version.version, 1);
  versionId = version.id;
  versionId = version.id;
  assert.equal((await getAuthorizedIdeaSnapshot({ kind: "user", id: String(userId) }, ideaId))?.idea.id, ideaId);
  assert.equal(await getAuthorizedIdeaSnapshot({ kind: "user", id: String(otherUserId) }, ideaId), null);
  assert.equal((await getAuthorizedIdeaSnapshot({ kind: "admin", id: String(otherUserId) }, ideaId))?.idea.id, ideaId);
});

test("AI run idempotency returns the original run and supports claim/complete", async () => {
  const input = {
    ideaId,
    ideaVersionId: versionId,
    jobKey: "idea.preflight",
    jobVersion: "1",
    promptVersion: "1",
    model: "test-model",
    idempotencyKey: `workflow-run-${Date.now()}`,
    correlationId: "corr-workflow",
    requestedBy: userId,
    inputHash: "input-hash",
  } as const;
  const first = await createAiRun(input);
  const duplicate = await createAiRun(input);
  assert.equal(duplicate.id, first.id);

  const claimed = await claimNextAiRun("worker-test", new Date());
  assert.equal(claimed?.id, first.id);
  assert.equal(claimed?.status, "running");
  assert.equal(claimed?.attemptCount, 1);

  await completeAiRun(first.id, {
    resultJson: JSON.stringify({ safe: true }),
    usageJson: JSON.stringify({ inputTokens: 3, outputTokens: 4 }),
    finishReason: "STOP",
  });
  const [completed] = await db.select().from(aiRuns).where(eq(aiRuns.id, first.id)).all();
  const [result] = await db.select().from(ideaAiResults).where(eq(ideaAiResults.runId, first.id)).all();
  assert.equal(completed.status, "succeeded");
  assert.equal(result.jobKey, "idea.preflight");
});

test("events and human reviews are append-only records", async () => {
  const event = await appendIdeaEvent({
    ideaId,
    actorType: "user",
    actorId: userId,
    eventType: "submitted",
    toStatus: "screening",
    correlationId: "corr-event",
    metadataJson: JSON.stringify({ source: "test" }),
  });
  const review = await recordHumanReview({
    ideaId,
    reviewerId: userId,
    decision: "returned",
    reason: "Needs baseline evidence.",
    conflictAcknowledged: true,
  });
  assert.equal(event.eventType, "submitted");
  assert.equal(review.decision, "returned");
  assert.equal((await db.select().from(ideaEvents).where(eq(ideaEvents.id, event.id)).all()).length, 1);
  assert.equal((await db.select().from(ideaReviews).where(eq(ideaReviews.id, review.id)).all()).length, 1);
});

test("workflow policy allows only authorized human/system transitions", async () => {
  assert.equal(canTransitionIdeaStatus({ kind: "system" }, "screening", "business_review"), true);
  assert.equal(canTransitionIdeaStatus({ kind: "ai" }, "screening", "business_review"), false);
  assert.equal(canTransitionIdeaStatus({ kind: "admin", id: String(userId) }, "decision", "implemented"), false);
  assert.equal(canTransitionIdeaStatus({ kind: "admin", id: String(userId) }, "decision", "poc"), true);

  const updated = await transitionIdeaStatus({ kind: "admin", id: String(userId) }, ideaId, "business_review", "Automated preflight is complete.");
  assert.equal(updated.status, "business_review");
  await assert.rejects(
    transitionIdeaStatus({ kind: "ai" }, ideaId, "control_review", "AI suggested control review."),
    /not authorized|transition/i,
  );
});

test("each lifecycle transition notifies the author, with a distinct acceptance message", async () => {
  const lifecycleIdea = await db.insert(ideas).values({ authorId: userId, title: "Lifecycle notification idea", summary: "Verify notification delivery through each workflow stage.", category: "Operations", reference: `LIFECYCLE-${Date.now()}` }).returning().get();
  const transitions = ["business_review", "control_review", "decision", "poc", "implementation", "implemented"] as const;
  let status = "screening";
  for (const next of transitions) {
    await transitionIdeaStatus({ kind: "admin", id: String(userId) }, lifecycleIdea.id, next, `Advance to ${next} with review evidence.`);
    status = next;
  }
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).all();
  const lifecycleRows = rows.filter((item) => item.link === `/ideas/${lifecycleIdea.id}`);
  assert.equal(lifecycleRows.length, transitions.length);
  assert.equal(lifecycleRows.filter((item) => item.type === "idea_accepted" && (item.body ?? "").startsWith(`Congratulations, ${lifecycleIdea.reference} has been accepted`)).length, 1);
  assert.equal(status, "implemented");
  await db.delete(ideas).where(eq(ideas.id, lifecycleIdea.id));
});

test("workflow stages require the matching assigned governance profile", async () => {
  const { canTransitionIdeaStatus } = await import("../src/lib/ideas/workflow");
  assert.equal(canTransitionIdeaStatus({ kind: "reviewer", id: String(userId) }, "screening", "business_review"), true);
  assert.equal(canTransitionIdeaStatus({ kind: "business_owner", id: String(userId) }, "business_review", "control_review"), true);
  assert.equal(canTransitionIdeaStatus({ kind: "control", id: String(userId) }, "control_review", "decision"), true);
  assert.equal(canTransitionIdeaStatus({ kind: "management", id: String(userId) }, "decision", "poc"), false);
  assert.equal(canTransitionIdeaStatus({ kind: "employee", id: String(userId) }, "decision", "poc"), false);
});

test("every accepted lifecycle transition notifies the idea author with the destination", async () => {
  const [lifecycleIdea] = await db.insert(ideas).values({ authorId: userId, title: "Lifecycle stages idea", summary: "A separate record for lifecycle notification assertions.", category: "Operations", reference: `LIFECYCLE-STAGES-${Date.now()}` }).returning().all();
  const stages = ["business_review", "control_review", "decision", "poc", "implementation", "implemented"] as const;
  for (const status of stages) {
    const from = status === "business_review" ? "screening" : status === "control_review" ? "business_review" : status === "decision" ? "control_review" : status === "poc" ? "decision" : status === "implementation" ? "poc" : "implementation";
    await db.update(ideas).set({ status: from }).where(eq(ideas.id, lifecycleIdea.id)).run();
    const beforeCount = (await db.select().from(notifications).where(eq(notifications.userId, userId)).all()).length;
    await transitionIdeaStatus({ kind: "admin", id: String(userId) }, lifecycleIdea.id, status, "Lifecycle transition test reason.");
    const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).all();
    assert.equal(rows.length, beforeCount + 1);
    assert.match(rows.at(-1)!.body ?? "", new RegExp(status.replaceAll("_", " "), "i"));
  }
  await db.delete(ideas).where(eq(ideas.id, lifecycleIdea.id));
});

test("screening workflow queues a preflight run and worker processes it once", async () => {
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_MODEL = "configured-test-model";
  const configuredKey = `configured-model-${Date.now()}`;
  await runIdeaScreeningWorkflow(ideaId, versionId, { kind: "admin", id: String(userId) }, configuredKey);
  const [configuredRun] = await db.select().from(aiRuns).where(eq(aiRuns.idempotencyKey, configuredKey)).all();
  assert.equal(configuredRun.model, "configured-test-model");
  if (previousModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = previousModel;
  const outcome = await processNextAiRun("workflow-worker", {
    provider: {
      generateStructured: async () => ({
        text: JSON.stringify({
          decision: "allow",
          safeToProcess: true,
          missingFields: [],
          piiFound: false,
          secretFound: false,
          promptInjectionDetected: false,
          duplicateCandidates: [],
          notes: [],
        }),
      }),
    },
  });
  assert.equal(outcome.status, "succeeded");
  assert.equal((await processNextAiRun("workflow-worker", { provider: { generateStructured: async () => ({ text: "{}" }) } })).status, "idle");
});

test("worker retries a transient run and dead-letters after the configured bound", async () => {
  const idempotencyKey = `worker-failure-${Date.now()}`;
  await runIdeaScreeningWorkflow(ideaId, versionId, { kind: "admin", id: String(userId) }, idempotencyKey);
  const failingProvider = { generateStructured: async () => { throw new AiProviderError("transient", "temporary"); } };
  const first = await processNextAiRun("failure-worker", { provider: failingProvider, maxAttempts: 2 });
  assert.equal(first.status, "retry_scheduled");
  await new Promise((resolve) => setTimeout(resolve, 300));
  const second = await processNextAiRun("failure-worker", { provider: failingProvider, maxAttempts: 2 });
  assert.equal(second.status, "failed");
});

test("worker converts an unknown persisted job into a failed run", async () => {
  const [run] = await db.insert(aiRuns).values({
    ideaId,
    ideaVersionId: versionId,
    jobKey: "unknown.persisted.job",
    jobVersion: "1",
    promptVersion: "1",
    model: "test-model",
    idempotencyKey: `unknown-job-${Date.now()}`,
    correlationId: "unknown-job",
    requestedBy: userId,
    inputHash: "unknown-job",
  }).returning().all();
  const outcome = await processNextAiRun("unknown-job-worker", { provider: { generateStructured: async () => ({ text: "{}" }) } });
  assert.equal(outcome.status, "failed");
  const [failed] = await db.select().from(aiRuns).where(eq(aiRuns.id, run.id)).all();
  assert.equal(failed.status, "failed");
});

test("deleting an idea cleans up its workflow records", async () => {
  const [version] = await db.insert(ideaVersions).values({
    ideaId,
    authorId: userId,
    version: 99,
    kind: "idea",
    title: "Cleanup version",
    summary: "Cleanup test version.",
    category: "Operations",
    dataClassification: "internal",
    contentHash: "cleanup-hash",
  }).returning({ id: ideaVersions.id }).all();
  const [run] = await db.insert(aiRuns).values({
    ideaId,
    ideaVersionId: version.id,
    jobKey: "idea.cleanup",
    jobVersion: "1",
    promptVersion: "1",
    model: "test-model",
    idempotencyKey: `cleanup-${Date.now()}`,
    correlationId: "cleanup",
    inputHash: "cleanup",
  }).returning({ id: aiRuns.id }).all();
  await db.delete(ideas).where(eq(ideas.id, ideaId));
  assert.equal((await db.select().from(ideaVersions).where(eq(ideaVersions.id, version.id)).all()).length, 0);
  assert.equal((await db.select().from(aiRuns).where(eq(aiRuns.id, run.id)).all()).length, 0);
  ideaId = 0;
});
