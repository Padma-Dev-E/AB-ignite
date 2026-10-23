import { and, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/connection";
import { auditEvents, refreshTokens, users, type UserRole } from "../../db/schema";
import { isSessionActive } from "../../auth/security-core";
import { buildAuditRecord } from "../audit/service";
import { requirePrivilegedReason, AuthorizationError } from "../auth/authorization-core";
import { AdminConflictError, AdminNotFoundError, safeAuditMetadata } from "./query";

type Page = { limit: number; after: number | null };
type Actor = { userId: number; sessionId: number };
type AuditFilters = Page & { actorUserId?: number | null; action?: string | null; targetType?: string | null; targetId?: string | null };

const userFields = {
  id: users.id, name: users.name, email: users.email, role: users.role,
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
  const current = tx.select({ id: users.id, role: users.role, isActive: users.isActive, sessionVersion: users.sessionVersion })
    .from(users).where(eq(users.id, actor.userId)).limit(1).get();
  const session = tx.select({ userId: refreshTokens.userId, expiresAt: refreshTokens.expiresAt,
    revokedAt: refreshTokens.revokedAt, idleExpiresAt: refreshTokens.idleExpiresAt,
    absoluteExpiresAt: refreshTokens.absoluteExpiresAt, sessionVersion: refreshTokens.sessionVersion })
    .from(refreshTokens).where(eq(refreshTokens.id, actor.sessionId)).limit(1).get();
  if (!current || current.role !== "admin" || !current.isActive || !session || session.userId !== current.id || session.expiresAt <= now || !isSessionActive(session, current, now)) {
    throw new AuthorizationError("Administrator session is no longer valid.");
  }
}

function mutateUser(actor: Actor, userId: number, reasonInput: unknown, action: "role" | "active" | "reset", value?: UserRole | boolean, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  const reason = requirePrivilegedReason(reasonInput);
  const now = new Date();
  return db.transaction((tx) => {
    assertActor(tx, actor, now);
    const target = tx.select().from(users).where(eq(users.id, userId)).limit(1).get();
    if (!target) throw new AdminNotFoundError("User not found.");
    if (action === "role" && value !== "admin" && value !== "user") throw new AdminConflictError("Invalid role.");
    if (action === "active" && typeof value !== "boolean") throw new AdminConflictError("Invalid active state.");
    if (userId === actor.userId && action !== "reset") throw new AdminConflictError("Administrators cannot change their own role or active state.");
    if (action === "role" && target.role === value) throw new AdminConflictError("Role is already set.");
    if (action === "active" && target.isActive === value) throw new AdminConflictError("Active state is already set.");
    if (action === "role") tx.update(users).set({ role: value as UserRole, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now }).where(eq(users.id, userId)).run();
    if (action === "active") tx.update(users).set({ isActive: value as boolean, deactivatedAt: value ? null : now, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now }).where(eq(users.id, userId)).run();
    if (action === "reset") tx.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastFailedLoginAt: null, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now }).where(eq(users.id, userId)).run();
    const auditAction = action === "role" ? "admin.user.role_changed" : action === "reset" ? "admin.user.security_reset" : value ? "admin.user.reactivated" : "admin.user.deactivated";
    tx.update(refreshTokens).set({ revokedAt: now, revocationReason: auditAction, updatedAt: now })
      .where(and(eq(refreshTokens.userId, userId), sql`${refreshTokens.revokedAt} IS NULL`)).run();
    tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId,
      action: auditAction, targetType: "user", targetId: userId, reason, requiresReason: true,
      metadata: action === "role" ? { fromStatus: target.role, toStatus: value } : { status: action === "reset" ? "reset" : value ? "active" : "inactive" },
      ...metadata,
    }, now)).run();
    return tx.select(userFields).from(users).where(eq(users.id, userId)).limit(1).get()!;
  });
}

export function changeUserRole(actor: Actor, userId: number, role: UserRole, reason: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  return mutateUser(actor, userId, reason, "role", role, metadata);
}

export function setUserActive(actor: Actor, userId: number, active: boolean, reason: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  return mutateUser(actor, userId, reason, "active", active, metadata);
}

export function resetUserSecurity(actor: Actor, userId: number, reason: unknown, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  return mutateUser(actor, userId, reason, "reset", undefined, metadata);
}

export async function listAuditEvents(filters: AuditFilters) {
  const conditions: SQL[] = [];
  if (filters.after) conditions.push(lt(auditEvents.id, filters.after));
  if (filters.actorUserId) conditions.push(eq(auditEvents.actorUserId, filters.actorUserId));
  if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
  if (filters.targetType) conditions.push(eq(auditEvents.targetType, filters.targetType));
  if (filters.targetId) conditions.push(eq(auditEvents.targetId, filters.targetId));
  const rows = db.select({ id: auditEvents.id, createdAt: auditEvents.createdAt,
    actorUserId: auditEvents.actorUserId, sessionId: auditEvents.sessionId, action: auditEvents.action,
    targetType: auditEvents.targetType, targetId: auditEvents.targetId, reason: auditEvents.reason,
    metadataJson: auditEvents.metadataJson,
  }).from(auditEvents).where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.id)).limit(filters.limit + 1).all();
  return pageResult(rows.map(({ metadataJson, ...row }) => ({ ...row, metadata: safeAuditMetadata(metadataJson) })), filters.limit);
}
