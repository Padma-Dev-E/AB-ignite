import assert from "node:assert/strict";
import test from "node:test";
import { completeArticle, getArticleInsight, listArticles, listJourney, listQuizzes, redeemableRecommendations, startQuizAttempt, submitQuizAttempt } from "./api";

const envelope = (data: unknown) => new Response(JSON.stringify({ data, error: null, requestId: "client-test" }), { status: 200, headers: { "content-type": "application/json" } });

test("learning catalogue, journey and recommendation requests use the shared API", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return envelope({ items: [] });
  }) as typeof fetch;
  try {
    await listQuizzes();
    await listJourney();
    await redeemableRecommendations();
    await listArticles({ category: "risk" });
    assert.deepEqual(requests.map(({ input }) => String(input)), [
      "/api/quizzes", "/api/quizzes/journey", "/api/articles?view=recommended", "/api/articles?category=risk",
    ]);
    assert.ok(requests.every((request) => new Headers(request.init?.headers).get("accept") === "application/json"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quiz start and article completion reuse caller idempotency keys", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return envelope({});
  }) as typeof fetch;
  try {
    await startQuizAttempt(12, "quiz-start-key-12");
    await completeArticle(8, "article-read-key-8");
    assert.equal(new Headers(requests[0].init?.headers).get("idempotency-key"), "quiz-start-key-12");
    assert.equal(JSON.parse(String(requests[0].init?.body)).idempotencyKey, "quiz-start-key-12");
    assert.equal(new Headers(requests[1].init?.headers).get("idempotency-key"), "article-read-key-8");
    assert.equal(JSON.parse(String(requests[1].init?.body)).idempotencyKey, "article-read-key-8");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quiz submission sends only selected option keys", async () => {
  const originalFetch = globalThis.fetch;
  let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { input, init };
    return envelope({});
  }) as typeof fetch;
  try {
    await submitQuizAttempt(5, [{ questionId: 2, optionKey: "b" }]);
    assert.equal(request?.input, "/api/quizzes/attempts/5/submit");
    assert.deepEqual(JSON.parse(String(request?.init?.body)), { answers: [{ questionId: 2, optionKey: "b" }] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("article insight uses the secured recommendation insight endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { input, init };
    return envelope({ insight: "Build confidence in privacy controls.", source: "rule" });
  }) as typeof fetch;
  try {
    const result = await getArticleInsight(8, 21);
    assert.equal(request?.input, "/api/articles/8/insight");
    assert.equal(request?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(request?.init?.body)), { recommendationId: 21 });
    assert.equal(result.source, "rule");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
