import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const directory = mkdtempSync(join(tmpdir(), "ignite-retired-demo-login-"));
const databasePath = join(directory, "test.db");
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databasePath;

let db: typeof import("../src/db/connection").db;
let schema: typeof import("../src/db/schema");
let post: typeof import("../app/api/demo/session/route").POST;

before(async () => {
  ({ db } = await import("../src/db/connection"));
  schema = await import("../src/db/schema");
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  ({ POST: post } = await import("../app/api/demo/session/route"));
});

after(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(directory, { recursive: true, force: true });
});

test("legacy name-only entry is permanently disabled without creating a user or session", async () => {
  const beforeUsers = db.select().from(schema.users).all().length;
  const beforeSessions = db.select().from(schema.refreshTokens).all().length;
  const beforeAudit = db.select().from(schema.auditEvents).all().length;
  const response = await post(new Request("https://bank.example.test/api/demo/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.57",
      "user-agent": "retired-demo-login-test",
    },
    body: JSON.stringify({ name: "Private Demo Person", department: "Technology" }),
  }));

  assert.equal(response.status, 410);
  assert.equal((await response.json()).error.code, "login_method_removed");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(db.select().from(schema.users).all().length, beforeUsers);
  assert.equal(db.select().from(schema.refreshTokens).all().length, beforeSessions);
  const audit = db.select().from(schema.auditEvents).all();
  assert.equal(audit.length, beforeAudit + 1);
  assert.equal(audit.at(-1)?.action, "auth.demo.rejected");
  assert.deepEqual(JSON.parse(audit.at(-1)!.metadataJson!), { reasonCode: "login_method_removed" });
  assert.ok(!JSON.stringify(audit.at(-1)).includes("Private Demo Person"));
  assert.ok(!JSON.stringify(audit.at(-1)).includes("203.0.113.57"));
  assert.ok(!JSON.stringify(audit.at(-1)).includes("retired-demo-login-test"));
});
