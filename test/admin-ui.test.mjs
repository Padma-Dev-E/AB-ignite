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

test("admin people, settings, audit, and analytics controls cover the acceptance surfaces", async () => {
  const [people, settings, workspace, evidence, api] = await Promise.all([
    source("src/features/admin/components/admin-people-management.tsx"),
    source("src/features/admin/components/admin-settings-editor.tsx"),
    source("src/features/admin/components/admin-workspace.tsx"),
    source("src/features/admin/components/admin-operations-evidence.tsx"),
    source("src/features/admin/api.ts"),
  ]);
  assert.match(people, /Reset password/);
  assert.match(people, /Revoke/);
  assert.match(people, /fetchNextPage/);
  for (const field of ["priority_kpis", "priority_bands", "sla_days", "required_controls", "departments", "demo_access", "profiles"]) assert.ok(settings.includes(field), `missing setting control: ${field}`);
  assert.match(settings, /Configured levels|Ignite levels/);
  assert.match(workspace, /Export this filtered view/);
  assert.match(workspace, /JSON\.stringify\(event\.metadata\)/);
  for (const kind of ["ideas", "benefits", "feedback", "audit"]) assert.ok(api.includes(`"${kind}"`), `missing ${kind} export kind`);
  for (const metric of ["ideasByStatus", "ideasByPriority", "usersByDepartment", "points", "articleCompletions"]) assert.ok(evidence.includes(metric), `missing analytics measure ${metric}`);
});

test("admin exports expose the requested datasets with bounded no-store CSV handling", async () => {
  const [ideas, benefits, feedback, audit, sharedExport] = await Promise.all([
    source("app/api/admin/ideas/export/route.ts"),
    source("app/api/admin/benefits/export/route.ts"),
    source("app/api/admin/feedback/export/route.ts"),
    source("app/api/admin/audit/export/route.ts"),
    source("src/lib/admin/export.ts"),
  ]);
  for (const handler of [ideas, benefits, feedback, audit]) {
    assert.match(handler, /CAPABILITIES\.AUDIT_EXPORT/);
    assert.match(handler, /(?:parsePage\(new URL\(request\.url\), 1000\)|auditFilters\(url, 1000\))/);
    assert.match(handler, /(?:exportCsvResponse|new Response)/);
  }
  assert.match(sharedExport, /text\/csv/);
  assert.match(sharedExport, /cache-control/);
  assert.match(sharedExport, /no-store/);
  for (const field of ["reference", "status", "priorityBand", "priorityScore", "benefits", "summary"]) assert.ok(sharedExport.includes(`"${field}"`));
  for (const field of ["reference", "benefits", "priorityScore", "department"]) assert.ok(sharedExport.includes(`"${field}"`));
  for (const field of ["campaignId", "category", "message", "response", "respondedAt"]) assert.ok(sharedExport.includes(`"${field}"`));
  assert.match(audit, /auditFilters/);
  assert.match(audit, /auditFilters/);
  assert.match((await source("src/lib/admin/query.ts")), /metadata,ipHash/);
});
