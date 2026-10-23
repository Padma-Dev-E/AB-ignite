import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin route delegates to the reusable workspace and keeps its role guard", async () => {
  const page = await source("app/private/admin/page.tsx");
  assert.match(page, /session\.user\.role !== "admin"/);
  assert.match(page, /AdminWorkspace/);
  assert.match(page, /session\.user\.email/);
});

test("admin feature owns TanStack Query wiring for available quiz and rewards APIs", async () => {
  const api = await source("src/features/admin/api.ts");
  const hooks = await source("src/features/admin/hooks.ts");
  assert.match(api, /\/api\/quizzes/);
  assert.match(api, /\/api\/challenges/);
  assert.match(api, /\/api\/admin\/rewards/);
  assert.match(api, /\/api\/admin\/rewards\/redemptions/);
  assert.match(hooks, /useQuery/);
  assert.match(hooks, /useAdminQuizCatalogue/);
  assert.match(hooks, /useAdminRewards/);
  assert.match(hooks, /useAdminRedemptions/);
});

test("admin workspace exposes safe states for unavailable operations", async () => {
  const workspace = await source("src/features/admin/components/admin-workspace.tsx");
  assert.match(workspace, /Not configured/);
  assert.match(workspace, /Screening/);
  assert.match(workspace, /Transformation/);
  assert.match(workspace, /Evaluation/);
  assert.match(workspace, /Users/);
  assert.match(workspace, /RBAC/);
  assert.match(workspace, /Sessions/);
  assert.match(workspace, /Audit/);
  assert.match(workspace, /Settings/);
  assert.match(workspace, /isLoading/);
  assert.match(workspace, /isError/);
});
