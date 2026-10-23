import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("rewards schema defines the append-only ledger, projections, rules, and recognition", async () => {
  const schema = await source("src/db/schema.ts");
  for (const table of [
    "point_rules",
    "points_ledger",
    "points_balances",
    "levels",
    "badges",
    "user_badges",
    "reward_versions",
  ]) {
    assert.match(schema, new RegExp(`sqliteTable\\(\\"${table}\\"`));
  }
  assert.doesNotMatch(schema, /sqliteTable\("redemptions"|sqliteTable\("reward_events"|sqliteTable\("user_rewards"/);
  assert.match(schema, /active: integer\(\{ mode: "boolean" \}\)/);
  assert.match(schema, /idempotencyKey/);
  assert.match(schema, /cost: integer\(\)\.notNull\(\)/);
});

test("Wave 5 foundation and cleanup migrations preserve the catalogue and protect immutable records", async () => {
  const migration = await source("drizzle/0005_wave_5_rewards.sql");
  const cleanup = await source("drizzle/0020_remove_redemption_catalogue.sql");
  assert.match(migration, /CREATE TABLE[\s\S]*points_ledger/);
  assert.match(migration, /CREATE TABLE[\s\S]*redemptions/);
  assert.match(migration, /INSERT INTO `points_ledger`[\s\S]*`users`/);
  assert.match(migration, /points_ledger_no_update/);
  assert.match(migration, /points_ledger_no_delete/);
  assert.match(migration, /reward_events_no_update/);
  assert.match(migration, /reward_events_no_delete/);
  assert.match(migration, /ALTER TABLE `rewards` ADD `active`/);
  assert.doesNotMatch(migration, /DROP TABLE `rewards`/);
  assert.match(cleanup, /DROP TABLE `redemptions`/);
  assert.match(cleanup, /DROP TABLE `reward_events`/);
  assert.match(cleanup, /DROP TABLE `user_rewards`/);
  assert.doesNotMatch(cleanup, /DROP TABLE `rewards`|DROP TABLE `reward_versions`/);
});

test("Wave 5 repository and APIs are isolated to rewards ownership", async () => {
  const repository = await source("src/lib/rewards/repository.ts");
  const service = await source("src/lib/rewards/service.ts");
  assert.match(repository, /db\.transaction/);
  assert.match(repository, /pointsLedger/);
  assert.match(repository, /rewardVersions/);
  assert.match(service, /auditEvents/);
  assert.doesNotMatch(service, /users\.points|users\)\.set\(\{[\s\S]*points/);
  for (const path of [
    "app/api/rewards/route.ts",
    "app/api/rewards/badges/route.ts",
    "app/api/admin/rewards/route.ts",
    "app/api/admin/rewards/[id]/route.ts",
  ]) {
    if (path.includes("redemptions")) await assert.rejects(source(path));
    else await source(path);
  }
});
