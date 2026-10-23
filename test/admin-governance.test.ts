import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/connection";
import { auditEvents, ideaEvents, ideaReviews, ideaSubmissions, ideas, notifications, refreshTokens, users } from "../src/db/schema";
import { decideGovernance, getEvaluation, listRoutedEvaluations, listScreeningQueue, listTransformationQueue } from "../src/lib/admin/governance/service";

let adminId = 0;
let ownerId = 0;
let authorId = 0;
let sessionId = 0;
let ideaId = 0;
let reference = "";

before(async () => {
  const stamp = Date.now();
  const [admin] = await db.insert(users).values({ name: "Governance admin", email: `gov-admin-${stamp}@example.test`, role: "admin", passwordHash: "test" }).returning({ id: users.id }).all();
  const [owner] = await db.insert(users).values({ name: "Business owner", email: `gov-owner-${stamp}@example.test`, passwordHash: "test" }).returning({ id: users.id }).all();
  const [author] = await db.insert(users).values({ name: "Idea author", email: `gov-author-${stamp}@example.test`, passwordHash: "test" }).returning({ id: users.id }).all();
  adminId = admin.id; ownerId = owner.id; authorId = author.id;
  const [session] = await db.insert(refreshTokens).values({ userId: adminId, tokenHash: `gov-${stamp}`, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).all();
  sessionId = session.id;
  reference = `GOV-${stamp}`;
  const [idea] = await db.insert(ideas).values({ authorId, title: "Governance queue idea", summary: "An idea for exercising the administrative workflow.", category: "Operations", reference }).returning({ id: ideas.id }).all();
  ideaId = idea.id;
  await db.insert(ideaSubmissions).values({ ideaId, answersJson: JSON.stringify({ beneficiaries: "Customers", currentProcess: "Manual", needed: "Automation", risks: "Errors", successMeasure: "Fewer delays" }), metricsJson: JSON.stringify({ turnaround: 2, volume: 3, value: 1, turnaroundExplanation: "Saves time", volumeExplanation: "Many cases", valueExplanation: "Reduced cost" }), score: 1.9, minimumScore: 1, validationPassed: true, submittedAt: new Date() }).run();
});

const actor = () => ({ userId: adminId, sessionId });

test("governance queues expose screening and owner-approved ideas with bounded pages", async () => {
  assert.equal((await listScreeningQueue(1)).items.some((idea) => idea.id === ideaId), true);
  await decideGovernance(actor(), ideaId, "route", "Route for owner review", ownerId);
  assert.equal((await listTransformationQueue(10)).items.some((idea) => idea.id === ideaId), false);
  assert.equal((await listRoutedEvaluations({ ...actor(), userId: ownerId }, 10)).items.some((idea) => idea.id === ideaId), true);
  assert.equal((await listRoutedEvaluations({ ...actor(), userId: authorId }, 10)).items.some((idea) => idea.id === ideaId), false);
});

test("evaluation includes submission breakdown and decisions notify and append audit events", async () => {
  const detail = await getEvaluation(ideaId);
  assert.equal(detail.submission?.score, 1.9);
  assert.equal((detail.submission?.metrics as Record<string, unknown>).turnaroundExplanation, "Saves time");
  await decideGovernance(actor(), ideaId, "approve", "Owner approves this proposal");
  assert.equal((await listTransformationQueue(10)).items.some((idea) => idea.id === ideaId), true);
  await decideGovernance(actor(), ideaId, "confirm", "Confirm for proof of concept");
  const [updated] = await db.select({ status: ideas.status }).from(ideas).where(eq(ideas.id, ideaId)).all();
  assert.equal(updated.status, "poc");
  assert.ok((await db.select().from(notifications).where(eq(notifications.userId, authorId)).all()).length >= 1);
  assert.ok((await db.select().from(auditEvents).where(eq(auditEvents.targetId, String(ideaId))).all()).length >= 3);
  assert.ok((await db.select().from(ideaEvents).where(eq(ideaEvents.ideaId, ideaId)).all()).length >= 3);
  assert.ok((await db.select().from(ideaReviews).where(eq(ideaReviews.ideaId, ideaId)).all()).length >= 1);
});

test("governance mutations require a reason and revalidate the administrator session", async () => {
  await assert.rejects(decideGovernance(actor(), ideaId, "defer", "  "));
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, sessionId)).run();
  await assert.rejects(decideGovernance(actor(), ideaId, "defer", "Session should be rejected"), /session/i);
});
