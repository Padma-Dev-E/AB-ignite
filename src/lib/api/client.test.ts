import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, apiFetch, parseApiResponse } from "./client";
import { refreshSession } from "../../auth/client-refresh";

const envelope = (data: unknown, error: unknown = null) => ({ data, error, requestId: "req-123" });

test("unwraps success data, including null and falsy values", async () => {
  for (const value of [{ id: "idea-1" }, null, false, 0, ""]) {
    assert.deepEqual(await parseApiResponse(new Response(JSON.stringify(envelope(value)))), value);
  }
});

test("preserves structured API error metadata and HTTP status", async () => {
  await assert.rejects(parseApiResponse(new Response(JSON.stringify(envelope(null, {
    code: "forbidden", message: "Access denied.",
  })), { status: 403 })), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
    assert.equal(error.code, "forbidden");
    assert.equal(error.message, "Access denied.");
    assert.equal(error.requestId, "req-123");
    return true;
  });
});

test("preserves validated priority rejection details in ApiError", async () => {
  const details = {
    score: 1.6,
    minimumScore: 2.2,
    priorityBand: "Priority",
    breakdown: [
      { key: "turnaround", question: "Time", hint: "Estimate", score: 3, weight: 0.2, contribution: 0.6 },
      { key: "volume", question: "Volume", hint: "Cases", score: 2, weight: 0.2, contribution: 0.4 },
      { key: "value", question: "Value", hint: "Money", score: 1, weight: 0.6, contribution: 0.6 },
    ],
  } as const;
  await assert.rejects(parseApiResponse(new Response(JSON.stringify(envelope(null, {
    code: "submission_rejected", message: "Priority is too low.", details,
  })), { status: 422 })), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, "submission_rejected");
    assert.deepEqual(error.details, details);
    return true;
  });
});

test("rejects an error envelope even when HTTP status is successful", async () => {
  await assert.rejects(parseApiResponse(new Response(JSON.stringify(envelope(null, {
    code: "conflict", message: "Already submitted.",
  })))), (error: unknown) => error instanceof ApiError && error.code === "conflict");
});

test("rejects malformed responses without exposing raw upstream content", async () => {
  for (const body of ["<html>private proxy details</html>", "{}", JSON.stringify({ data: 1, error: null }),
    JSON.stringify(envelope(null, { code: 1, message: "bad" })),
    JSON.stringify(envelope(null, { code: "submission_rejected", message: "bad", details: { score: "1.6" } })),
    JSON.stringify(envelope({ id: 1 }, { code: "error", message: "bad" }))]) {
    await assert.rejects(parseApiResponse(new Response(body, {
      status: 502, headers: { "x-request-id": "proxy-123" },
    })), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 502);
      assert.equal(error.code, "invalid_response");
      assert.equal(error.requestId, "proxy-123");
      assert.doesNotMatch(error.message, /private proxy details/);
      return true;
    });
  }
});

test("rejects a success envelope returned with failing HTTP status", async () => {
  await assert.rejects(parseApiResponse(new Response(JSON.stringify(envelope({ id: 1 })), { status: 500 })),
    (error: unknown) => error instanceof ApiError && error.status === 500 && error.code === "http_error");
});

test("sends same-origin credentials, no-store, caller headers and cancellation", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let received: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    received = init;
    return new Response(JSON.stringify(envelope({ saved: true })));
  };
  try {
    assert.deepEqual(await apiFetch("/api/example", {
      method: "POST", body: JSON.stringify({ title: "Draft" }),
      headers: new Headers({ "x-custom": "value", "content-type": "application/json" }),
      signal: controller.signal,
    }), { saved: true });
    assert.equal(received?.credentials, "same-origin");
    assert.equal(received?.cache, "no-store");
    assert.equal(received?.signal, controller.signal);
    assert.equal(new Headers(received?.headers).get("x-custom"), "value");
    assert.equal(new Headers(received?.headers).get("accept"), "application/json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preserves AbortError for query cancellation", async () => {
  const originalFetch = globalThis.fetch;
  const aborted = new DOMException("Cancelled", "AbortError");
  globalThis.fetch = async () => { throw aborted; };
  try {
    await assert.rejects(apiFetch("/api/example"), (error: unknown) => error === aborted);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API calls wait for an active session rotation before sending the cookie", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let finishRefresh: (() => void) | undefined;
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (input === "/api/auth/refresh") return new Promise<Response>((resolve) => {
      finishRefresh = () => resolve(new Response(null, { status: 200 }));
    });
    return new Response(JSON.stringify(envelope({ items: [] })));
  };
  try {
    const rotating = refreshSession();
    const request = apiFetch("/api/quizzes");
    await Promise.resolve();
    assert.deepEqual(calls, ["/api/auth/refresh"]);
    finishRefresh?.();
    assert.equal(await rotating, true);
    assert.deepEqual(await request, { items: [] });
    assert.deepEqual(calls, ["/api/auth/refresh", "/api/quizzes"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an authorization race refreshes once and retries the original request", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ path: String(input), init });
    if (calls.length === 1) return new Response(JSON.stringify(envelope(null, { code: "unauthorized", message: "Authentication required." })), { status: 401 });
    if (input === "/api/auth/refresh") return new Response(null, { status: 200 });
    return new Response(JSON.stringify(envelope({ saved: true })));
  };
  try {
    assert.deepEqual(await apiFetch("/api/quizzes/1/attempts", { method: "POST", headers: { "idempotency-key": "same-key" }, body: "{}" }), { saved: true });
    assert.deepEqual(calls.map((call) => call.path), ["/api/quizzes/1/attempts", "/api/auth/refresh", "/api/quizzes/1/attempts"]);
    assert.equal(calls[2].init?.body, "{}");
    assert.equal(new Headers(calls[2].init?.headers).get("idempotency-key"), "same-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed refresh preserves the original unauthorized response", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return input === "/api/auth/refresh"
      ? new Response(null, { status: 401 })
      : new Response(JSON.stringify(envelope(null, { code: "unauthorized", message: "Authentication required." })), { status: 401 });
  };
  try {
    await assert.rejects(apiFetch("/api/quizzes"), (error: unknown) => error instanceof ApiError && error.status === 401);
    assert.deepEqual(calls, ["/api/quizzes", "/api/auth/refresh"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
