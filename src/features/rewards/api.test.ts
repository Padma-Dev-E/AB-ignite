import assert from "node:assert/strict";
import test from "node:test";
import { getRewards } from "./api";

const envelope = (data: unknown) => new Response(JSON.stringify({ data, error: null, requestId: "client-test" }), { status: 200, headers: { "content-type": "application/json" } });

test("employee reward summary uses the rewards endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return envelope({ items: [] });
  }) as typeof fetch;
  try {
    await getRewards();
    assert.deepEqual(requests.map(({ input }) => String(input)), [
      "/api/rewards",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
