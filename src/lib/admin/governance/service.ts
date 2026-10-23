import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../db/connection";
import { aiRuns, auditEvents, ideaEvents, ideaReviews, ideaSubmissions, ideas, notifications, refreshTokens, users } from "../../../db/schema";
import { isSessionActive } from "../../../auth/security-core";
import { AuthorizationError, requirePrivilegedReason } from "../../auth/authorization-core";
import { buildAuditRecord } from "../../audit/service";
import { AdminConflictError, AdminNotFoundError } from "../query";
import type { UserProfile } from "../../../db/schema";

export type GovernanceActor = { userId: number; sessionId: number; ipAddress?: string | null; userAgent?: string | null };
const safeIdea = { id: ideas.id, reference: ideas.reference, title: ideas.title, summary: ideas.summary, problem: ideas.problem, solution: ideas.solution, benefits: ideas.benefits, risks: ideas.risks, kind: ideas.kind, category: ideas.category, status: ideas.status, priorityBand: ideas.priorityBand, priorityScore: ideas.priorityScore, authorId: ideas.authorId, authorName: users.name, department: users.department, createdAt: ideas.createdAt, updatedAt: ideas.updatedAt };

function assertActor(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: GovernanceActor, now: Date): UserProfile {
  const user = tx.select({ id: users.id, profile: users.profile, isActive: users.isActive, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, actor.userId)).limit(1).get();
  const session = tx.select({ userId: refreshTokens.userId, expiresAt: refreshTokens.expiresAt, revokedAt: refreshTokens.revokedAt, idleExpiresAt: refreshTokens.idleExpiresAt, absoluteExpiresAt: refreshTokens.absoluteExpiresAt, sessionVersion: refreshTokens.sessionVersion }).from(refreshTokens).where(eq(refreshTokens.id, actor.sessionId)).limit(1).get();
  if (!user || !user.isActive || !session || session.userId !== user.id || session.expiresAt <= now || !isSessionActive(session, user, now)) throw new AuthorizationError("Session is no longer valid.");
  return user.profile;
}

export async function requireGovernanceProfile(actor: GovernanceActor, allowed: readonly UserProfile[]) {
  const profile = db.transaction((tx) => assertActor(tx, actor, new Date()));
  if (!allowed.includes(profile)) throw new AuthorizationError("This profile cannot access this queue.");
  return profile;
}

function assignedOwner(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ideaId: number): number | null {
  const route = tx.select({ metadataJson: ideaEvents.metadataJson }).from(ideaEvents).where(and(eq(ideaEvents.ideaId, ideaId), eq(ideaEvents.eventType, "business_owner_routed"))).orderBy(desc(ideaEvents.id)).limit(1).get();
  const ownerId = (parsed(route?.metadataJson ?? null) as { businessOwnerId?: unknown } | null)?.businessOwnerId;
  return typeof ownerId === "number" && Number.isSafeInteger(ownerId) ? ownerId : null;
}

function parsed(json: string | null): unknown {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export async function listScreeningQueue(limit = 50, after: number | null = null) {
  const rows = await db.select(safeIdea).from(ideas).innerJoin(users, eq(users.id, ideas.authorId)).where(and(eq(ideas.status, "screening"), after ? sql`${ideas.id} < ${after}` : undefined)).orderBy(desc(ideas.id)).limit(limit + 1).all();
  return { items: rows.slice(0, limit), nextAfter: rows.length > limit ? rows[limit - 1]?.id ?? null : null };
}

export async function listTransformationQueue(limit = 50, after: number | null = null) {
  const rows = await db.select({ ...safeIdea, approvedAt: ideaReviews.createdAt, approvalReason: ideaReviews.reason, reviewerId: ideaReviews.reviewerId }).from(ideaReviews).innerJoin(ideas, eq(ideas.id, ideaReviews.ideaId)).innerJoin(users, eq(users.id, ideas.authorId)).where(and(eq(ideaReviews.decision, "approved"), eq(ideas.status, "business_review"), after ? sql`${ideas.id} < ${after}` : undefined)).orderBy(desc(ideaReviews.id)).limit(limit + 1).all();
  const items = rows.slice(0, limit);
  return { items, nextAfter: rows.length > limit ? items.at(-1)?.id ?? null : null };
}

export async function listRoutedEvaluations(actor: GovernanceActor, limit = 50, after: number | null = null) {
  await requireGovernanceProfile(actor, ["business_owner", "admin"]);
  const routed = await db.select({ ideaId: ideaEvents.ideaId, metadataJson: ideaEvents.metadataJson, createdAt: ideaEvents.createdAt }).from(ideaEvents).where(and(eq(ideaEvents.eventType, "business_owner_routed"), after ? sql`${ideaEvents.ideaId} < ${after}` : undefined)).orderBy(desc(ideaEvents.id)).limit(500).all();
  const owned = routed.filter((event) => {
    const metadata = parsed(event.metadataJson) as { businessOwnerId?: number } | null;
    return metadata?.businessOwnerId === actor.userId;
  });
  const latest = Array.from(new Map(owned.map((row) => [row.ideaId, row])).values()).filter((row) => db.transaction((tx) => assignedOwner(tx, row.ideaId)) === actor.userId).slice(0, limit + 1);
  const ids = latest.map((row) => row.ideaId);
  if (!ids.length) return { items: [], nextAfter: null };
  const items = await db.select(safeIdea).from(ideas).innerJoin(users, eq(users.id, ideas.authorId)).where(and(inArray(ideas.id, ids), inArray(ideas.status, ["business_review", "control_review"]))).all();
  const byId = new Map(items.map((item) => [item.id, item]));
  const sorted = ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  const page = sorted.slice(0, limit);
  return { items: page, nextAfter: sorted.length > limit ? page.at(-1)?.id ?? null : null };
}

export async function getEvaluation(ideaId: number, actor?: GovernanceActor) {
  if (actor) await requireGovernanceProfile(actor, ["reviewer", "business_owner", "control", "management", "admin"]);
  const [idea] = await db.select(safeIdea).from(ideas).innerJoin(users, eq(users.id, ideas.authorId)).where(eq(ideas.id, ideaId)).limit(1).all();
  if (!idea) throw new AdminNotFoundError("Idea not found.");
  if (actor) {
    const profile = db.select({ profile: users.profile }).from(users).where(eq(users.id, actor.userId)).get()?.profile;
    if (profile === "business_owner" && db.transaction((tx) => assignedOwner(tx, ideaId)) !== actor.userId) throw new AdminNotFoundError("Idea not found.");
  }
  const [submission] = await db.select().from(ideaSubmissions).where(eq(ideaSubmissions.ideaId, ideaId)).limit(1).all();
  const [assessment] = await db.select({ resultJson: aiRuns.resultJson, jobKey: aiRuns.jobKey, completedAt: aiRuns.completedAt }).from(aiRuns).where(and(eq(aiRuns.ideaId, ideaId), eq(aiRuns.status, "succeeded"), inArray(aiRuns.jobKey, ["idea.validate", "idea.decision_pack"]))).orderBy(desc(aiRuns.createdAt)).limit(1).all();
  const [route] = await db.select({ metadataJson: ideaEvents.metadataJson, createdAt: ideaEvents.createdAt }).from(ideaEvents).where(and(eq(ideaEvents.ideaId, ideaId), eq(ideaEvents.eventType, "business_owner_routed"))).orderBy(desc(ideaEvents.id)).limit(1).all();
  const metrics = submission ? parsed(submission.metricsJson) as Record<string, string | number> : null;
  const breakdown = metrics ? [
    { key: "turnaround", score: metrics.turnaround, weight: 0.3, explanation: metrics.turnaroundExplanation ?? null },
    { key: "volume", score: metrics.volume, weight: 0.3, explanation: metrics.volumeExplanation ?? null },
    { key: "value", score: metrics.value, weight: 0.4, explanation: metrics.valueExplanation ?? null },
  ] : null;
  return { idea, submission: submission ? { answers: parsed(submission.answersJson), metrics, breakdown, score: submission.score, minimumScore: submission.minimumScore, validationPassed: submission.validationPassed, differentiation: submission.differentiation, submittedAt: submission.submittedAt } : null, assessment: assessment ? { jobKey: assessment.jobKey, completedAt: assessment.completedAt, result: parsed(assessment.resultJson) } : null, route: route ? { ...parsed(route.metadataJson) as object, createdAt: route.createdAt } : null };
}

export async function decideGovernance(actor: GovernanceActor, ideaId: number, action: "route" | "return" | "reject" | "defer" | "approve" | "not_recommended" | "confirm", reasonInput: unknown, businessOwnerId?: number) {
  const reason = requirePrivilegedReason(reasonInput);
  const now = new Date();
  return db.transaction((tx) => {
    const profile = assertActor(tx, actor, now);
    const idea = tx.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1).get();
    if (!idea) throw new AdminNotFoundError("Idea not found.");
    const from = idea.status;
    if (["route", "reject", "defer", "confirm"].includes(action) && profile !== "reviewer" && profile !== "admin") throw new AuthorizationError("Transformation reviewer access required.");
    if (["approve", "not_recommended"].includes(action) && profile !== "business_owner" && profile !== "admin" && profile !== "control") throw new AuthorizationError("Owner or control access required.");
    if (action === "return" && !["reviewer", "business_owner", "admin"].includes(profile)) throw new AuthorizationError("Reviewer or owner access required.");
    if (["approve", "not_recommended"].includes(action) && profile === "control" && from !== "control_review") throw new AuthorizationError("Control review access required.");
    if (["approve", "not_recommended"].includes(action) && profile === "business_owner" && assignedOwner(tx, ideaId) !== actor.userId) throw new AdminNotFoundError("Idea not found.");
    if (action === "return" && profile === "business_owner" && (from !== "business_review" || assignedOwner(tx, ideaId) !== actor.userId)) throw new AdminNotFoundError("Idea not found.");
    const targets: Record<typeof action, string> = { route: "business_review", return: "returned", reject: "rejected", defer: "deferred", approve: "business_review", not_recommended: "rejected", confirm: "poc" };
    if (action === "route" && (from !== "screening" || !businessOwnerId)) throw new AdminConflictError("Only screening ideas can be routed to a business owner.");
    if (["return", "reject", "defer"].includes(action) && from !== "screening" && !(action === "return" && profile === "business_owner" && from === "business_review")) throw new AdminConflictError("This action is not available at this stage.");
    if (["approve", "not_recommended"].includes(action) && from !== "business_review" && from !== "control_review") throw new AdminConflictError("This action is only available for routed evaluations.");
    if (action === "confirm" && from !== "business_review") throw new AdminConflictError("Only owner-approved ideas can be confirmed.");
    if (action === "confirm" && !tx.select({ id: ideaReviews.id }).from(ideaReviews).where(and(eq(ideaReviews.ideaId, ideaId), eq(ideaReviews.decision, "approved"))).limit(1).get()) throw new AdminConflictError("Business owner approval is required before confirmation.");
    if (action === "route") {
      const owner = tx.select({ id: users.id, isActive: users.isActive, profile: users.profile }).from(users).where(eq(users.id, businessOwnerId!)).limit(1).get();
      if (!owner?.isActive || owner.profile !== "business_owner") throw new AdminConflictError("Active business owner is required.");
    }
    const to = targets[action] as typeof idea.status;
    if (action !== "approve" && action !== "route") tx.update(ideas).set({ status: to, updatedAt: now }).where(and(eq(ideas.id, ideaId), eq(ideas.status, from))).run();
    if (action === "route") {
      tx.update(ideas).set({ status: to, updatedAt: now }).where(and(eq(ideas.id, ideaId), eq(ideas.status, from))).run();
      tx.insert(ideaEvents).values({ ideaId, actorType: "admin", actorId: actor.userId, eventType: "business_owner_routed", fromStatus: from, toStatus: to, metadataJson: JSON.stringify({ businessOwnerId, reason }) }).run();
      tx.insert(notifications).values({ userId: businessOwnerId!, type: "idea_routed", title: "Idea routed for evaluation", body: `${idea.reference} is ready for your evaluation.`, link: `/ideas/${ideaId}` }).run();
    }
    if (action === "approve" || action === "not_recommended") {
      tx.insert(ideaReviews).values({ ideaId, reviewerId: actor.userId, decision: action === "approve" ? "approved" : "rejected", reason }).run();
      tx.insert(ideaEvents).values({ ideaId, actorType: "admin", actorId: actor.userId, eventType: action === "approve" ? "business_owner_approved" : "business_owner_not_recommended", fromStatus: from, toStatus: to, metadataJson: JSON.stringify({ reason }) }).run();
      if (action === "not_recommended") tx.update(ideas).set({ status: to, updatedAt: now }).where(eq(ideas.id, ideaId)).run();
      else tx.insert(notifications).values({ userId: idea.authorId, type: "idea_owner_approved", title: "Your idea was approved by its business owner", body: `${idea.reference} has moved to the transformation team for final review.`, link: `/ideas/${ideaId}` }).run();
    }
    if (["return", "reject", "defer", "confirm"].includes(action)) {
      tx.insert(ideaEvents).values({ ideaId, actorType: "admin", actorId: actor.userId, eventType: action === "confirm" ? "transformation_confirmed" : "status_changed", fromStatus: from, toStatus: to, metadataJson: JSON.stringify({ reason }) }).run();
      if (action === "confirm" || action === "return") tx.insert(notifications).values({ userId: idea.authorId, type: action === "confirm" ? "idea_accepted" : "idea_status_changed", title: action === "confirm" ? "Idea accepted for proof of concept" : "Idea workflow updated", body: action === "confirm" ? `Congratulations, ${idea.reference} has been accepted for proof of concept.` : `${idea.reference} was returned for changes.`, link: `/ideas/${ideaId}` }).run();
    }
    tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId, action: `admin.governance.${action}`, targetType: "idea", targetId: ideaId, reason, requiresReason: true, metadata: { fromStatus: from, toStatus: to, businessOwnerId: action === "route" ? businessOwnerId : null }, ipAddress: actor.ipAddress, userAgent: actor.userAgent }, now)).run();
    return { ideaId, action, fromStatus: from, toStatus: to };
  });
}
