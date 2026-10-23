import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/connection";
import { auditEvents, badges, levels, pointsBalances, pointsLedger, rewards, users, userBadges } from "../src/db/schema";
import { awardPoints, getBalance, getBadgeProgress, getLevelForPoints } from "../src/lib/rewards/service";
import { hashAuditValue } from "../src/lib/audit/redaction-core";

let userId = 0;

before(async () => {
  const [user] = await db.insert(users).values({
    name: "Rewards Domain User",
    email: `rewards-domain-${Date.now()}@example.test`,
    role: "employee",
    passwordHash: "test-hash",
  }).returning({ id: users.id }).all();
  userId = user.id;
});

after(async () => {
  if (userId) await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, userId));
});

test("awards points idempotently and maintains the projection without reading users.points", async () => {
  const first = await awardPoints({
    userId,
    amount: 50,
    eventType: "idea_submission",
    sourceType: "idea",
    sourceId: "idea-1",
    idempotencyKey: `points-${Date.now()}`,
    ipAddress: "10.0.0.1",
    userAgent: "rewards-test-agent",
  });
  const replay = await awardPoints({
    userId,
    amount: 50,
    eventType: "idea_submission",
    sourceType: "idea",
    sourceId: "idea-1",
    idempotencyKey: first.ledger.idempotencyKey,
  });

  assert.equal(first.ledger.id, replay.ledger.id);
  assert.equal((await getBalance(userId)).balance, 50);
  assert.equal((await db.select().from(pointsLedger).where(eq(pointsLedger.userId, userId)).all()).length, 1);
  assert.equal((await db.select().from(pointsBalances).where(eq(pointsBalances.userId, userId)).all())[0]?.balance, 50);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "points.ledger.appended"), eq(auditEvents.targetId, String(first.ledger.id)))).all()).length, 1);
  const [audit] = await db.select().from(auditEvents).where(and(eq(auditEvents.action, "points.ledger.appended"), eq(auditEvents.targetId, String(first.ledger.id)))).all();
  assert.equal(audit?.ipHash, hashAuditValue("10.0.0.1"));
  assert.equal(audit?.userAgentHash, hashAuditValue("rewards-test-agent"));
});

test("level and badge projections read deterministically", async () => {
  const level = await getLevelForPoints(50);
  assert.ok(level);
  assert.equal(level?.name, "Ignite Starter");
  const progress = await getBadgeProgress(userId);
  assert.ok(progress.some((badge) => badge.code === "first-idea"));
});

test("negative point changes cannot create a negative balance", async () => {
  await assert.rejects(
    awardPoints({
      userId,
      amount: -51,
      eventType: "invalid_negative_award",
      sourceType: "test",
      sourceId: "negative-points-rejected",
      idempotencyKey: `overspend-${Date.now()}`,
    }),
    /positive integer/i,
  );
  assert.equal((await getBalance(userId)).balance, 50);
});

test("positive awards must match an active points rule", async () => {
  await assert.rejects(
    awardPoints({
      userId,
      amount: 49,
      eventType: "idea_submission",
      sourceType: "idea",
      sourceId: "idea-rule-mismatch",
      idempotencyKey: `points-rule-mismatch-${Date.now()}`,
    }),
    /match the active rule/i,
  );
});
