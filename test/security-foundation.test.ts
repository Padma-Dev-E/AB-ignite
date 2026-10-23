import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("security schema defines account counters, session metadata, and append-only audit storage", async () => {
  const schema = await source("src/db/schema.ts");
  assert.match(schema, /failedLoginAttempts/);
  assert.match(schema, /lockedUntil/);
  assert.match(schema, /sessionVersion/);
  assert.match(schema, /ipHash/);
  assert.match(schema, /userAgentHash/);
  assert.match(schema, /idleExpiresAt/);
  assert.match(schema, /absoluteExpiresAt/);
  assert.match(schema, /revocationReason/);
  assert.match(schema, /sqliteTable\("audit_events"/);
  assert.match(schema, /auditEvents/);
});

test("Wave 0 migration adds security tables and append-only protections", async () => {
  const migrations = await source("drizzle/0004_wave_0_security.sql");
  assert.match(migrations, /CREATE TABLE[\s\S]*audit_events/);
  assert.match(migrations, /failedLoginAttempts|failed_login_attempts/);
  assert.match(migrations, /audit_events_no_update/);
  assert.match(migrations, /audit_events_no_delete/);
});

test("roles map to explicit capabilities without adding JWT roles", async () => {
  const permissions = await import("../src/lib/auth/permissions");
  assert.deepEqual(permissions.capabilitiesForRole("user"), ["ideas.read", "ideas.write", "profile.read"]);
  assert.ok(permissions.hasCapability("admin", "users.manage"));
  assert.ok(permissions.hasCapability("admin", "audit.read"));
  assert.equal(permissions.hasCapability("user", "users.manage"), false);
});

test("audit metadata is allowlisted and request identities are hashed", async () => {
  const { hashAuditValue, redactAuditMetadata } = await import("../src/lib/audit/redaction-core");
  const metadata = redactAuditMetadata({
    status: "approved",
    attempt: 5,
    password: "do-not-store",
    token: "do-not-store",
    nested: { secret: "do-not-store" },
  });
  assert.deepEqual(metadata, { status: "approved", attempt: 5 });
  assert.notEqual(hashAuditValue("203.0.113.10"), "203.0.113.10");
  assert.equal(hashAuditValue("203.0.113.10"), hashAuditValue("203.0.113.10"));
});

test("login security locks after five failures and resets on success", async () => {
  const security = await import("../src/auth/security-core");
  const now = new Date("2026-10-23T12:00:00.000Z");
  let state = { failedLoginAttempts: 0, lockedUntil: null as Date | null };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    state = security.nextLoginFailure(state, now);
    assert.equal(state.failedLoginAttempts, attempt);
    assert.equal(state.lockedUntil, null);
  }
  state = security.nextLoginFailure(state, now);
  assert.equal(state.failedLoginAttempts, 5);
  assert.equal(state.lockedUntil?.toISOString(), "2026-10-23T12:15:00.000Z");
  assert.equal(security.isLoginLocked(state, new Date("2026-10-23T12:14:59.000Z")), true);
  assert.equal(security.isLoginLocked(state, new Date("2026-10-23T12:15:00.000Z")), false);
  assert.equal(security.nextLoginFailure(state, new Date("2026-10-23T12:16:00.000Z")).failedLoginAttempts, 1);
  assert.deepEqual(security.successfulLoginState(now), {
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: now,
  });
});

test("session policy enforces active, non-revoked, idle, absolute, and version state", async () => {
  const { isSessionActive } = await import("../src/auth/security-core");
  const now = new Date("2026-10-23T12:00:00.000Z");
  const session = {
    revokedAt: null,
    idleExpiresAt: new Date("2026-10-23T12:20:00.000Z"),
    absoluteExpiresAt: new Date("2026-10-23T20:00:00.000Z"),
    sessionVersion: 3,
  };
  assert.equal(isSessionActive(session, { isActive: true, sessionVersion: 3 }, now), true);
  assert.equal(isSessionActive(session, { isActive: false, sessionVersion: 3 }, now), false);
  assert.equal(isSessionActive(session, { isActive: true, sessionVersion: 2 }, now), false);
  assert.equal(isSessionActive({ ...session, revokedAt: now }, { isActive: true, sessionVersion: 3 }, now), false);
  assert.equal(isSessionActive({ ...session, idleExpiresAt: new Date("2026-10-23T11:59:59.000Z") }, { isActive: true, sessionVersion: 3 }, now), false);
  assert.equal(isSessionActive({ ...session, absoluteExpiresAt: new Date("2026-10-23T11:59:59.000Z") }, { isActive: true, sessionVersion: 3 }, now), false);
});

test("privileged mutations require a bounded non-empty reason", async () => {
  const { requirePrivilegedReason } = await import("../src/lib/auth/authorization-core");
  assert.throws(() => requirePrivilegedReason("   "), /reason/i);
  assert.throws(() => requirePrivilegedReason("x".repeat(501)), /reason/i);
  assert.equal(requirePrivilegedReason("  approved for control review  "), "approved for control review");
});

test("auth and refresh paths carry DB-backed security state and hashed session metadata", async () => {
  const auth = await source("auth.ts");
  const refresh = await source("src/auth/refresh-core.ts");
  assert.match(auth, /failedLoginAttempts|nextLoginFailure/);
  assert.match(auth, /lastLoginAt|successfulLoginState/);
  assert.match(auth, /isActive/);
  assert.match(auth, /sessionVersion/);
  assert.match(refresh, /hashAuditValue/);
  assert.match(refresh, /idleExpiresAt/);
  assert.match(refresh, /absoluteExpiresAt/);
  assert.match(refresh, /revocationReason/);
  assert.match(refresh, /isSessionActive/);
});

test("audit records keep reason and redacted metadata bounded", async () => {
  const service = await source("src/lib/audit/service.ts");
  assert.match(service, /requiresReason/);
  assert.match(service, /serializeAuditMetadata/);
  assert.match(service, /hashAuditValue\(input\.ipAddress\)/);
  assert.match(service, /hashAuditValue\(input\.userAgent\)/);
  assert.match(service, /auditEvents/);
});
