import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/connection";
import { articles, auditEvents, ideas, pointsLedger, quizAttempts, refreshTokens, users } from "../../db/schema";
import { adminAccess, CAPABILITIES } from "./http";
import { changeUserRole, setUserActive, resetUserSecurity, resetUserPassword, revokeUserSession, createUser, listUsers, getUserDetail, listUserSessions, listAuditEvents, getAdminAnalytics } from "./service";
import { verifyPassword } from "../../auth/password-core";

test("admin operations persist, revoke sessions, audit reasons, and return no secrets", async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const actor = db.insert(users).values({ name: "Admin actor", email: `admin-actor-${stamp}@example.test`, role: "admin", profile: "admin", passwordHash: "actor-secret" }).returning({ id: users.id }).get();
  const target = db.insert(users).values({ name: "Admin target", email: `admin-target-${stamp}@example.test`, passwordHash: "target-secret", failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) }).returning({ id: users.id }).get();
  const actorSession = db.insert(refreshTokens).values({ userId: actor.id, tokenHash: `actor-token-${stamp}`, expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
  const targetSession = db.insert(refreshTokens).values({ userId: target.id, tokenHash: `target-token-${stamp}`, expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
  const context = { userId: actor.id, sessionId: actorSession.id };
  try {
    const actorCookie = { user: { id: String(actor.id), sessionId: String(actorSession.id) } } as Parameters<typeof adminAccess>[0];
    assert.equal((await adminAccess(actorCookie, CAPABILITIES.USERS_MANAGE)).userId, actor.id);
    await assert.rejects(adminAccess({ user: { id: String(target.id), sessionId: String(targetSession.id) } } as Parameters<typeof adminAccess>[0], CAPABILITIES.USERS_MANAGE));
    assert.ok((await listUsers({ limit: 100, after: null })).items.some((item) => item.id === target.id));
    const detail = await getUserDetail(target.id);
    assert.equal(detail.id, target.id);
    assert.equal(JSON.stringify(detail).includes("target-secret"), false);
    assert.equal(JSON.stringify(await listUserSessions(target.id, { limit: 10, after: null })).includes("target-token"), false);
    assert.throws(() => changeUserRole(context, target.id, "admin", " "));
    assert.throws(() => setUserActive(context, actor.id, false, "self deactivation"));
    await changeUserRole(context, target.id, "admin", "approved promotion");
    assert.equal(db.select().from(refreshTokens).where(eq(refreshTokens.id, targetSession.id)).get()?.revokedAt instanceof Date, true);
    await assert.rejects(adminAccess({ user: { id: String(target.id), sessionId: String(targetSession.id) } } as Parameters<typeof adminAccess>[0], CAPABILITIES.USERS_READ));
    await resetUserSecurity(context, target.id, "recover account");
    assert.equal(db.select().from(users).where(eq(users.id, target.id)).get()?.failedLoginAttempts, 0);
    await setUserActive(context, target.id, false, "left company");
    assert.equal(db.select().from(users).where(eq(users.id, target.id)).get()?.isActive, false);
    const event = db.select().from(auditEvents).where(and(eq(auditEvents.action, "admin.user.deactivated"), eq(auditEvents.targetId, String(target.id)))).get();
    assert.equal(event?.reason, "left company");
    const audit = await listAuditEvents({ limit: 100, after: null, actorUserId: actor.id });
    assert.ok(audit.items.some((item) => item.id === event?.id));
    assert.equal(JSON.stringify(audit).includes("actor-secret"), false);
    db.update(refreshTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(refreshTokens.id, actorSession.id)).run();
    await assert.rejects(adminAccess(actorCookie, CAPABILITIES.USERS_READ));
  } finally {
    db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, actor.id)).run();
  }
});

test("management analytics returns status, priority, department, points, and learning counts", async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const user = db.insert(users).values({ name: "Analytics", email: `analytics-${stamp}@example.test`, passwordHash: "test", department: "Treasury" }).returning({ id: users.id }).get();
  const idea = db.insert(ideas).values({ authorId: user.id, title: "Analytics idea", summary: "A test", category: "Ops", reference: `AI-${stamp}`, status: "screening", priorityBand: "Priority", priorityScore: 2.7 }).returning({ id: ideas.id }).get();
  db.insert(pointsLedger).values({ userId: user.id, amount: 11, eventType: "test", sourceType: "test", sourceId: "analytics", idempotencyKey: `analytics-${stamp}` }).run();
  db.insert(quizAttempts).values({ userId: user.id, quizId: 1, score: 80, passed: true, status: "completed", idempotencyKey: `quiz-${stamp}` }).run();
  db.insert(articles).values({ title: `Article ${stamp}`, summary: "S", body: "B", category: "Banking", categoryCode: "banking", publisher: "Test", difficulty: "Beginner", readingMinutes: 1, published: true, contentType: "internal" }).run();
  const result = await getAdminAnalytics();
  assert.ok(result.ideasByStatus.some((row) => row.status === "screening" && row.count >= 1));
  assert.ok(result.ideasByPriority.some((row) => row.band === "Priority" && row.count >= 1));
  assert.ok(result.usersByDepartment.some((row) => row.department === "Treasury" && row.count >= 1));
  assert.ok(result.points.total >= 11);
  assert.ok(result.learning.quizAttempts >= 1);
  assert.ok(result.learning.publishedArticles >= 1);
  assert.ok(idea.id > 0);
});

test("profile assignment, user creation, password reset and individual revocation are audited", async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const actor = db.insert(users).values({ name: "Admin", email: `admin-rbac-${stamp}@example.test`, role: "admin", profile: "admin", passwordHash: "test" }).returning({ id: users.id }).get();
  const actorSession = db.insert(refreshTokens).values({ userId: actor.id, tokenHash: `admin-rbac-${stamp}`, expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
  const context = { userId: actor.id, sessionId: actorSession.id };
  const created = await createUser(context, { name: "Owner", email: `owner-${stamp}@example.test`, department: "Risk", profile: "business_owner" }, "approved onboarding");
  const userId = created.user.id;
  try {
    assert.equal(created.user.role, "user");
    assert.equal(created.user.profile, "business_owner");
    assert.equal(await verifyPassword(db.select().from(users).where(eq(users.id, userId)).get()!.passwordHash, created.temporaryPassword), true);
    const sessionA = db.insert(refreshTokens).values({ userId, tokenHash: `owner-a-${stamp}`, expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
    const sessionB = db.insert(refreshTokens).values({ userId, tokenHash: `owner-b-${stamp}`, expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
    revokeUserSession(context, userId, sessionA.id, "suspected lost device");
    assert.ok(db.select().from(refreshTokens).where(eq(refreshTokens.id, sessionA.id)).get()?.revokedAt);
    assert.equal(db.select().from(refreshTokens).where(eq(refreshTokens.id, sessionB.id)).get()?.revokedAt, null);
    const password = await resetUserPassword(context, userId, "verified identity");
    assert.equal(await verifyPassword(db.select().from(users).where(eq(users.id, userId)).get()!.passwordHash, password.temporaryPassword), true);
    assert.ok(db.select().from(refreshTokens).where(eq(refreshTokens.id, sessionB.id)).get()?.revokedAt);
    await changeUserRole(context, userId, "reviewer", "transfer to transformation");
    assert.equal(db.select().from(users).where(eq(users.id, userId)).get()?.profile, "reviewer");
    assert.equal(db.select().from(users).where(eq(users.id, userId)).get()?.role, "user");
    const audit = db.select().from(auditEvents).where(eq(auditEvents.targetId, String(userId))).all();
    assert.ok(audit.some((row) => row.action === "admin.user.created"));
    assert.ok(audit.some((row) => row.action === "admin.user.password_reset"));
    assert.equal(JSON.stringify(audit).includes(password.temporaryPassword), false);
    assert.throws(() => revokeUserSession(context, actor.id, actorSession.id, "self"));
  } finally {
    db.update(users).set({ isActive: false }).where(eq(users.id, actor.id)).run();
  }
});
