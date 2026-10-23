import assert from "node:assert/strict";
import test from "node:test";
import { getAdminBadgeRules, saveAdminBadgeRule } from "./badge-api";

test("badge API uses bounded cursor pages and preserves the caller's idempotency key", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({ data: requests.length === 1 ? { items: [], nextAfter: null, availableEvents: [] } : { id: 8, code: "team-builder" }, error: null, requestId: "badge-test" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await getAdminBadgeRules(17);
    await saveAdminBadgeRule(8, { code: "team-builder", name: "Team Builder", description: "Collaborate", eventTypes: ["idea_support"], minimumCount: 3, active: true, reason: "Recognise collaboration" }, "badge-request-123");
    assert.equal(requests[0]?.url, "/api/admin/rewards/badges?limit=10&after=17");
    assert.equal(requests[1]?.url, "/api/admin/rewards/badges/8");
    assert.equal(requests[1]?.init?.method, "PATCH");
    assert.equal(new Headers(requests[1]?.init?.headers).get("Idempotency-Key"), "badge-request-123");
    assert.equal(JSON.parse(String(requests[1]?.init?.body)).minimumCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
