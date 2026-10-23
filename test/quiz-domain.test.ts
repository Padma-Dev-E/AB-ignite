import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/connection";
import {
  auditEvents,
  articles,
  notifications,
  pointRules,
  pointsLedger,
  refreshTokens,
  quizAttemptAnswers,
  quizAttempts,
  quizCategories,
  quizChallenges,
  quizChallengeParticipants,
  quizOptions,
  quizQuestions,
  quizRecommendations,
  quizTopicResults,
  quizVersions,
  quizzes,
  users,
} from "../src/db/schema";
import {
  getJourney,
  getQuizAttempt,
  getQuizDetails,
  getRankings,
  joinChallenge,
  listChallenges,
  startQuizAttempt,
  submitQuizAttempt,
} from "../src/lib/quizzes/service";
import { ensureQuizCatalogue } from "../src/lib/quizzes/seed";

let userId = 0;
let departmentPeerId = 0;
let otherDepartmentId = 0;
let retryUserId = 0;
let awardRetryUserId = 0;
let auditSessionId = 0;
let auditPeerSessionId = 0;
let quizId = 0;
let versionId = 0;
let challengeId = 0;
let journeyArticleId = 0;
let questionIds: number[] = [];

before(async () => {
  const usersCreated = await db.insert(users).values([
    { name: "Quiz Domain User", email: `quiz-domain-${Date.now()}@example.test`, role: "employee", department: "Technology", passwordHash: "test-hash" },
    { name: "Quiz Department Peer", email: `quiz-peer-${Date.now()}@example.test`, role: "employee", department: "Technology", passwordHash: "test-hash" },
    { name: "Quiz Other Department", email: `quiz-other-${Date.now()}@example.test`, role: "employee", department: "Banking", passwordHash: "test-hash" },
    { name: "Quiz Retry User", email: `quiz-retry-${Date.now()}@example.test`, role: "employee", department: "Technology", passwordHash: "test-hash" },
    { name: "Quiz Award Retry User", email: `quiz-award-retry-${Date.now()}@example.test`, role: "employee", department: "Technology", passwordHash: "test-hash" },
  ]).returning({ id: users.id }).all();
  userId = usersCreated[0].id;
  departmentPeerId = usersCreated[1].id;
  otherDepartmentId = usersCreated[2].id;
  retryUserId = usersCreated[3].id;
  awardRetryUserId = usersCreated[4].id;
  const [session] = await db.insert(refreshTokens).values({
    userId,
    tokenHash: `quiz-session-${Date.now()}`,
    expiresAt: new Date(Date.now() + 3_600_000),
    idleExpiresAt: new Date(Date.now() + 3_600_000),
    absoluteExpiresAt: new Date(Date.now() + 3_600_000),
    sessionVersion: 0,
  }).returning({ id: refreshTokens.id }).all();
  auditSessionId = session.id;
  const [peerSession] = await db.insert(refreshTokens).values({
    userId: departmentPeerId,
    tokenHash: `quiz-peer-session-${Date.now()}`,
    expiresAt: new Date(Date.now() + 3_600_000),
    idleExpiresAt: new Date(Date.now() + 3_600_000),
    absoluteExpiresAt: new Date(Date.now() + 3_600_000),
    sessionVersion: 0,
  }).returning({ id: refreshTokens.id }).all();
  auditPeerSessionId = peerSession.id;

  const [category] = await db.insert(quizCategories).values({ code: `banking-${Date.now()}`, name: "Banking", sortOrder: 1, active: true }).returning().all();
  const [quiz] = await db.insert(quizzes).values({
    title: "Secure Banking Basics",
    category: category.code,
    difficulty: "beginner",
    objective: "Understand secure banking controls.",
    passMark: 70,
    pointsPerQuestion: 10,
    questionCount: 2,
    timeLimitSeconds: 60,
  }).returning().all();
  quizId = quiz.id;
  const [version] = await db.insert(quizVersions).values({
    quizId,
    version: 1,
    categoryCode: category.code,
    level: "beginner",
    objective: quiz.objective,
    passMark: 70,
    pointsPerQuestion: 10,
    timeLimitSeconds: 60,
    published: true,
  }).returning().all();
  versionId = version.id;
  const questions = await db.insert(quizQuestions).values([
    { quizVersionId: versionId, topic: "authentication", prompt: "Which control protects access?", sortOrder: 1, points: 10 },
    { quizVersionId: versionId, topic: "authentication", prompt: "Which control detects abuse?", sortOrder: 2, points: 10 },
  ]).returning().all();
  questionIds = questions.map((question) => question.id);
  await db.insert(quizOptions).values([
    { questionId: questionIds[0], optionKey: "a", label: "MFA", sortOrder: 1, isCorrect: true },
    { questionId: questionIds[0], optionKey: "b", label: "Shared password", sortOrder: 2, isCorrect: false },
    { questionId: questionIds[1], optionKey: "a", label: "Monitoring", sortOrder: 1, isCorrect: true },
    { questionId: questionIds[1], optionKey: "b", label: "Ignoring alerts", sortOrder: 2, isCorrect: false },
  ]);
  const [challenge] = await db.insert(quizChallenges).values({
    title: "Secure Access Challenge",
    question: "How can we improve secure access?",
    deadlineAt: new Date(Date.now() + 60_000),
    points: 20,
    active: true,
  }).returning().all();
  challengeId = challenge.id;
});

after(async () => {
  if (journeyArticleId) await db.delete(articles).where(eq(articles.id, journeyArticleId));
  if (challengeId) await db.delete(quizChallenges).where(eq(quizChallenges.id, challengeId));
  if (quizId) await db.delete(quizAttempts).where(eq(quizAttempts.quizId, quizId));
  if (versionId) await db.delete(quizVersions).where(eq(quizVersions.id, versionId));
  if (quizId) await db.delete(quizzes).where(eq(quizzes.id, quizId));
  if (auditSessionId) await db.update(refreshTokens).set({ revokedAt: new Date(), revocationReason: "quiz-test-cleanup", updatedAt: new Date() }).where(eq(refreshTokens.id, auditSessionId));
  if (auditPeerSessionId) await db.update(refreshTokens).set({ revokedAt: new Date(), revocationReason: "quiz-test-cleanup", updatedAt: new Date() }).where(eq(refreshTokens.id, auditPeerSessionId));
  if (userId) await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(inArray(users.id, [userId, departmentPeerId, otherDepartmentId, retryUserId, awardRetryUserId]));
});

test("quiz details redact answer keys while preserving selectable options", async () => {
  const detail = await getQuizDetails(quizId);
  assert.equal(detail?.versions[0]?.questions.length, 2);
  assert.ok(detail?.versions[0]?.questions[0]?.options.every((option) => !Object.hasOwn(option, "isCorrect")));
  assert.ok(!JSON.stringify(detail).includes('"isCorrect"'));
});

test("seed ensures a usable published three category by four level catalogue", async () => {
  ensureQuizCatalogue();
  ensureQuizCatalogue();
  const { listQuizCatalogue } = await import("../src/lib/quizzes/service");
  const catalogue = await listQuizCatalogue();
  assert.equal(catalogue.length, 12);
  assert.deepEqual(new Set(catalogue.map((item) => item.category)), new Set(["banking", "transformation", "technology"]));
  for (const category of ["banking", "transformation", "technology"]) {
    const entries = catalogue.filter((item) => item.category === category);
    assert.deepEqual(new Set(entries.map((item) => item.level)), new Set(["beginner", "intermediate", "advanced", "expert"]));
    assert.ok(entries.every((item) => item.questionCount >= 3 && item.timeLimitSeconds !== null));
  }
  assert.equal((await db.select().from(quizCategories).where(inArray(quizCategories.code, ["banking", "transformation", "technology"])).all()).length, 3);
});

test("reading an overdue attempt records server-enforced expiration", async () => {
  const startedAt = new Date("2026-05-01T00:00:00.000Z");
  const attempt = await startQuizAttempt(departmentPeerId, quizId, `read-expiry-${Date.now()}`, startedAt);
  const fetched = await getQuizAttempt(departmentPeerId, attempt.attempt.id);
  assert.equal(fetched.result?.status, "expired");
});

test("timed attempts grade on server time and replay the immutable result", async () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const attempt = await startQuizAttempt(departmentPeerId, quizId, `attempt-idem-1-${Date.now()}`, startedAt, { sessionId: auditPeerSessionId, ipAddress: "10.20.30.40", userAgent: "quiz-test-agent", requestId: "quiz-test-request" });
  const expired = await submitQuizAttempt(departmentPeerId, attempt.attempt.id, [
    { questionId: questionIds[0], optionKey: "a" },
  ], new Date(startedAt.getTime() + 61_000), { sessionId: auditPeerSessionId, ipAddress: "10.20.30.40", userAgent: "quiz-test-agent", requestId: "quiz-test-request" });
  assert.equal(expired.result.status, "expired");
  assert.equal(expired.result.passed, false);
  const replay = await submitQuizAttempt(departmentPeerId, attempt.attempt.id, [], new Date(startedAt.getTime() + 62_000));
  assert.deepEqual(replay.result, expired.result);
  assert.equal((await db.select().from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, attempt.attempt.id)).all()).length, 0);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.attempt.expired"), eq(auditEvents.targetId, String(attempt.attempt.id)))).all()).length, 1);
  const [audit] = await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.attempt.started"), eq(auditEvents.targetId, String(attempt.attempt.id)))).all();
  assert.equal(audit.sessionId, auditPeerSessionId);
  assert.ok(audit.ipHash);
  assert.ok(audit.userAgentHash);
  assert.doesNotMatch(audit.metadataJson ?? "", /10\.20\.30\.40|quiz-test-agent/);
});

test("first attempt awards points once and retakes compare against the previous result", async () => {
  const auditContext = { sessionId: auditSessionId, ipAddress: "10.20.30.41", userAgent: "quiz-award-agent", requestId: "quiz-award-request" };
  const first = await startQuizAttempt(userId, quizId, `attempt-idem-2-${Date.now()}`, new Date("2026-02-01T00:00:00.000Z"), auditContext);
  const firstResult = await submitQuizAttempt(userId, first.attempt.id, [
    { questionId: questionIds[0], optionKey: "a" },
    { questionId: questionIds[1], optionKey: "b" },
  ], new Date("2026-02-01T00:00:10.000Z"), auditContext);
  assert.equal(firstResult.result.scorePercent, 50);
  assert.equal(firstResult.result.pointsAwarded, 10);

  const retake = await startQuizAttempt(userId, quizId, `attempt-idem-3-${Date.now()}`, new Date("2026-02-02T00:00:00.000Z"));
  const retakeResult = await submitQuizAttempt(userId, retake.attempt.id, [
    { questionId: questionIds[0], optionKey: "a" },
    { questionId: questionIds[1], optionKey: "a" },
  ], new Date("2026-02-02T00:00:10.000Z"));
  assert.equal(retakeResult.result.scorePercent, 100);
  assert.equal(retakeResult.result.pointsAwarded, 0);
  assert.equal(retakeResult.result.previousScorePercent, 50);
  assert.equal((await getQuizAttempt(userId, retake.attempt.id)).result?.scorePercent, 100);
  const laterRetake = await startQuizAttempt(userId, quizId, `attempt-idem-4-${Date.now()}`, new Date("2026-02-03T00:00:00.000Z"));
  await submitQuizAttempt(userId, laterRetake.attempt.id, [{ questionId: questionIds[0], optionKey: "a" }], new Date("2026-02-03T00:00:10.000Z"));
  assert.equal((await getQuizAttempt(userId, retake.attempt.id)).result?.previousScorePercent, 50);
  assert.equal((await db.select().from(pointsLedger).where(and(eq(pointsLedger.userId, userId), eq(pointsLedger.eventType, "quiz_correct"))).all()).length, 1);
  const [ledger] = await db.select().from(pointsLedger).where(and(eq(pointsLedger.userId, userId), eq(pointsLedger.eventType, "quiz_correct"))).all();
  const [pointsAudit] = await db.select().from(auditEvents).where(and(eq(auditEvents.action, "points.ledger.appended"), eq(auditEvents.targetId, String(ledger.id)))).all();
  assert.equal(pointsAudit.sessionId, auditSessionId);
  assert.ok(pointsAudit.ipHash);
  assert.ok(pointsAudit.userAgentHash);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.attempt.started"), eq(auditEvents.actorUserId, userId))).all()).length >= 2, true);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.attempt.submitted"), eq(auditEvents.targetId, String(first.attempt.id)))).all()).length, 1);
});

test("an abandoned attempt does not consume the first completed-attempt reward", async () => {
  const abandoned = await startQuizAttempt(retryUserId, quizId, `abandoned-${Date.now()}`, new Date("2026-03-01T00:00:00.000Z"));
  const completed = await startQuizAttempt(retryUserId, quizId, `completed-${Date.now()}`, new Date("2026-03-01T00:01:00.000Z"));
  const result = await submitQuizAttempt(retryUserId, completed.attempt.id, questionIds.map((questionId) => ({ questionId, optionKey: "a" })), new Date("2026-03-01T00:01:10.000Z"));
  assert.equal(abandoned.attempt.status, "in_progress");
  assert.equal(result.result.firstAttempt, true);
  assert.equal(result.result.pointsAwarded, 20);
});

test("quiz point awards remain pending after policy failure and retry on replay", async () => {
  const [rule] = await db.select().from(pointRules).where(eq(pointRules.code, "quiz_correct")).limit(1).all();
  assert.ok(rule);
  await db.update(pointRules).set({ active: false, updatedAt: new Date() }).where(eq(pointRules.id, rule.id));
  const attempt = await startQuizAttempt(awardRetryUserId, quizId, `award-retry-${Date.now()}`, new Date("2026-04-01T00:00:00.000Z"));
  await assert.rejects(() => submitQuizAttempt(awardRetryUserId, attempt.attempt.id, [{ questionId: questionIds[0], optionKey: "a" }], new Date("2026-04-01T00:00:10.000Z")), /points policy/i);
  const [pending] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attempt.attempt.id)).all();
  assert.equal(pending.status, "submitted");
  assert.equal(pending.pointsStatus, "failed");
  await db.update(pointRules).set({ active: true, updatedAt: new Date() }).where(eq(pointRules.id, rule.id));
  const replay = await submitQuizAttempt(awardRetryUserId, attempt.attempt.id, [], new Date("2026-04-01T00:01:00.000Z"));
  assert.equal(replay.result.pointsAwarded, 10);
  assert.equal((await db.select().from(quizAttempts).where(eq(quizAttempts.id, attempt.attempt.id)).all())[0].pointsStatus, "awarded");
});

test("low topic scores create an open recommendation and notification", async () => {
  const [article] = await db.insert(articles).values({
    title: "Authentication control practices", summary: "Practical authentication controls.", body: "Use multi-factor authentication and monitor access.",
    category: "banking", categoryCode: "banking", topic: "authentication", publisher: "Quiz test", difficulty: "beginner",
    readingMinutes: 4, contentType: "internal", published: true,
  }).returning().all();
  journeyArticleId = article.id;
  const journey = await getJourney(userId);
  assert.ok(journey.topics.some((topic) => topic.topic === "authentication" && topic.scorePercent < 70));
  assert.ok(journey.recommendations.some((recommendation) => recommendation.status === "open"));
  assert.deepEqual(journey.nextRecommendedArticle, { id: article.id, title: article.title });
  assert.ok(journey.recommendedArticles.some((recommended) => recommended.id === article.id && recommended.recommendation.topic === "authentication"));
  assert.ok(journey.recommendedArticles.every((recommended) => !Object.hasOwn(recommended, "body")));
  assert.ok(journey.topics.find((topic) => topic.topic === "authentication")?.totalQuestions);
  assert.ok(journey.recentQuizzes.some((recent) => recent.quizId === quizId));
  assert.equal(typeof journey.streakDays, "number");
  assert.ok(Array.isArray(journey.improvement));
  assert.ok((await db.select().from(notifications).where(eq(notifications.userId, userId)).all()).some((notification) => notification.type === "learning_recommendation"));
  assert.equal((await db.select().from(quizRecommendations).where(and(eq(quizRecommendations.userId, userId), eq(quizRecommendations.topic, "authentication"), eq(quizRecommendations.status, "open"))).all()).length, 1);
});

test("rankings support whole-bank and department views", async () => {
  await db.insert(pointsLedger).values({ userId: departmentPeerId, amount: 40, eventType: "manual_test", sourceType: "test", idempotencyKey: `ranking-peer-${Date.now()}` });
  await db.insert(pointsLedger).values({ userId: otherDepartmentId, amount: 90, eventType: "manual_test", sourceType: "test", idempotencyKey: `ranking-other-${Date.now()}` });
  const bank = await getRankings(userId, "bank");
  const department = await getRankings(userId, "department");
  assert.ok(bank.some((entry) => entry.name === "Quiz Other Department"));
  assert.ok(bank.every((entry) => !Object.hasOwn(entry, "userId")));
  assert.ok(department.every((entry) => entry.department === "Technology"));
});

test("challenge listing and joining award twenty points exactly once", async () => {
  const challenges = await listChallenges(userId);
  assert.ok(challenges.some((challenge) => challenge.id === challengeId && challenge.participants === 0));
  const idempotencyKey = `challenge-idem-1-${Date.now()}`;
  const first = await joinChallenge(userId, challengeId, idempotencyKey);
  const replay = await joinChallenge(userId, challengeId, idempotencyKey);
  assert.equal(first.participant.id, replay.participant.id);
  assert.equal(first.pointsAwarded, 20);
  assert.equal(replay.pointsAwarded, 0);
  assert.equal((await db.select().from(quizChallengeParticipants).where(and(eq(quizChallengeParticipants.userId, userId), eq(quizChallengeParticipants.challengeId, challengeId))).all()).length, 1);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.challenge.joined"), eq(auditEvents.targetId, String(challengeId)))).all()).length, 1);
});

test("challenge rewards retry after a failed award and reject mismatched displayed points", async () => {
  const [rule] = await db.select().from(pointRules).where(eq(pointRules.code, "challenge_join")).limit(1).all();
  assert.ok(rule);
  await db.update(quizChallenges).set({ points: rule.points + 1, updatedAt: new Date() }).where(eq(quizChallenges.id, challengeId));
  await assert.rejects(() => joinChallenge(retryUserId, challengeId, `challenge-mismatch-${Date.now()}`), /points policy|points/i);
  await db.update(quizChallenges).set({ points: rule.points, updatedAt: new Date() }).where(eq(quizChallenges.id, challengeId));
  await db.update(pointRules).set({ active: false, updatedAt: new Date() }).where(eq(pointRules.id, rule.id));
  const idempotencyKey = `challenge-retry-${Date.now()}`;
  await assert.rejects(() => joinChallenge(retryUserId, challengeId, idempotencyKey), /points policy/i);
  await db.update(pointRules).set({ active: true, updatedAt: new Date() }).where(eq(pointRules.id, rule.id));
  const replay = await joinChallenge(retryUserId, challengeId, idempotencyKey);
  assert.equal(replay.pointsAwarded, rule.points);
});
