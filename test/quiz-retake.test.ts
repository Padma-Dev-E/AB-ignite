import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/connection";
import { pointRules, pointsLedger, quizOptions, quizQuestions, users } from "../src/db/schema";
import { ensureArticleCatalogue } from "../src/lib/articles/seed";
import { ensureQuizCatalogue } from "../src/lib/quizzes/seed";
import { getJourney, listQuizCatalogue, startQuizAttempt, submitQuizAttempt } from "../src/lib/quizzes/service";

test("catalogue shows Retake only to the user who completed a quiz; retake starts fresh, compares scores, and awards no repeat points", async () => {
  ensureQuizCatalogue();
  ensureArticleCatalogue();
  await db.insert(pointRules).values({ code: "quiz_correct", name: "Correct quiz answer", points: 10, active: true }).onConflictDoNothing({ target: pointRules.code }).run();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [user, otherUser] = await db.insert(users).values([
    { name: "Retake Test Employee", email: `retake-${stamp}@example.test`, role: "employee", department: "Technology", passwordHash: "test-hash" },
    { name: "Other Retake Test Employee", email: `retake-other-${stamp}@example.test`, role: "employee", department: "Technology", passwordHash: "test-hash" },
  ]).returning({ id: users.id }).all();
  const quiz = (await listQuizCatalogue(user.id)).find((item) => item.category === "banking" && item.level === "beginner");
  assert.ok(quiz);
  assert.equal(quiz.hasAttempted, false);
  const first = await startQuizAttempt(user.id, quiz.id, `retake-first-${stamp}`);
  const questions = await db.select({ id: quizQuestions.id }).from(quizQuestions).where(eq(quizQuestions.quizVersionId, first.attempt.quizVersionId)).all();
  const correct = await db.select({ questionId: quizOptions.questionId, optionKey: quizOptions.optionKey }).from(quizOptions)
    .where(and(inArray(quizOptions.questionId, questions.map((question) => question.id)), eq(quizOptions.isCorrect, true))).all();
  assert.ok(correct.length > 1);
  const firstResult = await submitQuizAttempt(user.id, first.attempt.id, [correct[0]]);
  assert.equal(firstResult.result.firstAttempt, true);
  assert.ok(firstResult.result.pointsAwarded > 0);
  assert.equal((await listQuizCatalogue(user.id)).find((item) => item.id === quiz.id)?.hasAttempted, true);
  assert.equal((await listQuizCatalogue(otherUser.id)).find((item) => item.id === quiz.id)?.hasAttempted, false);

  const journey = await getJourney(user.id);
  const related = journey.recommendedArticles.find((article) => article.topic === "banking-fundamentals");
  assert.ok(related);
  assert.equal(related.relatedQuizId, quiz.id);

  const advanced = (await listQuizCatalogue(otherUser.id)).find((item) => item.category === "banking" && item.level === "advanced");
  assert.ok(advanced);
  const advancedAttempt = await startQuizAttempt(otherUser.id, advanced.id, `retake-advanced-${stamp}`);
  const [advancedQuestion] = await db.select({ id: quizQuestions.id }).from(quizQuestions).where(eq(quizQuestions.quizVersionId, advancedAttempt.attempt.quizVersionId)).limit(1).all();
  const [advancedAnswer] = await db.select({ questionId: quizOptions.questionId, optionKey: quizOptions.optionKey }).from(quizOptions).where(and(eq(quizOptions.questionId, advancedQuestion.id), eq(quizOptions.isCorrect, true))).limit(1).all();
  await submitQuizAttempt(otherUser.id, advancedAttempt.attempt.id, [advancedAnswer]);
  const advancedRelated = (await getJourney(otherUser.id)).recommendedArticles.find((article) => article.topic === "banking-fundamentals");
  assert.ok(advancedRelated);
  assert.equal(advancedRelated.relatedQuizId, advanced.id);

  const retake = await startQuizAttempt(user.id, quiz.id, `retake-second-${stamp}`);
  assert.notEqual(retake.attempt.id, first.attempt.id);
  const retakeResult = await submitQuizAttempt(user.id, retake.attempt.id, correct);
  assert.equal(retakeResult.result.previousScorePercent, firstResult.result.scorePercent);
  assert.equal(retakeResult.result.firstAttempt, false);
  assert.equal(retakeResult.result.pointsAwarded, 0);
  const ledger = await db.select().from(pointsLedger).where(and(eq(pointsLedger.userId, user.id), eq(pointsLedger.eventType, "quiz_correct"))).all();
  assert.equal(ledger.length, 1);
});
