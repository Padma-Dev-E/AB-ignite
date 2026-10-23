import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { listAdminBusinessOwners, listAdminScreening, listAdminTransformation } from "../api";
import { visibleAdminViews } from "./admin-shell";

test("three-role navigation keeps back-office areas and removes the duplicate Tasks view", () => {
  const all = visibleAdminViews("back_office");
  assert.equal(all.length, 12);
  assert.deepEqual(visibleAdminViews("business_owner"), ["ideas"]);
  assert.deepEqual(visibleAdminViews("employee"), []);
  assert.equal(all.includes("tasks" as never), false);
});

test("admin shell offers the employee portal only to admin roles", async () => {
  const shell = await readFile(new URL("./admin-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /role === "back_office" \|\| role === "business_owner"/);
  assert.match(shell, /role === "business_owner" \? "Return to employee portal"/);
  assert.match(shell, /Open the employee portal/);
});

test("governance endpoints use numeric page size and server cursor", async () => {
  const seen: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    seen.push(String(input));
    return new Response(JSON.stringify({ data: { items: [], nextAfter: null }, error: null, requestId: "test" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await listAdminScreening();
    await listAdminScreening(10, 42);
    await listAdminTransformation(10, 29);
    await listAdminBusinessOwners(100, 17);
    assert.deepEqual(seen, [
      "/api/admin/governance/queues/screening?limit=50",
      "/api/admin/governance/queues/screening?limit=10&after=42",
      "/api/admin/governance/queues/transformation?limit=10&after=29",
      "/api/admin/governance/owners?limit=100&after=17",
    ]);
  } finally { globalThis.fetch = original; }
});

test("legacy query hooks pass no TanStack context object to queue API functions", async () => {
  const hooks = await readFile(new URL("../hooks.ts", import.meta.url), "utf8");
  assert.match(hooks, /queryFn: \(\) => listAdminScreening\(\)/);
  assert.match(hooks, /queryFn: \(\) => listAdminTransformation\(\)/);
  assert.match(hooks, /getNextPageParam: \(page\) => page\.nextAfter \?\? undefined/);
});

test("governance queues remain in Queues and Ideas after Tasks removal", async () => {
  const [workspace, queues] = await Promise.all([
    readFile(new URL("./admin-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./admin-transformation-queues.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(queues, /Queue 1 · New ideas from employees/);
  assert.match(queues, /Queue 2 · Approved by business owners/);
  assert.match(queues, /query\.fetchNextPage\(\)/);
  assert.match(queues, /Load more to check the next page/);
  assert.match(queues, /matching\.slice\(page \* 10, page \* 10 \+ 10\)/);
  assert.match(queues, /onClick=\{loadMore\}/);
  assert.match(workspace, /<AdminRewardCatalogueManager \/>/);
  assert.doesNotMatch(workspace, /AdminRedemption/);
  assert.match(workspace, /function LearningPanel\(\) \{[\s\S]*<AdminLearningContent \/>/);
  assert.doesNotMatch(workspace, /case "tasks"/);
  const shell = await readFile(new URL("./admin-shell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(shell, /id: "tasks"/);
});

test("workspace audit list requests ten rows with visible page controls", async () => {
  const workspace = await readFile(new URL("./admin-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /limit=10\$\{/);
  assert.match(workspace, /nextAfter \?\? undefined/);
  assert.match(workspace, /useWorkspacePages<AdminAuditEvent>\(path, true\)/);
  assert.match(workspace, /PageControls label="Audit trail"/);
  assert.match(workspace, /case "dashboard": content = <DashboardPanel role=\{role\} \/>/);
});
