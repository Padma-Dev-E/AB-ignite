import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/connection";
import { auditEvents, refreshTokens, users } from "../../db/schema";
import { adminAccess, CAPABILITIES } from "./http";
import { changeUserRole, setUserActive, resetUserSecurity, listUsers, getUserDetail, listUserSessions, listAuditEvents } from "./service";

test("admin operations persist, revoke sessions, audit reasons, and return no secrets", async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const actor = db.insert(users).values({ name: "Admin actor", email: `admin-actor-${stamp}@example.test`, role: "admin", passwordHash: "actor-secret" }).returning({ id: users.id }).get();
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
