import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/connection";
import { auditEvents, redemptions, rewardEvents, rewards, users } from "../src/db/schema";
import { awardPoints, cancelRedemption, createReward, fulfillRedemption, getBalance, requestRedemption, updateReward } from "../src/lib/rewards/service";

let userId = 0;
let adminId = 0;
let rewardId = 0;

before(async () => {
  const [user] = await db.insert(users).values({ name: "Rewards Employee", email: `rewards-employee-${Date.now()}@example.test`, role: "user", passwordHash: "test-hash" }).returning({ id: users.id }).all();
  const [admin] = await db.insert(users).values({ name: "Rewards Admin", email: `rewards-admin-${Date.now()}@example.test`, role: "admin", passwordHash: "test-hash" }).returning({ id: users.id }).all();
  userId = user.id;
  adminId = admin.id;
  await awardPoints({ userId, amount: 100, eventType: "test_grant", sourceType: "test", sourceId: String(userId), idempotencyKey: `grant-${Date.now()}` });
  const reward = await createReward({ actorUserId: adminId, name: "Coffee", description: "A coffee voucher", kind: "redeem", cost: 75, reason: "Seed reward for focused test" });
  rewardId = reward.reward.id;
});

after(async () => {
  if (adminId) await db.delete(users).where(eq(users.id, adminId));
  if (userId) await db.delete(users).where(eq(users.id, userId));
});

test("redemption snapshots cost, deducts once, and replays idempotently", async () => {
  const key = `redeem-${Date.now()}`;
  const first = await requestRedemption({ userId, rewardId, idempotencyKey: key });
  const replay = await requestRedemption({ userId, rewardId, idempotencyKey: key });
  assert.equal(first.redemption.id, replay.redemption.id);
  assert.equal(first.redemption.cost, 75);
  assert.equal((await getBalance(userId)).balance, 25);
  assert.equal((await db.select().from(redemptions).where(eq(redemptions.userId, userId)).all()).length, 1);
  assert.equal((await db.select().from(rewardEvents).where(eq(rewardEvents.redemptionId, first.redemption.id)).all()).length, 1);
});

test("reward edits do not alter a historical redemption snapshot and cancellation refunds once", async () => {
  await updateReward({ actorUserId: adminId, rewardId, name: "Coffee Plus", description: "A larger voucher", kind: "redeem", cost: 90, active: true, reason: "Update catalogue test" });
  const [historical] = await db.select().from(redemptions).where(eq(redemptions.userId, userId)).limit(1).all();
  assert.equal(historical.rewardName, "Coffee");
  assert.equal(historical.cost, 75);
  const first = await cancelRedemption({ actorUserId: adminId, redemptionId: historical.id, reason: "Requested cancellation", idempotencyKey: `cancel-${Date.now()}` });
  const replay = await cancelRedemption({ actorUserId: adminId, redemptionId: historical.id, reason: "Requested cancellation", idempotencyKey: first.event.idempotencyKey });
  assert.equal(first.redemption.status, "cancelled");
  assert.equal(replay.redemption.id, first.redemption.id);
  assert.equal((await getBalance(userId)).balance, 100);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "rewards.redemption.cancelled"), eq(auditEvents.targetId, String(historical.id)))).all()).length, 1);
});

test("only requested redemptions can be fulfilled", async () => {
  const result = await requestRedemption({ userId, rewardId, idempotencyKey: `redeem-fulfill-${Date.now()}` });
  const fulfilled = await fulfillRedemption({ actorUserId: adminId, redemptionId: result.redemption.id, reason: "Fulfilment test", idempotencyKey: `fulfill-${Date.now()}` });
  assert.equal(fulfilled.redemption.status, "fulfilled");
  await assert.rejects(cancelRedemption({ actorUserId: adminId, redemptionId: result.redemption.id, reason: "Too late", idempotencyKey: `cancel-after-${Date.now()}` }), /requested|fulfilled/i);
});
