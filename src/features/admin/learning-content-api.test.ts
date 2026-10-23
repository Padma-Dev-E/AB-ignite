import assert from "node:assert/strict";
import test from "node:test";
import { createLearningArticle, listLearningArticles, listLearningQuizzes, listQuizQuestions, saveQuizQuestion, updateLearningArticle, type ArticleInput } from "./learning-content-api";

test("admin learning requests target secured routes and retain audited reasons", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ data: { items: [] }, error: null, requestId: "test" }), { status: 200 });
  }) as typeof fetch;
  const article: ArticleInput = { title: "Privacy", summary: "Summary", body: "Body", category: "Banking", categoryCode: "banking", topic: null, publisher: "AB", difficulty: "Beginner", readingMinutes: 5, publishedLabel: null, url: null, published: false, contentType: "internal", reason: "Content review" };
  try {
    await listLearningQuizzes(); await listQuizQuestions(7);
    await saveQuizQuestion(9, { prompt: "Question", topic: "Banking", sortOrder: 0, points: 5, options: [{ optionKey: "a", label: "Yes", sortOrder: 0, isCorrect: true }, { optionKey: "b", label: "No", sortOrder: 1, isCorrect: false }], reason: "Fix answer" });
    await listLearningArticles(); await createLearningArticle(article); await updateLearningArticle(3, article);
    assert.deepEqual(requests.map((request) => request.url), ["/api/admin/learning/quizzes?limit=100", "/api/admin/learning/quiz-versions/7/questions", "/api/admin/learning/quiz-versions/9/questions", "/api/admin/learning/articles?limit=100", "/api/admin/learning/articles", "/api/admin/learning/articles/3"]);
    assert.equal(requests[2].init?.method, "PATCH");
    assert.equal(JSON.parse(String(requests[2].init?.body)).reason, "Fix answer");
    assert.equal(requests[4].init?.method, "POST");
    assert.equal(JSON.parse(String(requests[4].init?.body)).reason, "Content review");
    assert.equal(requests[5].init?.method, "PATCH");
  } finally { globalThis.fetch = originalFetch; }
});
