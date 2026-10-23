import { and, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/connection";
import { articles, articleCompletions, auditEvents, feedbackResponses, ideas, pointsLedger, quizAttempts, refreshTokens, users, type UserProfile } from "../../db/schema";
import { hashPassword } from "../../auth/password-core";
import { randomBytes } from "node:crypto";
import { isSessionActive } from "../../auth/security-core";
import { buildAuditRecord } from "../audit/service";
import { requirePrivilegedReason, AuthorizationError } from "../auth/authorization-core";
import { AdminConflictError, AdminNotFoundError, safeAuditMetadata } from "./query";

type Page = { limit: number; after: number | null };
type Actor = { userId: number; sessionId: number };
type AuditFilters = Page & { actorUserId?: number | null; action?: string | null; targetType?: string | null; targetId?: string | null; from?: Date | null; to?: Date | null; ipHash?: string | null };

const userFields = {
  id: users.id, name: users.name, email: users.email, role: users.role, profile: users.profile,
  department: users.department, jobTitle: users.jobTitle, isActive: users.isActive,
  failedLoginAttempts: users.failedLoginAttempts, lockedUntil: users.lockedUntil,
  lastLoginAt: users.lastLoginAt, lastSeenAt: users.lastSeenAt,
  deactivatedAt: users.deactivatedAt, createdAt: users.createdAt, updatedAt: users.updatedAt,
};

function pageResult<T extends { id: number }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return { items, nextAfter: rows.length > limit ? items.at(-1)?.id ?? null : null };
}

export async function listUsers(page: Page) {
  const rows = db.select(userFields).from(users)
    .where(page.after ? lt(users.id, page.after) : undefined)
    .orderBy(desc(users.id)).limit(page.limit + 1).all();
  return pageResult(rows, page.limit);
}

export async function getUserDetail(userId: number) {
  const row = db.select(userFields).from(users).where(eq(users.id, userId)).limit(1).get();
  if (!row) throw new AdminNotFoundError("User not found.");
  return row;
}

export async function listUserSessions(userId: number, page: Page) {
  const user = db.select({ isActive: users.isActive, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1).get();
  if (!user) throw new AdminNotFoundError("User not found.");
  const rows = db.select({
    id: refreshTokens.id, createdAt: refreshTokens.createdAt, lastSeenAt: refreshTokens.lastSeenAt,
    expiresAt: refreshTokens.expiresAt, idleExpiresAt: refreshTokens.idleExpiresAt,
    absoluteExpiresAt: refreshTokens.absoluteExpiresAt, revokedAt: refreshTokens.revokedAt,
    revocationReason: refreshTokens.revocationReason, sessionVersion: refreshTokens.sessionVersion,
  }).from(refreshTokens).where(and(eq(refreshTokens.userId, userId), page.after ? lt(refreshTokens.id, page.after) : undefined))
    .orderBy(desc(refreshTokens.id)).limit(page.limit + 1).all();
  return pageResult(rows.map((row) => ({ ...row, isActive: row.expiresAt > new Date() && isSessionActive(row, user) })), page.limit);
}

function assertActor(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: Actor, now: Date) {
  const current = tx.select({ id: users.id, role: users.role, profile: users.profile, isActive: users.isActive, sessionVersion: users.sessionVersion })
    .from(users).where(eq(users.id, actor.userId)).limit(1).get();
  const session = tx.select({ userId: refreshTokens.userId, expiresAt: refreshTokens.expiresAt,
    revokedAt: refreshTokens.revokedAt, idleExpiresAt: refreshTokens.idleExpiresAt,
    absoluteExpiresAt: refreshTokens.absoluteExpiresAt, sessionVersion: refreshTokens.sessionVersion })
    .from(refreshTokens).where(eq(refreshTokens.id, actor.sessionId)).limit(1).get();
  if (!current || (current.profile !== "admin" && current.role !== "admin") || !current.isActive || !session || session.userId !== current.id || session.expiresAt <= now || !isSessionActive(session, current, now)) {
    throw new AuthorizationError("Administrator session is no longer valid.");
  }
}

function mutateUser(actor: Actor, userId: number, reasonInput: unknown, action: "role" | "active" | "reset", value?: UserProfile | boolean, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  const reason = requirePrivilegedReason(reasonInput);
  const now = new Date();
  return db.transaction((tx) => {
    assertActor(tx, actor, now);
    const target = tx.select().from(users).where(eq(users.id, userId)).limit(1).get();
    if (!target) throw new AdminNotFoundError("User not found.");
    if (action === "role" && !["employee", "reviewer", "business_owner", "control", "management", "admin"].includes(value as string)) throw new AdminConflictError("Invalid profile.");
    if (action === "active" && typeof value !== "boolean") throw new AdminConflictError("Invalid active state.");
    if (userId === actor.userId && action !== "reset") throw new AdminConflictError("Administrators cannot change their own role or active state.");
    if (action === "role" && target.profile === value) throw new AdminConflictError("Profile is already set.");
    if (action === "active" && target.isActive === value) throw new AdminConflictError("Active state is already set.");
    if (action === "role") tx.update(users).set({ profile: value as UserProfile, role: value === "admin" ? "admin" : "user", sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now }).where(eq(users.id, userId)).run();
    if (action === "active") tx.update(users).set({ isActive: value as boolean, deactivatedAt: value ? null : now, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now }).where(eq(users.id, userId)).run();
    if (action === "reset") tx.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastFailedLoginAt: null, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now }).where(eq(users.id, userId)).run();
    const auditAction = action === "role" ? "admin.user.role_changed" : action === "reset" ? "admin.user.security_reset" : value ? "admin.user.reactivated" : "admin.user.deactivated";
    tx.update(refreshTokens).set({ revokedAt: now, revocationReason: auditAction, updatedAt: now })
      .where(and(eq(refreshTokens.userId, userId), sql`${refreshTokens.revokedAt} IS NULL`)).run();
    tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId,
      action: auditAction, targetType: "user", targetId: userId, reason, requiresReason: true,
      metadata: action === "role" ? { fromStatus: target.profile, toStatus: value } : { status: action === "reset" ? "reset" : value ? "active" : "inactive" },
      ...metadata,
    }, now)).run();
    return tx.select(userFields).from(users).where(eq(users.id, userId)).limit(1).get()!;
  });
}

export function changeUserRole(actor: Actor, userId: number, profile: UserProfile, reason: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  return mutateUser(actor, userId, reason, "role", profile, metadata);
}

export function setUserActive(actor: Actor, userId: number, active: boolean, reason: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  return mutateUser(actor, userId, reason, "active", active, metadata);
}

export function resetUserSecurity(actor: Actor, userId: number, reason: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  return mutateUser(actor, userId, reason, "reset", undefined, metadata);
}

export async function createUser(actor: Actor, input: { name: string; email: string; department: string; jobTitle?: string; profile: UserProfile }, reasonInput: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  const reason = requirePrivilegedReason(reasonInput);
  const now = new Date();
  // Administrators deliver this one-time credential through an approved bank channel.
  const temporaryPassword = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const user = db.transaction((tx) => {
      assertActor(tx, actor, now);
      const created = tx.insert(users).values({ name: input.name.trim(), email: input.email.trim().toLowerCase(), department: input.department.trim(), jobTitle: input.jobTitle?.trim() || null, profile: input.profile, role: input.profile === "admin" ? "admin" : "user", passwordHash, createdAt: now, updatedAt: now }).returning(userFields).get();
      tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId, action: "admin.user.created", targetType: "user", targetId: created.id, reason, requiresReason: true, metadata: { profile: created.profile }, ...metadata }, now)).run();
      return created;
    });
    return { user, temporaryPassword };
  } catch (error) {
    if (String(error).includes("users_email_unique")) throw new AdminConflictError("Email is already registered.");
    throw error;
  }
}

export async function resetUserPassword(actor: Actor, userId: number, reasonInput: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  const reason = requirePrivilegedReason(reasonInput);
  const now = new Date();
  const temporaryPassword = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  db.transaction((tx) => {
    assertActor(tx, actor, now);
    if (userId === actor.userId) throw new AdminConflictError("Administrators cannot reset their own password through this endpoint.");
    const target = tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
    if (!target) throw new AdminNotFoundError("User not found.");
    tx.update(users).set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null, lastFailedLoginAt: null, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now }).where(eq(users.id, userId)).run();
    tx.update(refreshTokens).set({ revokedAt: now, revocationReason: "admin.user.password_reset", updatedAt: now }).where(and(eq(refreshTokens.userId, userId), sql`${refreshTokens.revokedAt} IS NULL`)).run();
    tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId, action: "admin.user.password_reset", targetType: "user", targetId: userId, reason, requiresReason: true, ...metadata }, now)).run();
  });
  return { temporaryPassword };
}

export function revokeUserSession(actor: Actor, userId: number, targetSessionId: number, reasonInput: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  const reason = requirePrivilegedReason(reasonInput);
  const now = new Date();
  return db.transaction((tx) => {
    assertActor(tx, actor, now);
    if (targetSessionId === actor.sessionId) throw new AdminConflictError("Administrators cannot revoke their current session here.");
    const target = tx.select({ id: refreshTokens.id, revokedAt: refreshTokens.revokedAt }).from(refreshTokens).where(and(eq(refreshTokens.id, targetSessionId), eq(refreshTokens.userId, userId))).get();
    if (!target) throw new AdminNotFoundError("Session not found.");
    if (target.revokedAt) throw new AdminConflictError("Session is already revoked.");
    tx.update(refreshTokens).set({ revokedAt: now, revocationReason: "admin.session.revoked", updatedAt: now }).where(eq(refreshTokens.id, targetSessionId)).run();
    tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId, action: "admin.session.revoked", targetType: "session", targetId: targetSessionId, reason, requiresReason: true, metadata: { userId }, ...metadata }, now)).run();
    return { id: targetSessionId, revokedAt: now };
  });
}

export async function listAuditEvents(filters: AuditFilters) {
  const conditions: SQL[] = [];
  if (filters.after) conditions.push(lt(auditEvents.id, filters.after));
  if (filters.actorUserId) conditions.push(eq(auditEvents.actorUserId, filters.actorUserId));
  if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
  if (filters.targetType) conditions.push(eq(auditEvents.targetType, filters.targetType));
  if (filters.targetId) conditions.push(eq(auditEvents.targetId, filters.targetId));
  if (filters.from) conditions.push(sql`${auditEvents.createdAt} >= ${filters.from}`);
  if (filters.to) conditions.push(sql`${auditEvents.createdAt} < ${filters.to}`);
  if (filters.ipHash) conditions.push(eq(auditEvents.ipHash, filters.ipHash));
  const rows = db.select({ id: auditEvents.id, createdAt: auditEvents.createdAt,
    actorUserId: auditEvents.actorUserId, sessionId: auditEvents.sessionId, action: auditEvents.action,
    targetType: auditEvents.targetType, targetId: auditEvents.targetId, reason: auditEvents.reason, ipHash: auditEvents.ipHash,
    metadataJson: auditEvents.metadataJson,
  }).from(auditEvents).where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.id)).limit(filters.limit + 1).all();
  return pageResult(rows.map(({ metadataJson, ...row }) => ({ ...row, metadata: safeAuditMetadata(metadataJson) })), filters.limit);
}

export async function getAdminAnalytics() {
  const usersByState = db.select({ state: sql<string>`CASE WHEN ${users.isActive} = 1 THEN 'active' ELSE 'inactive' END`, count: sql<number>`count(*)` }).from(users).groupBy(users.isActive).all();
  const ideasByStatus = db.select({ status: ideas.status, count: sql<number>`count(*)` }).from(ideas).groupBy(ideas.status).orderBy(desc(sql`count(*)`)).limit(30).all();
  const ideasByPriority = db.select({ band: ideas.priorityBand, count: sql<number>`count(*)` }).from(ideas).groupBy(ideas.priorityBand).limit(5).all();
  const usersByDepartment = db.select({ department: users.department, count: sql<number>`count(*)` }).from(users).groupBy(users.department).orderBy(desc(sql`count(*)`)).limit(100).all();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).getTime();
  const auditByAction = db.select({ action: auditEvents.action, count: sql<number>`count(*)` }).from(auditEvents).where(sql`${auditEvents.createdAt} >= ${thirtyDaysAgo}`).groupBy(auditEvents.action).orderBy(desc(sql`count(*)`)).limit(20).all();
  const points = db.select({ total: sql<number>`coalesce(sum(${pointsLedger.amount}), 0)`, events: sql<number>`count(*)` }).from(pointsLedger).get()!;
  const learning = {
    quizAttempts: db.select({ count: sql<number>`count(*)` }).from(quizAttempts).get()!.count,
    publishedArticles: db.select({ count: sql<number>`count(*)` }).from(articles).where(eq(articles.published, true)).get()!.count,
    articleCompletions: db.select({ count: sql<number>`count(*)` }).from(articleCompletions).get()!.count,
  };
  return { periodDays: 30, generatedAt: new Date().toISOString(), usersByState, ideasByStatus, ideasByPriority, usersByDepartment, points, learning, auditByAction };
}

export function listIdeaExportRows(page: Page) {
  const rows = db.select({ id: ideas.id, reference: ideas.reference, status: ideas.status, priorityBand: ideas.priorityBand, priorityScore: ideas.priorityScore, authorId: ideas.authorId, authorName: users.name, department: users.department, title: ideas.title, summary: ideas.summary, benefits: ideas.benefits, createdAt: ideas.createdAt, updatedAt: ideas.updatedAt }).from(ideas).innerJoin(users, eq(users.id, ideas.authorId)).where(page.after ? lt(ideas.id, page.after) : undefined).orderBy(desc(ideas.id)).limit(page.limit + 1).all();
  return pageResult(rows, page.limit);
}

export function listFeedbackExportRows(page: Page) {
  const rows = db.select({ id: feedbackResponses.id, campaignId: feedbackResponses.campaignId, userId: feedbackResponses.userId, userName: users.name, department: users.department, category: feedbackResponses.category, message: feedbackResponses.message, response: feedbackResponses.response, createdAt: feedbackResponses.createdAt, respondedAt: feedbackResponses.respondedAt }).from(feedbackResponses).innerJoin(users, eq(users.id, feedbackResponses.userId)).where(page.after ? lt(feedbackResponses.id, page.after) : undefined).orderBy(desc(feedbackResponses.id)).limit(page.limit + 1).all();
  return pageResult(rows, page.limit);
}
