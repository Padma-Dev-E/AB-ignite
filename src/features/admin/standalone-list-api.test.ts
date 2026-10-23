import assert from "node:assert/strict";
import test from "node:test";
import { listAdminEvaluationPage, listAdminFeedbackPage } from "./standalone-list-api";

test("feedback and routed evaluation lists request ten records using the next cursor", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ data: { items: [], nextAfter: null }, error: null, requestId: "cursor-test" }), { headers: { "content-type": "application/json" } });
  };
  try {
    await listAdminFeedbackPage(null);
    await listAdminFeedbackPage(31);
    await listAdminEvaluationPage(null);
    await listAdminEvaluationPage(42);
    assert.deepEqual(urls, [
      "/api/admin/feedback?limit=10",
      "/api/admin/feedback?limit=10&after=31",
      "/api/admin/governance/evaluations?limit=10",
      "/api/admin/governance/evaluations?limit=10&after=42",
    ]);
  } finally { globalThis.fetch = original; }
});
