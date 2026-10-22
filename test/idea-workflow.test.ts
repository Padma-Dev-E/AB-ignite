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
  users,
} from "../src/db/schema";
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
    role: "user",
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
