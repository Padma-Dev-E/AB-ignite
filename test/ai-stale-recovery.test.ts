import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

test("stale AI runs recover once, retain audit history, and fence old attempts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ignite-ai-stale-"));
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = join(directory, "test.db");
  try {
    const { db } = await import("../src/db/connection");
    const { aiRuns, ideaVersions, ideas, users } = await import("../src/db/schema");
    const repository = await import("../src/lib/ideas/repository");
    migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });

    const [user] = db.insert(users).values({ name: "Lease Test", email: "lease@example.test", passwordHash: "test" }).returning().all();
    const [idea] = db.insert(ideas).values({ authorId: user.id, title: "Lease test", summary: "Test stale AI run recovery", category: "Operations", reference: "LEASE-TEST" }).returning().all();
    const [version] = db.insert(ideaVersions).values({ ideaId: idea.id, authorId: user.id, version: 1, kind: "idea", title: "Lease test", summary: "Test stale AI run recovery", category: "Operations", dataClassification: "internal", contentHash: "lease-test" }).returning().all();
    const makeRun = (key: string) => repository.createAiRun({ ideaId: idea.id, ideaVersionId: version.id, jobKey: "idea.validate", jobVersion: "1", promptVersion: "1", model: "test", idempotencyKey: key, correlationId: key, inputHash: "test" });
    const run = await makeRun("stale-recover-once");
    const t0 = new Date(Date.now() + 1_000);
    const first = await repository.claimAiRun(run.id, "worker-one", t0);
    assert.equal(first?.attemptCount, 1);
    assert.equal(await repository.recoverStaleAiRuns(new Date(t0.getTime() + 59_999), 60_000, 2), 0);
    assert.equal(await repository.recoverStaleAiRuns(new Date(t0.getTime() + 60_000), 60_000, 2), 1);
    assert.equal(await repository.recoverStaleAiRuns(new Date(t0.getTime() + 60_000), 60_000, 2), 0);

    const retry = await repository.claimNextAiRun("worker-two", new Date(t0.getTime() + 60_000));
    assert.equal(retry?.id, run.id);
    assert.equal(retry?.attemptCount, 2);
    await assert.rejects(
      repository.withAiRunLease(first!, () => repository.completeAiRun(run.id, { resultJson: "{}" })),
      /lease|ownership/i,
    );
    await assert.rejects(
      repository.withAiRunLease(first!, () => repository.failAiRun(run.id, { errorCode: "provider_error", errorMessage: "old worker" })),
      /lease|ownership/i,
    );
    assert.equal((await db.select().from(aiRuns).where(eq(aiRuns.id, run.id)).all())[0]?.status, "running");
    await repository.withAiRunLease(retry!, () => repository.completeAiRun(run.id, { resultJson: "{}" }));
    assert.equal((await db.select().from(aiRuns).where(eq(aiRuns.id, run.id)).all())[0]?.status, "succeeded");
    assert.equal((await repository.createAiRun({ ideaId: idea.id, ideaVersionId: version.id, jobKey: "idea.validate", jobVersion: "1", promptVersion: "1", model: "test", idempotencyKey: "stale-recover-once", correlationId: "stale-recover-once", inputHash: "test" })).id, run.id);
    assert.deepEqual((await repository.getAiRunEvents(idea.id, run.id)).map((event) => event.eventType), ["queued", "running", "retry", "running", "succeeded"]);

    const exhausted = await makeRun("stale-exhausted");
    await repository.claimAiRun(exhausted.id, "worker-one", t0);
    await repository.recoverStaleAiRuns(new Date(t0.getTime() + 60_000), 60_000, 1);
    const exhaustedRow = (await db.select().from(aiRuns).where(eq(aiRuns.id, exhausted.id)).all())[0];
    assert.equal(exhaustedRow?.status, "timed_out");
    assert.equal(exhaustedRow?.attemptCount, 1);
    assert.deepEqual((await repository.getAiRunEvents(idea.id, exhausted.id)).map((event) => event.eventType), ["queued", "running", "failed"]);
    assert.equal(await repository.recoverStaleAiRuns(new Date(t0.getTime() + 120_000), 60_000, 1), 0);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    rmSync(directory, { recursive: true, force: true });
  }
});
