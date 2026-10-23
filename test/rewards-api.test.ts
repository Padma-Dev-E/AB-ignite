import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("employee rewards endpoint revalidates sessions and exposes shared envelopes", async () => {
  const rewards = await source("app/api/rewards/route.ts");
  const access = await source("src/lib/rewards/http.ts");
  assert.match(access, /loadAuthorizationContext/);
  assert.match(access, /handleApiError/);
  assert.match(rewards, /employeeContext/);
  await assert.rejects(source("app/api/rewards/redemptions/route.ts"));
});

test("admin reward catalogue routes use database-backed capability checks and privileged reasons", async () => {
  for (const path of [
    "app/api/admin/rewards/route.ts",
    "app/api/admin/rewards/[id]/route.ts",
  ]) {
    const route = await source(path);
    assert.match(route, /adminContext/);
    assert.match(route, /auth/);
    assert.match(route, /reason/);
  }
  await assert.rejects(source("app/api/admin/rewards/redemptions/route.ts"));
  const access = await source("src/lib/rewards/http.ts");
  assert.match(access, /assertCapability/);
  assert.match(access, /SETTINGS_MANAGE/);
  assert.match(access, /REWARDS_MANAGE/);
});

test("admin frontend no longer exposes redemption queue or action APIs", async () => {
  const api = await source("src/features/admin/api.ts");
  const hooks = await source("src/features/admin/hooks.ts");
  assert.doesNotMatch(api, /\/api\/admin\/rewards\/redemptions|actOnAdminRedemption|RedemptionAction/);
  assert.doesNotMatch(hooks, /useAdminRedemptions|useAdminRedemptionAction|redemptions/);
});

test("rewards catalogue and badges remain available without redemption routes", async () => {
  const employee = await source("app/page.tsx");
  const admin = await source("src/features/admin/components/admin-shell.tsx");
  assert.match(employee, /<LiveRewardsPage \/>/);
  assert.match(admin, /id: "rewards", label: "Rewards"/);
  await assert.rejects(source("app/api/rewards/redemptions/route.ts"));
});
