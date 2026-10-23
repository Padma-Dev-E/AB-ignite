import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";

test("badge rules require an active administrator, audit reason, and replay safe mutations", async () => {
  const sourcePath = resolve(process.cwd(), (process.env.DATABASE_URL ?? "./data/ab-ignite.db").replace(/^file:/, ""));
  const privatePath = join(mkdtempSync(join(tmpdir(), "ignite-badges-")), "snapshot.db");
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(privatePath);
  } finally {
    source.close();
  }
  process.env.DATABASE_URL = privatePath;
  const [{ db }, { users, refreshTokens, badges, auditEvents }, admin] = await Promise.all([
    import("../src/db/connection"),
    import("../src/db/schema"),
    import("../src/lib/rewards/badge-admin"),
  ]);
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  const stamp = Date.now();
  const [user] = db.insert(users).values({ name: "Badge administrator", email: `badge-admin-${stamp}@example.test`, role: "back_office", passwordHash: "test" }).returning().all();
  const [session] = db.insert(refreshTokens).values({ userId: user.id, tokenHash: `badge-${stamp}`, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000) }).returning().all();
  const actor = { userId: user.id, sessionId: session.id, reason: "Add a recognition rule", ipAddress: "10.0.0.7", userAgent: "badge-admin-test" };
  const data = { code: `badge-${stamp}`, name: "Badge Test", description: "A tested recognition milestone", eventTypes: ["idea_submission"], minimumCount: 2, active: true };
  const created = await admin.createAdminBadgeRule(actor, data, `badge-create-${stamp}`);
  assert.equal(created.code, data.code);
  assert.deepEqual(JSON.parse(created.ruleJson), { eventTypes: ["idea_submission"], minimumCount: 2 });
  assert.deepEqual(await admin.createAdminBadgeRule(actor, data, `badge-create-${stamp}`), created);
  assert.equal(db.select().from(badges).where(eq(badges.code, data.code)).all().length, 1);
  await assert.rejects(admin.createAdminBadgeRule(actor, { ...data, name: "Changed" }, `badge-create-${stamp}`), /idempotency/i);
  await assert.rejects(admin.createAdminBadgeRule({ ...actor, reason: " " }, { ...data, code: `bad-reason-${stamp}` }, `badge-reason-${stamp}`), /reason/i);
  await assert.rejects(admin.createAdminBadgeRule(actor, { ...data, code: `bad-event-${stamp}`, eventTypes: ["made_up_event"] }, `badge-event-${stamp}`), /event/i);
  const listing = await admin.listAdminBadgeRules({ limit: 100, after: null });
  assert.ok(listing.items.some((badge: { id: number }) => badge.id === created.id));
  assert.ok(listing.availableEvents.some((event: { code: string }) => event.code === "idea_submission"));
  const updated = await admin.updateAdminBadgeRule({ ...actor, reason: "Raise milestone threshold" }, created.id, { ...data, minimumCount: 3, active: false }, `badge-update-${stamp}`);
  assert.equal(updated.active, false);
  assert.equal(JSON.parse(updated.ruleJson).minimumCount, 3);
  assert.deepEqual(await admin.createAdminBadgeRule(actor, data, `badge-create-${stamp}`), created);
  assert.deepEqual(await admin.updateAdminBadgeRule({ ...actor, reason: "Raise milestone threshold" }, created.id, { ...data, minimumCount: 3, active: false }, `badge-update-${stamp}`), updated);
  await assert.rejects(admin.updateAdminBadgeRule(actor, created.id, data, `badge-update-${stamp}`), /idempotency/i);
  const entries = db.select().from(auditEvents).where(and(eq(auditEvents.targetType, "badge"), eq(auditEvents.targetId, String(created.id)))).all();
  assert.equal(entries.filter((entry) => entry.action === "badge.rule.created").length, 1);
  assert.equal(entries.filter((entry) => entry.action === "badge.rule.updated").length, 1);
  assert.equal(entries[0]?.ipHash?.length, 64);
  db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, session.id)).run();
  await assert.rejects(admin.updateAdminBadgeRule(actor, created.id, data, `revoked-${stamp}`), /session|administrator/i);
});
