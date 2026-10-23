import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/connection";
import {
  auditEvents,
  notifications,
  pointsLedger,
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

let userId = 0;
let departmentPeerId = 0;
let otherDepartmentId = 0;
let quizId = 0;
let versionId = 0;
let challengeId = 0;
let questionIds: number[] = [];

before(async () => {
  const usersCreated = await db.insert(users).values([
    { name: "Quiz Domain User", email: `quiz-domain-${Date.now()}@example.test`, role: "user", department: "Technology", passwordHash: "test-hash" },
    { name: "Quiz Department Peer", email: `quiz-peer-${Date.now()}@example.test`, role: "user", department: "Technology", passwordHash: "test-hash" },
    { name: "Quiz Other Department", email: `quiz-other-${Date.now()}@example.test`, role: "user", department: "Banking", passwordHash: "test-hash" },
  ]).returning({ id: users.id }).all();
  userId = usersCreated[0].id;
  departmentPeerId = usersCreated[1].id;
  otherDepartmentId = usersCreated[2].id;

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
  if (challengeId) await db.delete(quizChallenges).where(eq(quizChallenges.id, challengeId));
  if (quizId) await db.delete(quizAttempts).where(eq(quizAttempts.quizId, quizId));
  if (versionId) await db.delete(quizVersions).where(eq(quizVersions.id, versionId));
  if (quizId) await db.delete(quizzes).where(eq(quizzes.id, quizId));
  if (userId) await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(inArray(users.id, [userId, departmentPeerId, otherDepartmentId]));
});

test("quiz details redact answer keys while preserving selectable options", async () => {
  const detail = await getQuizDetails(quizId);
  assert.equal(detail?.versions[0]?.questions.length, 2);
  assert.ok(detail?.versions[0]?.questions[0]?.options.every((option) => !Object.hasOwn(option, "isCorrect")));
  assert.ok(!JSON.stringify(detail).includes('"isCorrect"'));
});

test("timed attempts grade on server time and replay the immutable result", async () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const attempt = await startQuizAttempt(departmentPeerId, quizId, `attempt-idem-1-${Date.now()}`, startedAt);
  const expired = await submitQuizAttempt(departmentPeerId, attempt.attempt.id, [
    { questionId: questionIds[0], optionKey: "a" },
  ], new Date(startedAt.getTime() + 61_000));
  assert.equal(expired.result.status, "expired");
  assert.equal(expired.result.passed, false);
  const replay = await submitQuizAttempt(departmentPeerId, attempt.attempt.id, [], new Date(startedAt.getTime() + 62_000));
  assert.deepEqual(replay.result, expired.result);
  assert.equal((await db.select().from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, attempt.attempt.id)).all()).length, 0);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.attempt.expired"), eq(auditEvents.targetId, String(attempt.attempt.id)))).all()).length, 1);
});

test("first attempt awards points once and retakes compare against the previous result", async () => {
  const first = await startQuizAttempt(userId, quizId, `attempt-idem-2-${Date.now()}`, new Date("2026-02-01T00:00:00.000Z"));
  const firstResult = await submitQuizAttempt(userId, first.attempt.id, [
    { questionId: questionIds[0], optionKey: "a" },
    { questionId: questionIds[1], optionKey: "b" },
  ], new Date("2026-02-01T00:00:10.000Z"));
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
  assert.equal((await db.select().from(pointsLedger).where(and(eq(pointsLedger.userId, userId), eq(pointsLedger.eventType, "quiz_correct"))).all()).length, 1);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.attempt.started"), eq(auditEvents.actorUserId, userId))).all()).length >= 2, true);
  assert.equal((await db.select().from(auditEvents).where(and(eq(auditEvents.action, "quiz.attempt.submitted"), eq(auditEvents.targetId, String(first.attempt.id)))).all()).length, 1);
});

test("low topic scores create an open recommendation and notification", async () => {
  const journey = await getJourney(userId);
  assert.ok(journey.topics.some((topic) => topic.topic === "authentication" && topic.scorePercent < 70));
  assert.ok(journey.recommendations.some((recommendation) => recommendation.status === "open"));
  assert.ok((await db.select().from(notifications).where(eq(notifications.userId, userId)).all()).some((notification) => notification.type === "learning_recommendation"));
});

test("rankings support whole-bank and department views", async () => {
  await db.insert(pointsLedger).values({ userId: departmentPeerId, amount: 40, eventType: "manual_test", sourceType: "test", idempotencyKey: `ranking-peer-${Date.now()}` });
  await db.insert(pointsLedger).values({ userId: otherDepartmentId, amount: 90, eventType: "manual_test", sourceType: "test", idempotencyKey: `ranking-other-${Date.now()}` });
  const bank = await getRankings(userId, "bank");
  const department = await getRankings(userId, "department");
  assert.ok(bank.some((entry) => entry.userId === otherDepartmentId));
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
