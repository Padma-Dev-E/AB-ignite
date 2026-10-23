import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { users } from "../db/schema";
import { demoSessionSeconds } from "./config";
import { demoEmail } from "./demo-core";
import { issueRefreshToken, rotateRefreshToken } from "./refresh-core";

test("demo sessions stay within their original 30-day ceiling after rotation", async () => {
  const name = `Demo ${randomUUID()}`;
  const email = demoEmail(name, "a-secure-test-secret-long-enough");
  const user = db.insert(users).values({ name, email, department: "Technology", passwordHash: "invalid" }).returning({ id: users.id }).get();
  try {
    const first = await issueRefreshToken(user.id);
    assert.ok(first);
    const expires = first!.record.absoluteExpiresAt!.getTime();
    assert.ok(expires <= Date.now() + demoSessionSeconds * 1000);
    assert.equal(first!.record.expiresAt.getTime(), expires);
    const rotated = await rotateRefreshToken(first!.rawToken);
    assert.ok(rotated);
    assert.equal(rotated!.record.absoluteExpiresAt!.getTime(), expires);
    assert.equal(await rotateRefreshToken(first!.rawToken), null);
  } finally {
    db.delete(users).where(eq(users.id, user.id)).run();
  }
});
