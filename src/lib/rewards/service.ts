import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  auditEvents,
  badges,
  redemptions,
  rewardEvents,
  rewardVersions,
  rewards,
  pointsLedger,
  userBadges,
} from "../../db/schema";
import { buildRewardsAuditRecord } from "./audit";
import { db } from "../../db/connection";
import {
  addRewardEvent,
  appendLedgerEntry,
  ensureBalanceProjection,
  getBalance as getBalanceRecord,
  getCurrentRewardVersion,
  getActivePointRule,
  getLevelForPoints as getLevelRecord,
  getRedemptionByIdempotency,
  listAdminRedemptions,
  listAllRewards,
  listBadgeProgress,
  listPointHistory,
  listRewardCatalogue,
  listRewardRedemptions,
  withRewardsTransaction,
  type RewardsTx,
} from "./repository";
import { RewardsError } from "./errors";
import { parseBadgeRule, REWARD_KINDS, type RewardKind } from "./rules";

export type PointsActor = {
  actorUserId?: number | null;
  sessionId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AwardPointsInput = PointsActor & {
  userId: number;
  amount: number;
  eventType: string;
  sourceType: string;
  sourceId?: string | null;
  idempotencyKey: string;
  metadata?: unknown;
};

function validId(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) throw new RewardsError(`Invalid ${label}.`, "VALIDATION_ERROR", 400);
  return value;
}

function requiredText(value: string, label: string, max = 200) {
  const text = value.trim();
  if (!text || text.length > max) throw new RewardsError(`${label} is invalid.`, "VALIDATION_ERROR", 400);
  return text;
}

function positiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) throw new RewardsError(`${label} must be a positive integer.`, "VALIDATION_ERROR", 400);
  return value;
}

function evaluateBadgeAwards(tx: RewardsTx, userId: number, actorUserId = userId, now = new Date()) {
  const definitions = tx.select().from(badges).where(eq(badges.active, true)).orderBy(asc(badges.id)).all();
  const existing = new Set(tx.select({ badgeId: userBadges.badgeId }).from(userBadges).where(eq(userBadges.userId, userId)).all().map((row) => row.badgeId));
  const awarded = [];

  for (const badge of definitions) {
    if (existing.has(badge.id)) continue;
    const rule = parseBadgeRule(badge.ruleJson);
    const eventTypes = (rule.eventTypes ?? []).flatMap((eventType) => eventType === "idea_submitted" ? ["idea_submitted", "idea_submission"] : [eventType]);
    const [{ count }] = tx.select({ count: sql<number>`count(*)` })
      .from(pointsLedger)
      .where(and(eq(pointsLedger.userId, userId), inArray(pointsLedger.eventType, eventTypes)))
      .all();
    if (Number(count ?? 0) < rule.minimumCount) continue;
    const [userBadge] = tx.insert(userBadges).values({ userId, badgeId: badge.id, awardedAt: now }).onConflictDoNothing({ target: [userBadges.userId, userBadges.badgeId] }).returning().all();
    if (!userBadge) continue;
    tx.insert(auditEvents).values(buildRewardsAuditRecord({
      actorUserId,
      action: "badge.awarded",
      targetType: "user_badge",
      targetId: userBadge.id,
      metadata: { status: "awarded", reasonCode: badge.code },
    }, now)).run();
    awarded.push(userBadge);
  }
  return awarded;
}

export async function awardPoints(input: AwardPointsInput) {
  validId(input.userId, "user ID");
  const eventType = requiredText(input.eventType, "Event type", 100);
  const sourceType = requiredText(input.sourceType, "Source type", 100);
  const idempotencyKey = requiredText(input.idempotencyKey, "Idempotency key", 200);
  const result = withRewardsTransaction((tx) => {
    if (input.amount > 0) {
      const rule = getActivePointRule(tx, eventType);
      if (!rule) throw new RewardsError("No active points rule exists for this event.", "POINT_RULE_NOT_FOUND", 409);
      if (input.amount !== rule.points) throw new RewardsError("The points amount does not match the active rule.", "POINT_RULE_MISMATCH", 409);
    }
    const entry = appendLedgerEntry(tx, { ...input, eventType, sourceType, idempotencyKey });
    const awarded = evaluateBadgeAwards(tx, input.userId, input.actorUserId ?? input.userId);
    return { ...entry, awarded };
  });
  const level = await getLevelRecord(result.balance.balance);
  return { ...result, level };
}

export async function getBalance(userId: number) {
  validId(userId, "user ID");
  return getBalanceRecord(userId);
}

export async function getPointsHistory(userId: number, page = 1, pageSize = 20) {
  validId(userId, "user ID");
  return listPointHistory(userId, page, pageSize);
}

export async function getLevelForPoints(points: number) {
  if (!Number.isFinite(points) || points < 0) throw new RewardsError("Points value is invalid.", "VALIDATION_ERROR", 400);
  return getLevelRecord(Math.floor(points));
}

export async function getBadgeProgress(userId: number) {
  validId(userId, "user ID");
  withRewardsTransaction((tx) => evaluateBadgeAwards(tx, userId));
  return listBadgeProgress(userId);
}

export type RewardInput = {
  actorUserId: number;
  sessionId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  name: string;
  description?: string | null;
  kind: RewardKind;
  cost: number;
  emoji?: string | null;
  active?: boolean;
  reason: string;
};

function validateRewardInput(input: Pick<RewardInput, "name" | "kind" | "cost" | "reason">) {
  const name = requiredText(input.name, "Reward name", 160);
  const reason = requiredText(input.reason, "Reason", 500);
  if (!REWARD_KINDS.includes(input.kind)) throw new RewardsError("Reward kind is invalid.", "VALIDATION_ERROR", 400);
  if (!Number.isInteger(input.cost) || input.cost < 0) throw new RewardsError("Reward cost must be a non-negative integer.", "VALIDATION_ERROR", 400);
  return { name, reason };
}

export async function createReward(input: RewardInput) {
  const { name, reason } = validateRewardInput(input);
  validId(input.actorUserId, "actor user ID");
  return withRewardsTransaction((tx) => {
    const now = new Date();
    const [reward] = tx.insert(rewards).values({ name, description: input.description?.trim() || null, kind: input.kind, cost: input.cost, emoji: input.emoji?.trim() || null, active: input.active ?? true, createdAt: now, updatedAt: now }).returning().all();
    if (!reward) throw new RewardsError("Reward was not created.", "REWARD_WRITE_FAILED", 500);
    const [version] = tx.insert(rewardVersions).values({ rewardId: reward.id, version: 1, name: reward.name, description: reward.description, kind: reward.kind, cost: reward.cost, emoji: reward.emoji, active: reward.active, createdBy: input.actorUserId, createdAt: now }).returning().all();
    if (!version) throw new RewardsError("Reward version was not created.", "REWARD_VERSION_WRITE_FAILED", 500);
    tx.insert(auditEvents).values(buildRewardsAuditRecord({ actorUserId: input.actorUserId, sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent, action: "rewards.catalogue.created", targetType: "reward", targetId: reward.id, reason, metadata: { status: "created", resourceType: "reward" }, requiresReason: true }, now)).run();
    return { reward, version };
  });
}

export type RewardUpdateInput = Omit<RewardInput, "actorUserId" | "sessionId"> & { actorUserId: number; sessionId?: number | null; rewardId: number };

export async function updateReward(input: RewardUpdateInput) {
  const { name, reason } = validateRewardInput(input);
  validId(input.rewardId, "reward ID");
  validId(input.actorUserId, "actor user ID");
  return withRewardsTransaction((tx) => {
    const [current] = tx.select().from(rewards).where(eq(rewards.id, input.rewardId)).limit(1).all();
    if (!current) throw new RewardsError("Reward not found.", "REWARD_NOT_FOUND", 404);
    const latest = getCurrentRewardVersion(tx, current.id);
    const now = new Date();
    const [reward] = tx.update(rewards).set({ name, description: input.description?.trim() || null, kind: input.kind, cost: input.cost, emoji: input.emoji?.trim() || null, active: input.active ?? current.active, updatedAt: now }).where(eq(rewards.id, current.id)).returning().all();
    const [version] = tx.insert(rewardVersions).values({ rewardId: current.id, version: (latest?.version ?? 0) + 1, name, description: input.description?.trim() || null, kind: input.kind, cost: input.cost, emoji: input.emoji?.trim() || null, active: input.active ?? current.active, createdBy: input.actorUserId, createdAt: now }).returning().all();
    if (!reward || !version) throw new RewardsError("Reward update was not created.", "REWARD_WRITE_FAILED", 500);
    tx.insert(auditEvents).values(buildRewardsAuditRecord({ actorUserId: input.actorUserId, sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent, action: "rewards.catalogue.updated", targetType: "reward", targetId: reward.id, reason, metadata: { status: "updated", resourceType: "reward" }, requiresReason: true }, now)).run();
    return { reward, version };
  });
}

export async function getCatalogue() {
  return listRewardCatalogue();
}

export async function getAdminCatalogue() {
  return listAllRewards();
}

export async function getEmployeeRewards(userId: number) {
  const [balance, catalogue, badges] = await Promise.all([getBalance(userId), getCatalogue(), getBadgeProgress(userId)]);
  const level = await getLevelForPoints(balance.balance);
  return { balance, level, redeemable: catalogue.filter((reward) => reward.kind === "redeem"), earned: catalogue.filter((reward) => reward.kind === "earned"), badges };
}

export type RedemptionInput = PointsActor & { userId: number; rewardId: number; idempotencyKey: string };

export async function requestRedemption(input: RedemptionInput) {
  validId(input.userId, "user ID");
  validId(input.rewardId, "reward ID");
  const idempotencyKey = requiredText(input.idempotencyKey, "Idempotency key", 200);
  return withRewardsTransaction((tx) => {
    const existing = getRedemptionByIdempotency(tx, idempotencyKey);
    if (existing) {
      if (existing.userId !== input.userId || existing.rewardId !== input.rewardId) throw new RewardsError("The idempotency key is already used for a different redemption.", "IDEMPOTENCY_CONFLICT");
      const [event] = tx.select().from(rewardEvents).where(eq(rewardEvents.redemptionId, existing.id)).orderBy(desc(rewardEvents.createdAt), desc(rewardEvents.id)).limit(1).all();
      return { redemption: existing, event: event ?? null, balance: ensureBalanceProjection(tx, input.userId) };
    }
    const [reward] = tx.select().from(rewards).where(eq(rewards.id, input.rewardId)).limit(1).all();
    const version = reward ? getCurrentRewardVersion(tx, reward.id) : null;
    if (!reward || !version) throw new RewardsError("Reward not found.", "REWARD_NOT_FOUND", 404);
    if (!reward.active || !version.active) throw new RewardsError("Reward is not active.", "REWARD_NOT_ACTIVE");
    if (reward.kind !== "redeem" || version.kind !== "redeem") throw new RewardsError("This recognition is earned-only.", "REWARD_NOT_REDEEMABLE");
    const current = ensureBalanceProjection(tx, input.userId);
    if (current.balance < version.cost) throw new RewardsError("Insufficient points balance.", "INSUFFICIENT_BALANCE");
    const now = new Date();
    const [redemption] = tx.insert(redemptions).values({ userId: input.userId, rewardId: reward.id, rewardVersionId: version.id, rewardName: version.name, rewardDescription: version.description, cost: version.cost, status: "requested", idempotencyKey, requestedAt: now, createdAt: now, updatedAt: now }).returning().all();
    if (!redemption) throw new RewardsError("Redemption was not created.", "REDEMPTION_WRITE_FAILED", 500);
    appendLedgerEntry(tx, { userId: input.userId, amount: -version.cost, eventType: "reward_redemption", sourceType: "redemption", sourceId: String(redemption.id), idempotencyKey: `redemption:${redemption.id}:debit`, actorUserId: input.actorUserId ?? input.userId, sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent });
    const event = addRewardEvent(tx, { redemptionId: redemption.id, actorUserId: input.actorUserId ?? input.userId, eventType: "requested", fromStatus: null, toStatus: "requested", idempotencyKey: `redemption:${redemption.id}:requested`, createdAt: now });
    tx.insert(auditEvents).values(buildRewardsAuditRecord({ actorUserId: input.actorUserId ?? input.userId, sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent, action: "rewards.redemption.requested", targetType: "redemption", targetId: redemption.id, metadata: { status: "requested", resourceType: "redemption" } }, now)).run();
    const [, balance] = [redemption, ensureBalanceProjection(tx, input.userId)];
    return { redemption, event, balance };
  });
}

export async function getRedemptions(userId: number, page = 1, pageSize = 20) {
  validId(userId, "user ID");
  return listRewardRedemptions(userId, page, pageSize);
}

export async function getAdminRedemptions(page = 1, pageSize = 20, status?: "requested" | "fulfilled" | "cancelled") {
  return listAdminRedemptions(page, pageSize, status);
}

export type RedemptionActionInput = { actorUserId: number; sessionId?: number | null; ipAddress?: string | null; userAgent?: string | null; redemptionId: number; reason: string; idempotencyKey: string };

function validateAction(input: RedemptionActionInput) {
  validId(input.actorUserId, "actor user ID");
  validId(input.redemptionId, "redemption ID");
  return { reason: requiredText(input.reason, "Reason", 500), idempotencyKey: requiredText(input.idempotencyKey, "Idempotency key", 200) };
}

export async function fulfillRedemption(input: RedemptionActionInput) {
  const { reason, idempotencyKey } = validateAction(input);
  return withRewardsTransaction((tx) => {
    const [eventReplay] = tx.select().from(rewardEvents).where(eq(rewardEvents.idempotencyKey, idempotencyKey)).limit(1).all();
    if (eventReplay) {
      if (eventReplay.redemptionId !== input.redemptionId || eventReplay.eventType !== "fulfilled") throw new RewardsError("The idempotency key is already used for a different reward event.", "IDEMPOTENCY_CONFLICT");
      const [redemption] = tx.select().from(redemptions).where(eq(redemptions.id, input.redemptionId)).limit(1).all();
      if (!redemption) throw new RewardsError("Redemption not found.", "REDEMPTION_NOT_FOUND", 404);
      return { redemption, event: eventReplay };
    }
    const [current] = tx.select().from(redemptions).where(eq(redemptions.id, input.redemptionId)).limit(1).all();
    if (!current) throw new RewardsError("Redemption not found.", "REDEMPTION_NOT_FOUND", 404);
    if (current.status !== "requested") throw new RewardsError("Only requested redemptions can be fulfilled.", "INVALID_REDEMPTION_STATE");
    const now = new Date();
    const [redemption] = tx.update(redemptions).set({ status: "fulfilled", fulfilledAt: now, handledBy: input.actorUserId, updatedAt: now }).where(and(eq(redemptions.id, current.id), eq(redemptions.status, "requested"))).returning().all();
    if (!redemption) throw new RewardsError("Redemption state changed; retry the request.", "REDEMPTION_CONFLICT");
    const event = addRewardEvent(tx, { redemptionId: redemption.id, actorUserId: input.actorUserId, eventType: "fulfilled", fromStatus: "requested", toStatus: "fulfilled", idempotencyKey, metadataJson: JSON.stringify({ status: "fulfilled" }), createdAt: now });
    tx.insert(auditEvents).values(buildRewardsAuditRecord({ actorUserId: input.actorUserId, sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent, action: "rewards.redemption.fulfilled", targetType: "redemption", targetId: redemption.id, reason, metadata: { status: "fulfilled", resourceType: "redemption" }, requiresReason: true }, now)).run();
    return { redemption, event };
  });
}

export async function cancelRedemption(input: RedemptionActionInput) {
  const { reason, idempotencyKey } = validateAction(input);
  return withRewardsTransaction((tx) => {
    const [eventReplay] = tx.select().from(rewardEvents).where(eq(rewardEvents.idempotencyKey, idempotencyKey)).limit(1).all();
    if (eventReplay) {
      if (eventReplay.redemptionId !== input.redemptionId || eventReplay.eventType !== "cancelled") throw new RewardsError("The idempotency key is already used for a different reward event.", "IDEMPOTENCY_CONFLICT");
      const [redemption] = tx.select().from(redemptions).where(eq(redemptions.id, input.redemptionId)).limit(1).all();
      if (!redemption) throw new RewardsError("Redemption not found.", "REDEMPTION_NOT_FOUND", 404);
      return { redemption, event: eventReplay };
    }
    const [current] = tx.select().from(redemptions).where(eq(redemptions.id, input.redemptionId)).limit(1).all();
    if (!current) throw new RewardsError("Redemption not found.", "REDEMPTION_NOT_FOUND", 404);
    if (current.status !== "requested") throw new RewardsError("Only requested redemptions can be cancelled.", "INVALID_REDEMPTION_STATE");
    const now = new Date();
    appendLedgerEntry(tx, { userId: current.userId, amount: current.cost, eventType: "reward_refund", sourceType: "redemption", sourceId: String(current.id), idempotencyKey: `redemption:${current.id}:refund`, actorUserId: input.actorUserId, sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent });
    const [redemption] = tx.update(redemptions).set({ status: "cancelled", cancelledAt: now, handledBy: input.actorUserId, cancellationReason: reason, updatedAt: now }).where(and(eq(redemptions.id, current.id), eq(redemptions.status, "requested"))).returning().all();
    if (!redemption) throw new RewardsError("Redemption state changed; retry the request.", "REDEMPTION_CONFLICT");
    const event = addRewardEvent(tx, { redemptionId: redemption.id, actorUserId: input.actorUserId, eventType: "cancelled", fromStatus: "requested", toStatus: "cancelled", idempotencyKey, metadataJson: JSON.stringify({ status: "cancelled" }), createdAt: now });
    tx.insert(auditEvents).values(buildRewardsAuditRecord({ actorUserId: input.actorUserId, sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent, action: "rewards.redemption.cancelled", targetType: "redemption", targetId: redemption.id, reason, metadata: { status: "cancelled", resourceType: "redemption" }, requiresReason: true }, now)).run();
    return { redemption, event, balance: ensureBalanceProjection(tx, current.userId) };
  });
}
