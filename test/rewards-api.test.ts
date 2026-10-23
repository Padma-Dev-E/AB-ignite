import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("employee reward routes revalidate sessions and expose shared envelopes", async () => {
  const rewards = await source("app/api/rewards/route.ts");
  const redemptions = await source("app/api/rewards/redemptions/route.ts");
  const access = await source("src/lib/rewards/http.ts");
  assert.match(access, /loadAuthorizationContext/);
  assert.match(access, /handleApiError/);
  assert.match(rewards, /employeeContext/);
  assert.match(redemptions, /Idempotency-Key/);
  assert.match(redemptions, /requestId/);
  assert.match(redemptions, /ok\(/);
});

test("admin reward routes use database-backed capability checks and privileged reasons", async () => {
  for (const path of [
    "app/api/admin/rewards/route.ts",
    "app/api/admin/rewards/[id]/route.ts",
  ]) {
    const route = await source(path);
    assert.match(route, /adminContext/);
    assert.match(route, /auth/);
    assert.match(route, /reason/);
  }
  for (const path of [
    "app/api/admin/rewards/redemptions/route.ts",
    "app/api/admin/rewards/redemptions/[id]/fulfill/route.ts",
    "app/api/admin/rewards/redemptions/[id]/cancel/route.ts",
  ]) {
    const route = await source(path);
    assert.match(route, /redemptionContext/);
    assert.match(route, /auth/);
  }
  const access = await source("src/lib/rewards/http.ts");
  assert.match(access, /assertCapability/);
  assert.match(access, /SETTINGS_MANAGE/);
  assert.match(access, /REWARDS_MANAGE/);
});

test("admin redemption actions preserve a caller-owned idempotency key across retries", async () => {
  const api = await source("src/features/admin/api.ts");
  assert.match(
    api,
    /actOnAdminRedemption\(\s*id: number,\s*action: RedemptionAction,\s*reason: string,\s*idempotencyKey: string,?\s*\)/,
  );
  assert.match(api, /"Idempotency-Key": idempotencyKey/);
});
