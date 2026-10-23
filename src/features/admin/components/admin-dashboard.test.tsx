import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { adminQueryKeys } from "../api";
import { DashboardPanel } from "./admin-workspace";
import { auditExportUrl, fetchAllAuditExport, fetchAuditExportPart } from "./admin-operations-evidence";

const analytics = {
  periodDays: 30,
  generatedAt: "2026-10-23T00:00:00.000Z",
  usersByState: [],
  ideasByStatus: [{ status: "screening", count: 4 }, { status: "poc", count: 2 }],
  ideasByPriority: [{ band: "high", count: 3 }],
  ideasByDepartment: Array.from({ length: 11 }, (_, index) => ({ department: `Team ${index + 1}`, count: index + 1 })),
  usersByDepartment: [{ department: "Operations", count: 8 }],
  points: { total: 120, events: 9 },
  learning: { quizAttempts: 7, publishedArticles: 5, articleCompletions: 6 },
  auditByAction: [],
};

function render(role: "back_office" | "business_owner" = "back_office", data: typeof analytics = analytics) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
  client.setQueryData(adminQueryKeys.analytics, data);
  return renderToStaticMarkup(<QueryClientProvider client={client}><DashboardPanel role={role} /></QueryClientProvider>);
}

test("dashboard shows status, priority, department, points and learning evidence in bounded lists", () => {
  const markup = render("back_office");
  assert.match(markup, /Idea status/);
  assert.match(markup, /screening/);
  assert.match(markup, /Priority bands/);
  assert.match(markup, /high/);
  assert.match(markup, /Ideas by department/);
  assert.match(markup, /Team 10/);
  assert.doesNotMatch(markup, /Team 11/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /Users by department/);
  assert.match(markup, /Points ledger total/);
  assert.match(markup, /Quiz attempts/);
  assert.match(markup, /Article completions/);
});

test("CSV actions are visible only to profiles with export capability", () => {
  const allowed = render("back_office");
  for (const kind of ["ideas", "benefits", "feedback"]) {
    assert.match(allowed, new RegExp(`/api/admin/${kind}/export\\?limit=1000`));
  }
  assert.match(allowed, /Download audit CSV/);
  assert.match(allowed, /combines them into one CSV/);
  assert.doesNotMatch(render("business_owner"), /\/api\/admin\/ideas\/export/);
  assert.doesNotMatch(render("business_owner"), /Download audit CSV/);
});

test("dashboard explains empty aggregates", () => {
  const markup = render("back_office", { ...analytics, ideasByStatus: [], ideasByPriority: [], ideasByDepartment: [], usersByDepartment: [] });
  assert.match(markup, /No ideas in this group/);
  assert.match(markup, /No department counts yet/);
});

test("audit CSV continuation preserves filters and requests the next server cursor", async () => {
  const url = auditExportUrl({ action: "idea approved", from: "2026-10-01T00:00", actorUserId: "" }, 42);
  const parsed = new URL(url, "http://localhost");
  assert.equal(parsed.pathname, "/api/admin/audit/export");
  assert.equal(parsed.searchParams.get("limit"), "1000");
  assert.equal(parsed.searchParams.get("action"), "idea approved");
  assert.equal(parsed.searchParams.get("from"), "2026-10-01T00:00");
  assert.equal(parsed.searchParams.get("actorUserId"), null);
  assert.equal(parsed.searchParams.get("after"), "42");
  const seen: Array<{ input: string; init: RequestInit | undefined }> = [];
  const result = await fetchAuditExportPart(url, async (input, init) => {
    seen.push({ input: String(input), init });
    return new Response("id,action\r\n1,approved\r\n", { headers: { "x-next-after": "23", "content-type": "text/csv" } });
  });
  assert.equal(result.nextAfter, 23);
  assert.match(result.csv, /approved/);
  assert.equal(seen[0].input, url);
  assert.equal(seen[0].init?.credentials, "same-origin");
  assert.equal(seen[0].init?.cache, "no-store");
  const final = await fetchAuditExportPart(auditExportUrl({}, result.nextAfter), async () => new Response("id,action\r\n"));
  assert.equal(final.nextAfter, null);
});

test("audit CSV failures do not look like completed parts", async () => {
  await assert.rejects(fetchAuditExportPart(auditExportUrl({}), async () => new Response("Forbidden", { status: 403 })), /403/);
  await assert.rejects(fetchAuditExportPart(auditExportUrl({}), async () => new Response("id\r\n", { headers: { "x-next-after": "invalid" } })), /cursor/);
});

test("filtered audit export assembles every part before returning a CSV", async () => {
  const requested: string[] = [];
  const result = await fetchAllAuditExport({ action: "idea approved" }, async (input) => {
    const url = String(input);
    requested.push(url);
    if (requested.length === 1) return new Response("id,action\r\n9,approved\r\n", { headers: { "x-next-after": "5" } });
    return new Response("id,action\r\n4,approved\r\n");
  });
  assert.equal(result.parts, 2);
  assert.equal(result.csv, "id,action\r\n9,approved\r\n4,approved\r\n");
  for (const url of requested) {
    const parsed = new URL(url, "http://localhost");
    assert.equal(parsed.searchParams.get("action"), "idea approved");
    assert.equal(parsed.searchParams.get("limit"), "1000");
  }
  assert.equal(new URL(requested[1], "http://localhost").searchParams.get("after"), "5");
});

test("filtered audit export rejects a cursor that does not advance", async () => {
  let calls = 0;
  await assert.rejects(fetchAllAuditExport({}, async () => {
    calls += 1;
    return new Response("id,action\r\n9,approved\r\n", { headers: { "x-next-after": "9" } });
  }), /cursor did not advance/);
  assert.equal(calls, 2);
});
