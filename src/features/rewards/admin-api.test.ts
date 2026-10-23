import assert from "node:assert/strict";
import test from "node:test";
import { createAdminReward, getAdminRewardCatalogue, updateAdminReward, type AdminRewardInput } from "./api";

const envelope = (data: unknown) => new Response(JSON.stringify({ data, error: null, requestId: "admin-reward-test" }), { status: 200, headers: { "content-type": "application/json" } });

test("admin catalogue reads and audited writes use the secured reward routes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    const data = String(input) === "/api/admin/rewards" && !init?.method ? { items: [] } : { reward: { id: 8 }, version: { id: 12 } };
    return envelope(data);
  }) as typeof fetch;
  const payload: AdminRewardInput = { name: "Team recognition", description: null, kind: "earned", cost: 25, emoji: "★", active: true, reason: "Approved recognition catalogue change" };
  try {
    assert.deepEqual(await getAdminRewardCatalogue(), []);
    await createAdminReward(payload);
    await updateAdminReward(8, { ...payload, active: false });
    assert.deepEqual(requests.map(({ input }) => String(input)), ["/api/admin/rewards", "/api/admin/rewards", "/api/admin/rewards/8"]);
    assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), payload);
    assert.equal(requests[2]?.init?.method, "PATCH");
    assert.equal(JSON.parse(String(requests[2]?.init?.body)).reason, payload.reason);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
