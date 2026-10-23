import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("employee reward routes revalidate sessions and expose shared envelopes", async () => {
  const rewards = await source("app/api/rewards/route.ts");
  const redemptions = await source("app/api/rewards/redemptions/route.ts");
  assert.match(rewards, /loadAuthorizationContext/);
  assert.match(redemptions, /Idempotency-Key/);
  assert.match(redemptions, /requestId/);
  assert.match(redemptions, /ok\(/);
  assert.match(redemptions, /handleApiError/);
});

test("admin reward routes use database-backed capability checks and privileged reasons", async () => {
  for (const path of [
    "app/api/admin/rewards/route.ts",
    "app/api/admin/rewards/[id]/route.ts",
    "app/api/admin/rewards/redemptions/[id]/fulfill/route.ts",
    "app/api/admin/rewards/redemptions/[id]/cancel/route.ts",
  ]) {
    const route = await source(path);
    assert.match(route, /loadAuthorizationContext/);
    assert.match(route, /assertCapability/);
    assert.match(route, /SETTINGS_MANAGE/);
    assert.match(route, /reason/);
  }
});
