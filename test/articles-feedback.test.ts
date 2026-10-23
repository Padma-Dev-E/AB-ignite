import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/connection";
import { articles, auditEvents, feedbackCampaigns, feedbackResponses, notifications, pointsLedger, quizAttempts, quizRecommendations, quizVersions, quizzes, refreshTokens, users } from "../src/db/schema";
import { articleInsight, completeArticle, getFeedback, listLibrary, respondToFeedback, submitFeedback } from "../src/lib/articles/service";
import { ensureArticleCatalogue } from "../src/lib/articles/seed";

let userId = 0;
let adminId = 0;
let articleId = 0;
let campaignId = 0;
let quizId = 0;
let versionId = 0;
let attemptId = 0;
let recommendationId = 0;
let secondArticleId = 0;
let userSessionId = 0;
let adminSessionId = 0;
const articleTitle = `Library test ${Date.now()}`;

before(async () => {
  const created = await db.insert(users).values([
    { name: "Library Test Employee", email: `library-${Date.now()}@example.test`, role: "user", department: "Technology", passwordHash: "test-hash" },
    { name: "Library Test Admin", email: `library-admin-${Date.now()}@example.test`, role: "admin", department: "Technology", passwordHash: "test-hash" },
  ]).returning({ id: users.id }).all();
  userId = created[0].id; adminId = created[1].id;
  const sessions = await db.insert(refreshTokens).values([
    { userId, tokenHash: `library-session-${Date.now()}`, expiresAt: new Date(Date.now() + 3600000), sessionVersion: 0 },
    { userId: adminId, tokenHash: `library-admin-session-${Date.now()}`, expiresAt: new Date(Date.now() + 3600000), sessionVersion: 0 },
  ]).returning({ id: refreshTokens.id }).all();
  userSessionId = sessions[0].id; adminSessionId = sessions[1].id;
  const [article] = await db.insert(articles).values({ title: articleTitle, summary: "Article test summary", body: "Internal article content", category: "learning", categoryCode: "learning", topic: "testing", publisher: "AB Ignite", difficulty: "beginner", readingMinutes: 2, contentType: "internal", published: true }).returning().all();
  articleId = article.id;
  const [secondArticle] = await db.insert(articles).values({ title: `${articleTitle} second`, summary: "Second article", body: "Second content", category: "learning", categoryCode: "other", topic: "other-topic", publisher: "AB Ignite", difficulty: "beginner", readingMinutes: 2, contentType: "internal", published: true }).returning().all();
  secondArticleId = secondArticle.id;
  const [campaign] = await db.insert(feedbackCampaigns).values({ title: "Library feedback test", description: "Tell us what to improve", active: true, pinned: true }).returning().all();
  campaignId = campaign.id;
  const [quiz] = await db.insert(quizzes).values({ title: `Library quiz ${Date.now()}`, category: "testing", difficulty: "beginner", objective: "Test recommendation ownership", passMark: 70, pointsPerQuestion: 1, questionCount: 1 }).returning().all();
  quizId = quiz.id;
  const [version] = await db.insert(quizVersions).values({ quizId, version: 1, categoryCode: "learning", level: "beginner", objective: quiz.objective, passMark: 70, pointsPerQuestion: 1, published: true }).returning().all();
  versionId = version.id;
  const [attempt] = await db.insert(quizAttempts).values({ userId, quizId, quizVersionId: versionId, status: "submitted", startedAt: new Date(), submittedAt: new Date(), totalQuestions: 1, idempotencyKey: `library-attempt-${Date.now()}` }).returning().all();
  attemptId = attempt.id;
  const [recommendation] = await db.insert(quizRecommendations).values({ userId, topic: "testing", categoryCode: "learning", scorePercent: 40, thresholdPercent: 70, reason: "Strengthen testing knowledge.", sourceAttemptId: attemptId }).returning().all();
  recommendationId = recommendation.id;
  ensureArticleCatalogue();
});

after(async () => {
  // Test records are intentionally retained: reward and audit tables are append-only,
  // so cascading cleanup would violate the production immutability triggers.
});

test("published library filters categories and keeps external targets restricted to HTTPS", async () => {
  const result = await listLibrary(userId, "learning");
  assert.ok(result.items.some((item) => item.id === articleId && item.publisher === "AB Ignite"));
  const row = result.items.find((item) => item.id === articleId);
  assert.equal(row?.body, "Internal article content");
  const empty = await listLibrary(userId, "missing-category");
  assert.equal(empty.items.length, 0);
});

test("article completion grants configured points once and rejects idempotency-key reuse", async () => {
  const ctx = { userId, sessionId: userSessionId, requestId: "article-test" };
  const first = await completeArticle(ctx, articleId, "article-read-key-0001");
  const second = await completeArticle(ctx, articleId, "article-read-key-0001");
  assert.equal(first.pointsAwarded, 10);
  assert.equal(second.alreadyCompleted, true);
  const ledgerRows = await db.select().from(pointsLedger).where(and(eq(pointsLedger.userId, userId), eq(pointsLedger.eventType, "article_read"))).all();
  assert.equal(ledgerRows.length, 1);
  await assert.rejects(() => completeArticle(ctx, secondArticleId, "article-read-key-0001"), (error: unknown) => (error as { code?: string }).code === "IDEMPOTENCY_CONFLICT");
  await assert.rejects(() => articleInsight({ userId: adminId, sessionId: adminSessionId }, articleId, recommendationId), (error: unknown) => (error as { code?: string }).code === "RECOMMENDATION_NOT_FOUND");
  assert.equal((await articleInsight({ userId, sessionId: userSessionId }, articleId, recommendationId)).source, "rule");
});

test("feedback campaign accepts categorized feedback once and administrator response notifies employee", async () => {
  const ctx = { userId, sessionId: userSessionId, requestId: "feedback-test" };
  const campaign = await getFeedback(userId);
  assert.equal(campaign.campaign?.id, campaignId);
  const submitted = await submitFeedback(ctx, { category: "experience", message: "The library is helpful.", idempotencyKey: "feedback-key-0001" });
  const duplicate = await submitFeedback(ctx, { category: "experience", message: "The library is helpful.", idempotencyKey: "feedback-key-0001" });
  assert.equal(duplicate.duplicate, true);
  const response = await respondToFeedback({ userId: adminId, sessionId: adminSessionId, requestId: "admin-feedback" }, submitted.id, "Thank you for sharing this.");
  assert.ok(response.respondedAt);
  const [stored] = await db.select().from(feedbackResponses).where(eq(feedbackResponses.id, submitted.id)).all();
  assert.equal(stored.response, "Thank you for sharing this.");
  assert.ok((await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, "feedback_response"))).all()).length > 0);
  assert.ok((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "feedback.responded"), eq(auditEvents.targetId, String(submitted.id)))).all()).length > 0);
});
