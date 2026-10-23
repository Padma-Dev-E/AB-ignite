import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../db/connection";
import {
  auditEvents,
  notifications,
  pointRules,
  pointsLedger,
  quizAttemptAnswers,
  quizAttempts,
  quizChallenges,
  quizChallengeParticipants,
  quizOptions,
  quizQuestions,
  quizRecommendationRules,
  quizRecommendations,
  quizTopicResults,
  quizVersions,
  quizzes,
  users,
} from "../../db/schema";
import { serializeAuditMetadata } from "../audit/redaction-core";
import { awardPoints } from "../rewards/service";
import { QuizError } from "./errors";

type QuizClock = Date;
type AnswerInput = { questionId: number; optionKey: string };

function buildQuizAuditRecord(input: { actorUserId: number; action: string; targetType: string; targetId: number; metadata: unknown }, now: Date) {
  return {
    actorUserId: input.actorUserId,
    sessionId: null,
    action: input.action,
    targetType: input.targetType,
    targetId: String(input.targetId),
    reason: null,
    metadataJson: serializeAuditMetadata(input.metadata),
    ipHash: null,
    userAgentHash: null,
    createdAt: now,
  };
}

function validId(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) throw new QuizError(`Invalid ${label}.`, "VALIDATION_ERROR");
  return value;
}

function validIdempotency(value: string) {
  const key = value.trim();
  if (key.length < 8 || key.length > 200) throw new QuizError("A valid idempotency key is required.", "VALIDATION_ERROR");
  return key;
}

function percentage(correct: number, total: number) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function publicQuestions(versionId: number) {
  const questions = db.select().from(quizQuestions).where(eq(quizQuestions.quizVersionId, versionId)).orderBy(asc(quizQuestions.sortOrder), asc(quizQuestions.id)).all();
  return questions.map((question) => ({
    id: question.id,
    topic: question.topic,
    prompt: question.prompt,
    sortOrder: question.sortOrder,
    points: question.points,
    options: db.select({ id: quizOptions.id, optionKey: quizOptions.optionKey, label: quizOptions.label, sortOrder: quizOptions.sortOrder })
      .from(quizOptions)
      .where(eq(quizOptions.questionId, question.id))
      .orderBy(asc(quizOptions.sortOrder), asc(quizOptions.id))
      .all(),
  }));
}

function publicAttempt(attempt: typeof quizAttempts.$inferSelect) {
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizVersionId: attempt.quizVersionId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    totalQuestions: attempt.totalQuestions,
    questions: publicQuestions(attempt.quizVersionId),
  };
}

function resultFromAttempt(attempt: typeof quizAttempts.$inferSelect, previousScorePercent: number | null = null) {
  return {
    attemptId: attempt.id,
    status: attempt.status,
    scorePercent: attempt.scorePercent ?? 0,
    passed: attempt.passed ?? false,
    passMark: getPassMark(attempt.quizVersionId),
    correctCount: attempt.correctCount ?? 0,
    totalQuestions: attempt.totalQuestions,
    pointsAwarded: attempt.pointsAwarded,
    firstAttempt: attempt.firstAttempt,
    previousScorePercent,
    submittedAt: attempt.submittedAt,
  };
}

function getPassMark(versionId: number) {
  const [version] = db.select({ passMark: quizVersions.passMark }).from(quizVersions).where(eq(quizVersions.id, versionId)).limit(1).all();
  return version?.passMark ?? 0;
}

function previousScore(userId: number, quizId: number, attemptId?: number) {
  const rows = db.select({ id: quizAttempts.id, score: quizAttempts.scorePercent })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId), inArray(quizAttempts.status, ["submitted", "expired"])))
    .orderBy(desc(quizAttempts.submittedAt), desc(quizAttempts.id))
    .all();
  return rows.find((row) => row.score !== null && (attemptId === undefined || row.id !== attemptId))?.score ?? null;
}

export async function getQuizDetails(quizId: number) {
  validId(quizId, "quiz ID");
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1).all();
  if (!quiz) return null;
  const versions = await db.select().from(quizVersions).where(and(eq(quizVersions.quizId, quizId), eq(quizVersions.published, true))).orderBy(desc(quizVersions.version)).all();
  return {
    id: quiz.id,
    title: quiz.title,
    category: quiz.category,
    difficulty: quiz.difficulty,
    objective: quiz.objective,
    versions: versions.map((version) => ({ ...version, questions: publicQuestions(version.id) })),
  };
}

export async function listQuizCatalogue() {
  const rows = await db.select({ quiz: quizzes, version: quizVersions })
    .from(quizzes)
    .innerJoin(quizVersions, eq(quizVersions.quizId, quizzes.id))
    .where(eq(quizVersions.published, true))
    .orderBy(asc(quizVersions.categoryCode), asc(quizVersions.level), asc(quizzes.id), desc(quizVersions.version))
    .all();
  const latest = new Map<number, typeof rows[number]>();
  for (const row of rows) if (!latest.has(row.quiz.id)) latest.set(row.quiz.id, row);
  return Array.from(latest.values()).map(({ quiz, version }) => ({
    id: quiz.id,
    title: quiz.title,
    category: version.categoryCode,
    level: version.level,
    objective: version.objective,
    passMark: version.passMark,
    timeLimitSeconds: version.timeLimitSeconds,
    version: version.version,
    questionCount: quizQuestionsCount(version.id),
  }));
}

function quizQuestionsCount(versionId: number) {
  const [row] = db.select({ count: sql<number>`count(*)` }).from(quizQuestions).where(eq(quizQuestions.quizVersionId, versionId)).all();
  return Number(row?.count ?? 0);
}

export async function startQuizAttempt(userId: number, quizId: number, idempotencyKey: string, now: QuizClock = new Date()) {
  validId(userId, "user ID");
  validId(quizId, "quiz ID");
  const key = validIdempotency(idempotencyKey);
  const result = db.transaction((tx) => {
    const [existing] = tx.select().from(quizAttempts).where(eq(quizAttempts.idempotencyKey, key)).limit(1).all();
    if (existing) {
      if (existing.userId !== userId || existing.quizId !== quizId) throw new QuizError("The idempotency key is already used for another attempt.", "IDEMPOTENCY_CONFLICT", 409);
      return existing;
    }
    const [version] = tx.select().from(quizVersions).where(and(eq(quizVersions.quizId, quizId), eq(quizVersions.published, true))).orderBy(desc(quizVersions.version)).limit(1).all();
    if (!version) throw new QuizError("Quiz not found.", "QUIZ_NOT_FOUND", 404);
    const [quiz] = tx.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1).all();
    if (!quiz) throw new QuizError("Quiz not found.", "QUIZ_NOT_FOUND", 404);
    const [countRow] = tx.select({ count: sql<number>`count(*)` }).from(quizAttempts).where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))).all();
    const questionCount = Number(tx.select({ count: sql<number>`count(*)` }).from(quizQuestions).where(eq(quizQuestions.quizVersionId, version.id)).all()[0]?.count ?? 0);
    const expiresAt = version.timeLimitSeconds ? new Date(now.getTime() + version.timeLimitSeconds * 1000) : null;
    const [attempt] = tx.insert(quizAttempts).values({
      userId,
      quizId,
      quizVersionId: version.id,
      status: "in_progress",
      startedAt: now,
      expiresAt,
      totalQuestions: questionCount,
      firstAttempt: Number(countRow?.count ?? 0) === 0,
      idempotencyKey: key,
      createdAt: now,
      updatedAt: now,
    }).returning().all();
    if (!attempt) throw new QuizError("Quiz attempt could not be started.", "ATTEMPT_WRITE_FAILED", 500);
    tx.insert(auditEvents).values(buildQuizAuditRecord({
      actorUserId: userId,
      action: "quiz.attempt.started",
      targetType: "quiz_attempt",
      targetId: attempt.id,
      metadata: { status: "in_progress", resourceType: "quiz_attempt", resourceId: attempt.id },
    }, now)).run();
    return attempt;
  });
  return { attempt: publicAttempt(result) };
}

export async function getQuizAttempt(userId: number, attemptId: number) {
  validId(userId, "user ID");
  validId(attemptId, "attempt ID");
  const [attempt] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId))).limit(1).all();
  if (!attempt) throw new QuizError("Quiz attempt not found.", "ATTEMPT_NOT_FOUND", 404);
  return {
    attempt: publicAttempt(attempt),
    result: attempt.status === "in_progress" ? null : resultFromAttempt(attempt, previousScore(userId, attempt.quizId, attempt.id)),
  };
}

export async function submitQuizAttempt(userId: number, attemptId: number, answers: AnswerInput[], now: QuizClock = new Date()) {
  validId(userId, "user ID");
  validId(attemptId, "attempt ID");
  const graded = db.transaction((tx) => {
    const [attempt] = tx.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId))).limit(1).all();
    if (!attempt) throw new QuizError("Quiz attempt not found.", "ATTEMPT_NOT_FOUND", 404);
    if (attempt.status !== "in_progress") {
      return { attempt, previousScorePercent: previousScore(userId, attempt.quizId, attempt.id), topicResults: tx.select().from(quizTopicResults).where(eq(quizTopicResults.attemptId, attempt.id)).all() };
    }
    if (attempt.expiresAt && attempt.expiresAt.getTime() <= now.getTime()) {
      const [expired] = tx.update(quizAttempts).set({ status: "expired", scorePercent: 0, correctCount: 0, passed: false, submittedAt: now, updatedAt: now }).where(and(eq(quizAttempts.id, attempt.id), eq(quizAttempts.status, "in_progress"))).returning().all();
      if (!expired) throw new QuizError("Attempt changed; retry the request.", "ATTEMPT_CONFLICT", 409);
      tx.insert(auditEvents).values(buildQuizAuditRecord({
        actorUserId: userId,
        action: "quiz.attempt.expired",
        targetType: "quiz_attempt",
        targetId: attempt.id,
        metadata: { status: "expired", resourceType: "quiz_attempt", resourceId: attempt.id },
      }, now)).run();
      return { attempt: expired, previousScorePercent: previousScore(userId, attempt.quizId, attempt.id), topicResults: [] };
    }
    const questions = tx.select().from(quizQuestions).where(eq(quizQuestions.quizVersionId, attempt.quizVersionId)).orderBy(asc(quizQuestions.sortOrder), asc(quizQuestions.id)).all();
    const questionMap = new Map(questions.map((question) => [question.id, question]));
    const answerMap = new Map<number, AnswerInput>();
    for (const answer of answers) {
      if (!questionMap.has(answer.questionId)) throw new QuizError("An answer references a question outside this attempt.", "VALIDATION_ERROR");
      if (answerMap.has(answer.questionId)) throw new QuizError("A question can only be answered once.", "VALIDATION_ERROR");
      const [option] = tx.select({ optionKey: quizOptions.optionKey }).from(quizOptions).where(and(eq(quizOptions.questionId, answer.questionId), eq(quizOptions.optionKey, answer.optionKey))).limit(1).all();
      if (!option) throw new QuizError("An answer references an invalid option.", "VALIDATION_ERROR");
      answerMap.set(answer.questionId, answer);
    }
    answerMap.forEach((answer) => tx.insert(quizAttemptAnswers).values({ attemptId: attempt.id, questionId: answer.questionId, optionKey: answer.optionKey, answeredAt: now }).run());
    let correct = 0;
    const topicStats = new Map<string, { correct: number; total: number }>();
    for (const question of questions) {
      const stats = topicStats.get(question.topic) ?? { correct: 0, total: 0 };
      stats.total += 1;
      const answer = answerMap.get(question.id);
      if (answer) {
        const [correctOption] = tx.select({ id: quizOptions.id }).from(quizOptions).where(and(eq(quizOptions.questionId, question.id), eq(quizOptions.optionKey, answer.optionKey), eq(quizOptions.isCorrect, true))).limit(1).all();
        if (correctOption) { correct += 1; stats.correct += 1; }
      }
      topicStats.set(question.topic, stats);
    }
    const scorePercent = percentage(correct, questions.length);
    const [version] = tx.select().from(quizVersions).where(eq(quizVersions.id, attempt.quizVersionId)).limit(1).all();
    if (!version) throw new QuizError("Quiz version not found.", "QUIZ_VERSION_NOT_FOUND", 500);
    const passed = scorePercent >= version.passMark;
    const previousScorePercent = tx.select({ score: quizAttempts.scorePercent })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, attempt.quizId), inArray(quizAttempts.status, ["submitted", "expired"])))
      .orderBy(desc(quizAttempts.submittedAt), desc(quizAttempts.id))
      .all()
      .find((row) => row.score !== null)?.score ?? null;
    const [submitted] = tx.update(quizAttempts).set({ status: "submitted", scorePercent, correctCount: correct, passed, submittedAt: now, updatedAt: now }).where(and(eq(quizAttempts.id, attempt.id), eq(quizAttempts.status, "in_progress"))).returning().all();
    if (!submitted) throw new QuizError("Attempt changed; retry the request.", "ATTEMPT_CONFLICT", 409);
    tx.insert(auditEvents).values(buildQuizAuditRecord({
      actorUserId: userId,
      action: "quiz.attempt.submitted",
      targetType: "quiz_attempt",
      targetId: attempt.id,
      metadata: { status: "submitted", result: scorePercent, resourceType: "quiz_attempt", resourceId: attempt.id },
    }, now)).run();
    const topicResults: Array<typeof quizTopicResults.$inferSelect> = [];
    topicStats.forEach((stats, topic) => {
      const [topicResult] = tx.insert(quizTopicResults).values({ attemptId: attempt.id, userId, categoryCode: version.categoryCode, topic, correctCount: stats.correct, totalQuestions: stats.total, scorePercent: percentage(stats.correct, stats.total), createdAt: now }).returning().all();
      if (topicResult) topicResults.push(topicResult);
      const [rule] = tx.select().from(quizRecommendationRules).where(and(eq(quizRecommendationRules.topic, topic), eq(quizRecommendationRules.active, true))).limit(1).all();
      const threshold = rule?.thresholdPercent ?? 70;
      if (percentage(stats.correct, stats.total) < threshold) {
        const reason = rule?.reasonTemplate.replace("{score}", String(percentage(stats.correct, stats.total))) ?? `Your ${topic} score is ${percentage(stats.correct, stats.total)}%; review this topic before your next attempt.`;
        const [openRecommendation] = tx.select().from(quizRecommendations).where(and(eq(quizRecommendations.userId, userId), eq(quizRecommendations.topic, topic), eq(quizRecommendations.status, "open"))).limit(1).all();
        const recommendation = openRecommendation
          ? tx.update(quizRecommendations).set({ categoryCode: version.categoryCode, scorePercent: percentage(stats.correct, stats.total), thresholdPercent: threshold, reason, sourceAttemptId: attempt.id, updatedAt: now }).where(eq(quizRecommendations.id, openRecommendation.id)).returning().all()[0]
          : tx.insert(quizRecommendations).values({ userId, topic, categoryCode: version.categoryCode, scorePercent: percentage(stats.correct, stats.total), thresholdPercent: threshold, reason, status: "open", sourceAttemptId: attempt.id, createdAt: now, updatedAt: now }).returning().all()[0];
        if (recommendation && !openRecommendation) tx.insert(notifications).values({ userId, type: "learning_recommendation", title: `Recommended learning: ${topic}`, body: reason, link: `/private/knowledge?topic=${encodeURIComponent(topic)}`, createdAt: now, updatedAt: now }).run();
      }
    });
    return { attempt: submitted, previousScorePercent, topicResults };
  });

  let pointsAwarded = graded.attempt.pointsAwarded;
  if (graded.attempt.status === "submitted" && graded.attempt.firstAttempt && pointsAwarded === 0 && (graded.attempt.correctCount ?? 0) > 0) {
    const [rule] = await db.select({ points: pointRules.points }).from(pointRules).where(and(eq(pointRules.code, "quiz_correct"), eq(pointRules.active, true))).limit(1).all();
    if (!rule) throw new QuizError("Quiz points policy is not configured.", "POINT_RULE_NOT_CONFIGURED", 409);
    const answers = await db.select().from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, graded.attempt.id)).orderBy(asc(quizAttemptAnswers.questionId)).all();
    for (const answer of answers) {
      const [correct] = await db.select({ id: quizOptions.id }).from(quizOptions).where(and(eq(quizOptions.questionId, answer.questionId), eq(quizOptions.optionKey, answer.optionKey), eq(quizOptions.isCorrect, true))).limit(1).all();
      if (!correct) continue;
      const award = await awardPoints({ userId, amount: rule.points, eventType: "quiz_correct", sourceType: "quiz_attempt", sourceId: `${graded.attempt.id}:${answer.questionId}`, idempotencyKey: `quiz:${graded.attempt.id}:question:${answer.questionId}:points` });
      pointsAwarded += award.ledger.amount;
    }
    await db.update(quizAttempts).set({ pointsAwarded, updatedAt: new Date() }).where(and(eq(quizAttempts.id, graded.attempt.id), eq(quizAttempts.pointsAwarded, 0))).run();
  }
  const finalAttempt = (await db.select().from(quizAttempts).where(eq(quizAttempts.id, graded.attempt.id)).limit(1).all())[0] ?? graded.attempt;
  return { result: { ...resultFromAttempt(finalAttempt, graded.previousScorePercent), pointsAwarded }, topics: graded.topicResults };
}

export async function getJourney(userId: number) {
  validId(userId, "user ID");
  const rows = await db.select().from(quizTopicResults).where(eq(quizTopicResults.userId, userId)).orderBy(asc(quizTopicResults.topic), desc(quizTopicResults.createdAt), desc(quizTopicResults.id)).all();
  const topics = Array.from(new Map(rows.map((row) => [row.topic, row])).values()).map((row) => ({ topic: row.topic, categoryCode: row.categoryCode, scorePercent: row.scorePercent, trend: rows.filter((item) => item.topic === row.topic).slice(0, 5).map((item) => item.scorePercent) }));
  const categoryStats = new Map<string, { correct: number; total: number }>();
  for (const row of rows) {
    const stats = categoryStats.get(row.categoryCode) ?? { correct: 0, total: 0 };
    stats.correct += row.correctCount;
    stats.total += row.totalQuestions;
    categoryStats.set(row.categoryCode, stats);
  }
  const categories = Array.from(categoryStats.entries()).map(([categoryCode, stats]) => ({ categoryCode, scorePercent: percentage(stats.correct, stats.total), correctCount: stats.correct, totalQuestions: stats.total }));
  const recommendations = await db.select().from(quizRecommendations).where(and(eq(quizRecommendations.userId, userId), eq(quizRecommendations.status, "open"))).orderBy(desc(quizRecommendations.createdAt), desc(quizRecommendations.id)).all();
  return { topics, categories, recommendations, nextRecommendedStep: recommendations[0] ?? null };
}

export async function getRankings(userId: number, scope: "bank" | "department" = "bank") {
  validId(userId, "user ID");
  const [viewer] = await db.select({ department: users.department }).from(users).where(eq(users.id, userId)).limit(1).all();
  const where = scope === "department" && viewer ? and(eq(users.isActive, true), eq(users.department, viewer.department)) : eq(users.isActive, true);
  const rows = await db.select({ userId: users.id, name: users.name, department: users.department, points: sql<number>`coalesce(sum(${pointsLedger.amount}), 0)` })
    .from(users)
    .leftJoin(pointsLedger, eq(pointsLedger.userId, users.id))
    .where(where)
    .groupBy(users.id, users.name, users.department)
    .orderBy(desc(sql`coalesce(sum(${pointsLedger.amount}), 0)`), asc(users.name), asc(users.id))
    .limit(100)
    .all();
  return rows.map((row, index) => ({ ...row, points: Number(row.points), rank: index + 1 }));
}

export async function listChallenges(userId: number, now = new Date()) {
  validId(userId, "user ID");
  const rows = await db.select({ id: quizChallenges.id, title: quizChallenges.title, question: quizChallenges.question, deadlineAt: quizChallenges.deadlineAt, points: quizChallenges.points, participants: sql<number>`count(${quizChallengeParticipants.id})`, joined: sql<number>`max(case when ${quizChallengeParticipants.userId} = ${userId} then 1 else 0 end)` })
    .from(quizChallenges)
    .leftJoin(quizChallengeParticipants, eq(quizChallengeParticipants.challengeId, quizChallenges.id))
    .where(and(eq(quizChallenges.active, true), gt(quizChallenges.deadlineAt, now)))
    .groupBy(quizChallenges.id)
    .orderBy(asc(quizChallenges.deadlineAt), asc(quizChallenges.id))
    .all();
  return rows.map((row) => ({ ...row, participants: Number(row.participants), joined: Boolean(row.joined) }));
}

export async function joinChallenge(userId: number, challengeId: number, idempotencyKey: string, now = new Date()) {
  validId(userId, "user ID");
  validId(challengeId, "challenge ID");
  const key = validIdempotency(idempotencyKey);
  const joined = db.transaction((tx) => {
    const [replayed] = tx.select().from(quizChallengeParticipants).where(eq(quizChallengeParticipants.idempotencyKey, key)).limit(1).all();
    if (replayed) {
      if (replayed.userId !== userId || replayed.challengeId !== challengeId) throw new QuizError("The idempotency key is already used for another challenge.", "IDEMPOTENCY_CONFLICT", 409);
      return { participant: replayed, award: false };
    }
    const [challenge] = tx.select().from(quizChallenges).where(eq(quizChallenges.id, challengeId)).limit(1).all();
    if (!challenge || !challenge.active) throw new QuizError("Challenge not found.", "CHALLENGE_NOT_FOUND", 404);
    if (challenge.deadlineAt.getTime() <= now.getTime()) throw new QuizError("This challenge is closed.", "CHALLENGE_CLOSED", 409);
    const [existing] = tx.select().from(quizChallengeParticipants).where(and(eq(quizChallengeParticipants.challengeId, challengeId), eq(quizChallengeParticipants.userId, userId))).limit(1).all();
    if (existing) return { participant: existing, award: existing.pointsAwarded === 0 };
    const [participant] = tx.insert(quizChallengeParticipants).values({ challengeId, userId, idempotencyKey: key, joinedAt: now, pointsAwarded: 0 }).returning().all();
    if (!participant) throw new QuizError("Challenge join could not be recorded.", "CHALLENGE_WRITE_FAILED", 500);
    tx.insert(auditEvents).values(buildQuizAuditRecord({
      actorUserId: userId,
      action: "quiz.challenge.joined",
      targetType: "quiz_challenge",
      targetId: challengeId,
      metadata: { status: "joined", resourceType: "quiz_challenge", resourceId: challengeId },
    }, now)).run();
    return { participant, award: true };
  });
  let pointsAwarded = 0;
  if (joined.award && joined.participant.pointsAwarded === 0) {
    const [rule] = await db.select({ points: pointRules.points }).from(pointRules).where(and(eq(pointRules.code, "challenge_join"), eq(pointRules.active, true))).limit(1).all();
    if (!rule) throw new QuizError("Challenge points policy is not configured.", "POINT_RULE_NOT_CONFIGURED", 409);
    const award = await awardPoints({ userId, amount: rule.points, eventType: "challenge_join", sourceType: "quiz_challenge", sourceId: String(challengeId), idempotencyKey: `challenge:${challengeId}:user:${userId}:points` });
    pointsAwarded = award.ledger.amount;
    await db.update(quizChallengeParticipants).set({ pointsAwarded, }).where(and(eq(quizChallengeParticipants.id, joined.participant.id), eq(quizChallengeParticipants.pointsAwarded, 0))).run();
  }
  return { participant: { ...joined.participant, pointsAwarded: pointsAwarded || joined.participant.pointsAwarded }, pointsAwarded };
}
