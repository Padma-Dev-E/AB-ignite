import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import { users, refreshTokens, auditEvents } from '../../db/schema';

// Install a fresh in-memory connection before loading the production service.
const sqlite = new Database(':memory:');
(globalThis as unknown as { sqlite: Database.Database }).sqlite = sqlite;
for (const table of [users, refreshTokens, auditEvents]) {
  const config = getTableConfig(table);
  sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
}
let db: typeof import('../../db/connection').db;
let changePassword: typeof import('./password-service').changePassword;
let hashPassword: typeof import('../../auth/password-core').hashPassword;
let verifyPassword: typeof import('../../auth/password-core').verifyPassword;
before(async () => {
  ({ db } = await import('../../db/connection'));
  ({ changePassword } = await import('./password-service'));
  ({ hashPassword, verifyPassword } = await import('../../auth/password-core'));
});
async function fixture() {
  const user = db.insert(users).values({ name: 'Password test', email: `${crypto.randomUUID()}@example.test`, passwordHash: await hashPassword('CurrentPass1') }).returning().get();
  const session = db.insert(refreshTokens).values({ userId: user.id, tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60000) }).returning().get();
  return { userId: user.id, sessionId: session.id };
}
test('accounts without an explicit forced-change policy default to not forced', async () => {
  const actor = await fixture();
  assert.equal(db.select().from(users).where(eq(users.id, actor.userId)).get()!.mustChangePassword, false);
});
test('wrong current password leaves hash and sessions intact, records failure', async () => {
  const actor = await fixture();
  await assert.rejects(changePassword(actor, { currentPassword: 'WrongPass1', newPassword: 'DifferentPass2' }), /incorrect/);
  const user = db.select().from(users).where(eq(users.id, actor.userId)).get()!;
  assert.equal(await verifyPassword(user.passwordHash, 'CurrentPass1'), true);
  assert.equal(user.failedLoginAttempts, 1);
  assert.equal(db.select().from(refreshTokens).where(eq(refreshTokens.id, actor.sessionId)).get()!.revokedAt, null);
});
test('successful authenticated password change transactionally clears a forced-change flag', async () => {
  const actor = await fixture();
  db.update(users).set({ mustChangePassword: true }).where(eq(users.id, actor.userId)).run();
  await changePassword(actor, { currentPassword: 'CurrentPass1', newPassword: 'DifferentPass2' });
  assert.equal(db.select().from(users).where(eq(users.id, actor.userId)).get()!.mustChangePassword, false);
  assert.ok(db.select().from(refreshTokens).where(eq(refreshTokens.userId, actor.userId)).all().every(s => s.revokedAt));
});
test('failed password change leaves the forced-change flag set', async () => {
  const actor = await fixture();
  db.update(users).set({ mustChangePassword: true }).where(eq(users.id, actor.userId)).run();
  await assert.rejects(changePassword(actor, { currentPassword: 'WrongPass1', newPassword: 'DifferentPass2' }), /incorrect/);
  assert.equal(db.select().from(users).where(eq(users.id, actor.userId)).get()!.mustChangePassword, true);
});
test('change hashes password, revokes every session, audits without secrets and blocks replay', async () => {
  const actor = await fixture();
  db.insert(refreshTokens).values({ userId: actor.userId, tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60000) }).run();
  await changePassword(actor, { currentPassword: 'CurrentPass1', newPassword: 'DifferentPass2' });
  const user = db.select().from(users).where(eq(users.id, actor.userId)).get()!;
  assert.equal(await verifyPassword(user.passwordHash, 'DifferentPass2'), true);
  assert.equal(user.sessionVersion, 1);
  assert.ok(db.select().from(refreshTokens).where(eq(refreshTokens.userId, actor.userId)).all().every(s => s.revokedAt));
  const logs = db.select().from(auditEvents).where(eq(auditEvents.actorUserId, actor.userId)).all();
  assert.equal(logs[0].action, 'account.password.changed');
  assert.equal(JSON.stringify(logs).includes('DifferentPass2'), false);
  await assert.rejects(changePassword(actor, { currentPassword: 'DifferentPass2', newPassword: 'AnotherPass3' }), /Sign in again/);
});
test('session belonging to someone else cannot change password', async () => {
  const a = await fixture(), b = await fixture();
  await assert.rejects(changePassword({ userId: a.userId, sessionId: b.sessionId }, { currentPassword: 'CurrentPass1', newPassword: 'DifferentPass2' }), /Sign in again/);
});

test('five failures lock out further password verification', async () => {
  const actor = await fixture();
  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(changePassword(actor, { currentPassword: 'WrongPass1', newPassword: 'DifferentPass2' }), /incorrect/);
  }
  await assert.rejects(changePassword(actor, { currentPassword: 'CurrentPass1', newPassword: 'DifferentPass2' }), /Too many attempts/);
  assert.equal(db.select().from(users).where(eq(users.id, actor.userId)).get()!.failedLoginAttempts, 5);
});
