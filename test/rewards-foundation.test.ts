import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("Wave 5 schema defines the append-only ledger, projections, rules, recognition, and redemption tables", async () => {
  const schema = await source("src/db/schema.ts");
  for (const table of [
    "point_rules",
    "points_ledger",
    "points_balances",
    "levels",
    "badges",
    "user_badges",
    "reward_versions",
    "redemptions",
    "reward_events",
  ]) {
    assert.match(schema, new RegExp(`sqliteTable\\(\\"${table}\\"`));
  }
  assert.match(schema, /active: integer\(\{ mode: "boolean" \}\)/);
  assert.match(schema, /idempotencyKey/);
  assert.match(schema, /cost: integer\(\)\.notNull\(\)/);
});

test("Wave 5 migration preserves legacy rewards tables and protects immutable records", async () => {
  const migration = await source("drizzle/0005_wave_5_rewards.sql");
  assert.match(migration, /CREATE TABLE[\s\S]*points_ledger/);
  assert.match(migration, /CREATE TABLE[\s\S]*redemptions/);
  assert.match(migration, /INSERT INTO `points_ledger`[\s\S]*`users`/);
  assert.match(migration, /points_ledger_no_update/);
  assert.match(migration, /points_ledger_no_delete/);
  assert.match(migration, /reward_events_no_update/);
  assert.match(migration, /reward_events_no_delete/);
  assert.match(migration, /ALTER TABLE `rewards` ADD `active`/);
  assert.doesNotMatch(migration, /DROP TABLE `rewards`/);
  assert.doesNotMatch(migration, /DROP TABLE `user_rewards`/);
});

test("Wave 5 repository and APIs are isolated to rewards ownership", async () => {
  const repository = await source("src/lib/rewards/repository.ts");
  const service = await source("src/lib/rewards/service.ts");
  assert.match(repository, /db\.transaction/);
  assert.match(repository, /pointsLedger/);
  assert.match(repository, /rewardVersions/);
  assert.match(service, /loadAuthorizationContext|assertCapability/);
  assert.doesNotMatch(service, /users\.points|users\)\.set\(\{[\s\S]*points/);
  for (const path of [
    "app/api/rewards/route.ts",
    "app/api/rewards/redemptions/route.ts",
    "app/api/rewards/badges/route.ts",
    "app/api/admin/rewards/route.ts",
    "app/api/admin/rewards/[id]/route.ts",
    "app/api/admin/rewards/redemptions/route.ts",
    "app/api/admin/rewards/redemptions/[id]/fulfill/route.ts",
    "app/api/admin/rewards/redemptions/[id]/cancel/route.ts",
  ]) {
    await source(path);
  }
});
