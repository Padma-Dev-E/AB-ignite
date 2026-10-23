import assert from "node:assert/strict";
import test from "node:test";
import { getRedemptions, getRewards, requestRedemption } from "./api";

const envelope = (data: unknown) => new Response(JSON.stringify({ data, error: null, requestId: "client-test" }), { status: 200, headers: { "content-type": "application/json" } });

test("employee reward summary and redemption history use their paged endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return envelope({ items: [] });
  }) as typeof fetch;
  try {
    await getRewards();
    await getRedemptions({ page: 2, pageSize: 10 });
    assert.deepEqual(requests.map(({ input }) => String(input)), [
      "/api/rewards", "/api/rewards/redemptions?page=2&pageSize=10",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("redemption sends the same idempotency key in header and body", async () => {
  const originalFetch = globalThis.fetch;
  let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { input, init };
    return envelope({});
  }) as typeof fetch;
  try {
    await requestRedemption(19, "redemption-intent-key-19");
    assert.equal(new Headers(request?.init?.headers).get("idempotency-key"), "redemption-intent-key-19");
    assert.deepEqual(JSON.parse(String(request?.init?.body)), { rewardId: 19, idempotencyKey: "redemption-intent-key-19" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
