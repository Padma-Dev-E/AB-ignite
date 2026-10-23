import { and, asc, desc, eq, like, lte, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../../db/connection";
import {
  aiRuns,
  ideaAiResults,
  ideaEvents,
  ideaReviews,
  ideaComments,
  ideaSupports,
  ideaSubmissions,
  ideaSettings,
  ideaReferenceSequences,
  notifications,
  auditEvents,
  ideaVersions,
  ideas,
  users,
  type AiRun,
  type Idea,
  type IdeaEvent,
  type IdeaReview,
  type IdeaVersion,
  type NewAiRun,
  type NewIdeaVersion,
} from "../../db/schema";
import type { AiActor } from "../ai/types";
import type { IdeaListQuery, IdeaUpdate } from "./schemas";
import { awardPoints } from "../rewards/service";
import { appendAuditEvent } from "../audit/service";

export type CreateIdeaVersionInput = NewIdeaVersion;

export type CreateAiRunInput = NewAiRun;

export type AiRunResultInput = {
  resultJson: string;
  usageJson?: string;
  finishReason?: string;
};

export type AiRunFailureInput = {
  status?: "failed" | "timed_out";
  errorCode: string;
  errorMessage: string;
};

export type CreateIdeaEventInput = typeof ideaEvents.$inferInsert;
export type CreateIdeaReviewInput = typeof ideaReviews.$inferInsert;

export type IdeaActor = { kind: "user" | "admin"; id: string };

export type IdeaPage = {
  items: Idea[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CommentPage = {
  items: Array<typeof ideaComments.$inferSelect & { author: Pick<typeof users.$inferSelect, "id" | "name" | "department"> | null }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuthorizedIdeaSnapshot = {
  idea: Idea;
  versions: IdeaVersion[];
  runs: AiRun[];
  events: IdeaEvent[];
  reviews: IdeaReview[];
};

export async function createIdeaVersion(input: CreateIdeaVersionInput): Promise<IdeaVersion> {
  const [version] = await db.insert(ideaVersions).values(input).returning().all();
  if (!version) throw new Error("Idea version was not created");
  return version;
}

export async function createAiRun(input: CreateAiRunInput): Promise<AiRun> {
  const [existing] = await db.select().from(aiRuns).where(eq(aiRuns.idempotencyKey, input.idempotencyKey)).limit(1).all();
  if (existing) return existing;

  try {
    const [created] = await db.insert(aiRuns).values(input).returning().all();
    if (!created) throw new Error("AI run was not created");
    return created;
  } catch (error) {
    const [raced] = await db.select().from(aiRuns).where(eq(aiRuns.idempotencyKey, input.idempotencyKey)).limit(1).all();
    if (raced) return raced;
    throw error;
  }
}

export async function claimNextAiRun(workerId: string, now = new Date()): Promise<AiRun | null> {
  const result = await db.transaction((tx) => {
    const [candidate] = tx.select().from(aiRuns).where(and(
      eq(aiRuns.status, "queued"),
      lte(aiRuns.availableAt, now),
    )).orderBy(asc(aiRuns.createdAt)).limit(1).all();
    if (!candidate) return null;

    const updated = tx.update(aiRuns).set({
      status: "running",
      workerId,
      attemptCount: candidate.attemptCount + 1,
      startedAt: now,
      updatedAt: now,
    }).where(and(eq(aiRuns.id, candidate.id), eq(aiRuns.status, "queued"))).returning().all();
    return updated[0] ?? null;
  });
  return result;
}

export async function claimAiRun(runId: number, workerId: string, now = new Date()): Promise<AiRun | null> {
  const [current] = await db.select().from(aiRuns).where(and(eq(aiRuns.id, runId), eq(aiRuns.status, "queued"))).limit(1).all();
  if (!current) return null;
  const updated = await db.update(aiRuns).set({
    status: "running",
    workerId,
    attemptCount: current.attemptCount + 1,
    startedAt: now,
    updatedAt: now,
  }).where(and(eq(aiRuns.id, runId), eq(aiRuns.status, "queued"))).returning().all();
  return updated[0] ?? null;
}

export async function completeAiRun(runId: number, result: AiRunResultInput): Promise<void> {
  await db.transaction((tx) => {
    const [run] = tx.select().from(aiRuns).where(eq(aiRuns.id, runId)).limit(1).all();
    if (!run || run.status === "succeeded") return;
    const now = new Date();
    tx.update(aiRuns).set({
      status: "succeeded",
      resultJson: result.resultJson,
      usageJson: result.usageJson,
      finishReason: result.finishReason,
      completedAt: now,
      updatedAt: now,
    }).where(eq(aiRuns.id, runId)).run();
    tx.insert(ideaAiResults).values({
      ideaId: run.ideaId,
      ideaVersionId: run.ideaVersionId,
      runId: run.id,
      jobKey: run.jobKey,
      jobVersion: run.jobVersion,
      resultJson: result.resultJson,
    }).run();
  });
}

export async function failAiRun(runId: number, failure: AiRunFailureInput): Promise<void> {
  const now = new Date();
  await db.update(aiRuns).set({
    status: failure.status ?? "failed",
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    completedAt: now,
    updatedAt: now,
  }).where(eq(aiRuns.id, runId)).run();
}

export async function requeueAiRun(runId: number, failure: AiRunFailureInput, availableAt = new Date()): Promise<void> {
  const now = new Date();
  await db.update(aiRuns).set({
    status: "queued",
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    availableAt,
    updatedAt: now,
  }).where(eq(aiRuns.id, runId)).run();
}

export async function appendIdeaEvent(input: CreateIdeaEventInput): Promise<IdeaEvent> {
  const [event] = await db.insert(ideaEvents).values(input).returning().all();
  if (!event) throw new Error("Idea event was not created");
  return event;
}

export async function recordHumanReview(input: CreateIdeaReviewInput): Promise<IdeaReview> {
  const [review] = await db.insert(ideaReviews).values(input).returning().all();
  if (!review) throw new Error("Idea review was not created");
  return review;
}

export async function getAuthorizedIdeaSnapshot(actor: AiActor, ideaId: number): Promise<AuthorizedIdeaSnapshot | null> {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
  if (!idea) return null;
  if (actor.kind === "user" && Number(actor.id) !== idea.authorId) return null;
  if (actor.kind !== "user" && actor.kind !== "admin") return null;

  const [versions, runs, events, reviews] = await Promise.all([
    db.select().from(ideaVersions).where(eq(ideaVersions.ideaId, ideaId)).all(),
    db.select().from(aiRuns).where(eq(aiRuns.ideaId, ideaId)).all(),
    db.select().from(ideaEvents).where(eq(ideaEvents.ideaId, ideaId)).all(),
    db.select().from(ideaReviews).where(eq(ideaReviews.ideaId, ideaId)).all(),
  ]);
  return { idea, versions, runs, events, reviews };
}

function actorUserId(actor: IdeaActor): number {
  const userId = Number(actor.id);
  if (!Number.isInteger(userId) || userId < 1) throw new Error("Invalid actor");
  return userId;
}

function pageBounds(page: number, pageSize: number) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export async function listIdeas(actor: IdeaActor, query: Pick<IdeaListQuery, "page" | "pageSize"> & Partial<Omit<IdeaListQuery, "page" | "pageSize">>): Promise<IdeaPage> {
  const userId = actorUserId(actor);
  const filters = [];
  if (query.mine ?? false) filters.push(eq(ideas.authorId, userId));
  if (query.status) filters.push(eq(ideas.status, query.status));
  if (query.category) filters.push(eq(ideas.category, query.category));
  if (query.search) {
    const search = `%${query.search}%`;
    filters.push(or(like(ideas.title, search), like(ideas.summary, search), like(ideas.reference, search)));
  }
  const where = filters.length ? and(...filters) : undefined;
  const { limit, offset } = pageBounds(query.page, query.pageSize);
  const [items, totalRow] = await Promise.all([
    db.select().from(ideas).where(where).orderBy(desc(ideas.createdAt), desc(ideas.id)).limit(limit).offset(offset).all(),
    db.select({ count: sql<number>`count(*)` }).from(ideas).where(where).all(),
  ]);
  const total = Number(totalRow[0]?.count ?? 0);
  return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
}

export async function getIdeaById(ideaId: number): Promise<Idea | null> {
  if (!Number.isInteger(ideaId) || ideaId < 1) return null;
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
  return idea ?? null;
}

export async function getIdeaSubmissionDetails(ideaId: number) {
  const [row] = await db.select().from(ideaSubmissions).where(eq(ideaSubmissions.ideaId, ideaId)).limit(1).all();
  if (!row) return null;
  return { answers: JSON.parse(row.answersJson) as Record<string, string>, metrics: JSON.parse(row.metricsJson) as Record<string, string | number>, score: row.score, minimumScore: row.minimumScore, validationPassed: row.validationPassed, differentiation: row.differentiation };
}

export async function updateReturnedIdea(actor: IdeaActor, ideaId: number, input: IdeaUpdate) {
  const userId = actorUserId(actor);
  return db.transaction((tx) => {
    const ownership = actor.kind === "admin"
      ? eq(ideas.id, ideaId)
      : and(eq(ideas.id, ideaId), eq(ideas.authorId, userId));
    const [current] = tx.select().from(ideas).where(ownership).limit(1).all();
    if (!current) throw new Error("Idea not found or not authorized");
    if (current.status !== "returned") throw new Error("Only returned ideas can be edited");

    const [latestVersion] = tx.select().from(ideaVersions).where(eq(ideaVersions.ideaId, ideaId)).orderBy(desc(ideaVersions.version)).limit(1).all();
    const version = (latestVersion?.version ?? 0) + 1;
    const next = {
      kind: input.kind ?? current.kind,
      title: input.title ?? current.title,
      summary: input.summary ?? current.summary,
      problem: input.problem === undefined ? current.problem : input.problem,
      solution: input.solution === undefined ? current.solution : input.solution,
      benefits: input.benefits === undefined ? current.benefits : input.benefits,
      risks: input.risks === undefined ? current.risks : input.risks,
      category: input.category ?? current.category,
      dataClassification: input.dataClassification ?? latestVersion?.dataClassification ?? "internal",
    } as const;
    const now = new Date();
    const contentHash = createContentHash(next);
    const [idea] = tx.update(ideas).set({ ...next, updatedAt: now }).where(eq(ideas.id, ideaId)).returning().all();
    const [createdVersion] = tx.insert(ideaVersions).values({ ...next, ideaId, authorId: current.authorId, version, contentHash, createdAt: now, updatedAt: now }).returning().all();
    if (!idea || !createdVersion) throw new Error("Idea update was not created");
    tx.insert(ideaEvents).values({ ideaId, ideaVersionId: createdVersion.id, actorType: actor.kind, actorId: userId, eventType: "returned_edited", correlationId: `idea:${ideaId}:version:${version}` }).run();
    return { idea, version: createdVersion };
  });
}

function createContentHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function supportIdea(actor: IdeaActor, ideaId: number) {
  const userId = actorUserId(actor);
  const result = await db.transaction((tx) => {
    const [idea] = tx.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
    if (!idea) throw new Error("Idea not found");
    if (idea.authorId === userId) throw new Error("You cannot support your own idea");
    const [createdSupport] = tx.insert(ideaSupports).values({ ideaId, userId }).onConflictDoNothing({ target: [ideaSupports.ideaId, ideaSupports.userId] }).returning().all();
    const [{ count }] = tx.select({ count: sql<number>`count(*)` }).from(ideaSupports).where(eq(ideaSupports.ideaId, ideaId)).all();
    const supports = Number(count ?? 0);
    tx.update(ideas).set({ supports, updatedAt: new Date() }).where(eq(ideas.id, ideaId)).run();
    if (createdSupport) {
      tx.insert(notifications).values({ userId: idea.authorId, type: "idea_supported", title: "Your idea received support", body: `${idea.reference} received a new support.`, link: `/ideas/${ideaId}` }).run();
    }
    return { supported: true, supports };
  });
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
  const [created] = await db.select().from(ideaSupports).where(and(eq(ideaSupports.ideaId, ideaId), eq(ideaSupports.userId, userId))).limit(1).all();
  if (idea && created) {
    await awardPoints({ userId: idea.authorId, amount: 2, eventType: "idea_support", sourceType: "idea_support", sourceId: `${ideaId}:${userId}`, idempotencyKey: `idea:${ideaId}:support-author:${userId}` });
  }
  return result;
}

export async function listIdeaComments(ideaId: number, query: { page: number; pageSize: number }): Promise<CommentPage> {
  const { limit, offset } = pageBounds(query.page, query.pageSize);
  const [rows, totalRow] = await Promise.all([
    db.select({ comment: ideaComments, author: { id: users.id, name: users.name, department: users.department } })
      .from(ideaComments).leftJoin(users, eq(users.id, ideaComments.authorId)).where(eq(ideaComments.ideaId, ideaId))
      .orderBy(asc(ideaComments.createdAt), asc(ideaComments.id)).limit(limit).offset(offset).all(),
    db.select({ count: sql<number>`count(*)` }).from(ideaComments).where(eq(ideaComments.ideaId, ideaId)).all(),
  ]);
  const total = Number(totalRow[0]?.count ?? 0);
  return { items: rows.map(({ comment, author }) => ({ ...comment, author })), page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
}

export async function createIdeaComment(actor: IdeaActor, ideaId: number, body: string) {
  const userId = actorUserId(actor);
  const text = body.trim();
  if (!text || text.length > 2_000) throw new Error("Comment is invalid");
  const result = await db.transaction((tx) => {
    const [idea] = tx.select({ id: ideas.id, authorId: ideas.authorId }).from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
    if (!idea) throw new Error("Idea not found");
    const [comment] = tx.insert(ideaComments).values({ ideaId, authorId: userId, body: text }).returning().all();
    if (!comment) throw new Error("Comment was not created");
    const [author] = tx.select({ id: users.id, name: users.name, department: users.department })
      .from(users).where(eq(users.id, userId)).limit(1).all();
    tx.update(ideas).set({ comments: sql`${ideas.comments} + 1`, updatedAt: new Date() }).where(eq(ideas.id, ideaId)).run();
    if (idea.authorId !== userId) tx.insert(notifications).values({ userId: idea.authorId, type: "idea_comment", title: "Your idea received a comment", body: "A colleague commented on your idea.", link: `/ideas/${ideaId}` }).run();
    return { comment: { ...comment, author: author ?? null }, ideaAuthorId: idea.authorId };
  });
  if (result.ideaAuthorId !== userId) {
    await awardPoints({ userId, amount: 5, eventType: "idea_comment", sourceType: "idea_comment", sourceId: String(result.comment.id), idempotencyKey: `idea:comment:${result.comment.id}:author:${userId}` });
  }
  return result.comment;
}

export async function getIdeaMinimumScore() {
  const [setting] = await db.select().from(ideaSettings).where(eq(ideaSettings.key, "minimum_priority_score")).limit(1).all();
  const configured = Number(setting?.value ?? 2);
  return Number.isFinite(configured) && configured >= 0 && configured <= 3 ? configured : 2;
}

export async function setIdeaMinimumScore(actor: IdeaActor, value: number) {
  const userId = actorUserId(actor);
  if (actor.kind !== "admin") throw new Error("Administrator access required");
  if (!Number.isFinite(value) || value < 0 || value > 3) throw new Error("Minimum priority score must be between 0 and 3");
  await db.insert(ideaSettings).values({ key: "minimum_priority_score", value: String(value), updatedBy: userId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: ideaSettings.key, set: { value: String(value), updatedBy: userId, updatedAt: new Date() } }).run();
  await appendAuditEvent({ action: "ideas.minimum_score.updated", targetType: "idea_setting", targetId: "minimum_priority_score", metadata: { status: "updated", result: value } });
  return value;
}

export async function saveIdeaSubmission(actor: IdeaActor, ideaId: number, input: {
  answers: Record<string, string>;
  metrics: { turnaround: number; volume: number; value: number; turnaroundExplanation?: string; volumeExplanation?: string; valueExplanation?: string };
  differentiation?: string;
  buildsOnId?: number;
}) {
  const userId = actorUserId(actor);
  const [idea] = await db.select().from(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.authorId, userId))).limit(1).all();
  if (!idea) throw new Error("Idea not found or not authorized");
  if (idea.status !== "screening" && idea.status !== "returned") throw new Error("Submission details cannot be changed at this workflow stage");
  const [existing] = await db.select().from(ideaSubmissions).where(eq(ideaSubmissions.ideaId, ideaId)).limit(1).all();
  if (existing?.submittedAt) throw new Error("Submitted idea details are locked");
  if (input.buildsOnId) {
    const [original] = await db.select().from(ideas).where(eq(ideas.id, input.buildsOnId)).limit(1).all();
    if (!original || original.authorId === userId || input.buildsOnId === ideaId) throw new Error("Selected original idea is invalid");
    await db.update(ideas).set({ buildsOnId: input.buildsOnId }).where(eq(ideas.id, ideaId)).run();
  }
  const minimumScore = await getIdeaMinimumScore();
  const score = Math.round((input.metrics.turnaround * 0.3 + input.metrics.volume * 0.3 + input.metrics.value * 0.4) * 100) / 100;
  const [submission] = await db.insert(ideaSubmissions).values({
    ideaId,
    answersJson: JSON.stringify(input.answers),
    metricsJson: JSON.stringify(input.metrics),
    score,
    minimumScore,
    validationPassed: false,
    differentiation: input.differentiation ?? null,
  }).onConflictDoUpdate({
    target: ideaSubmissions.ideaId,
    set: { answersJson: JSON.stringify(input.answers), metricsJson: JSON.stringify(input.metrics), score, minimumScore, differentiation: input.differentiation ?? null, updatedAt: new Date() },
  }).returning().all();
  if (!submission) throw new Error("Idea submission details were not saved");
  return submission;
}

export async function creditOriginalIdea(actor: IdeaActor, ideaId: number, originalIdeaId: number) {
  const authorId = actorUserId(actor);
  return db.transaction((tx) => {
    const [idea] = tx.select().from(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.authorId, authorId))).limit(1).all();
    const [original] = tx.select().from(ideas).where(eq(ideas.id, originalIdeaId)).limit(1).all();
    if (!idea || !original || original.authorId === authorId || originalIdeaId === ideaId) throw new Error("Selected original idea is invalid");
    if (idea.buildsOnId === originalIdeaId) return { originalAuthorId: original.authorId, credited: true };
    if (idea.buildsOnId) throw new Error("This idea already credits a different original");
    tx.update(ideas).set({ buildsOnId: originalIdeaId, updatedAt: new Date() }).where(eq(ideas.id, ideaId)).run();
    tx.insert(notifications).values({ userId: original.authorId, type: "idea_builds_on", title: "A colleague built on your idea", body: `${original.reference} has been credited as the basis for a related idea.`, link: `/ideas/${ideaId}` }).run();
    return { originalAuthorId: original.authorId, credited: true };
  });
}

export async function submitIdea(actor: IdeaActor, ideaId: number) {
  const userId = actorUserId(actor);
  const result = await db.transaction((tx) => {
    const [idea] = tx.select().from(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.authorId, userId))).limit(1).all();
    if (!idea) throw new Error("Idea not found or not authorized");
    const [submission] = tx.select().from(ideaSubmissions).where(eq(ideaSubmissions.ideaId, ideaId)).limit(1).all();
    if (!submission) throw new Error("Five answers and all three impact metrics are required before submission");
    const metrics = JSON.parse(submission.metricsJson) as { turnaround: number; volume: number; value: number };
    const breakdown = [
      { key: "turnaround", score: metrics.turnaround, weight: 0.3, contribution: Math.round(metrics.turnaround * 30) / 100 },
      { key: "volume", score: metrics.volume, weight: 0.3, contribution: Math.round(metrics.volume * 30) / 100 },
      { key: "value", score: metrics.value, weight: 0.4, contribution: Math.round(metrics.value * 40) / 100 },
    ] as const;
    if (submission.submittedAt) return { idea, reference: idea.reference, score: submission.score, minimumScore: submission.minimumScore, priorityBand: idea.priorityBand, category: idea.category, breakdown };
    const [latestVersion] = tx.select({ id: ideaVersions.id }).from(ideaVersions).where(eq(ideaVersions.ideaId, ideaId)).orderBy(desc(ideaVersions.version)).limit(1).all();
    const [validationRun] = tx.select().from(aiRuns).where(and(eq(aiRuns.ideaId, ideaId), eq(aiRuns.jobKey, "idea.validate"), eq(aiRuns.ideaVersionId, latestVersion?.id ?? -1))).orderBy(desc(aiRuns.createdAt)).limit(1).all();
    let validationPassed = false;
    try { validationPassed = validationRun?.status === "succeeded" && JSON.parse(validationRun.resultJson ?? "{}").decision === "accept"; } catch { validationPassed = false; }
    if (!validationPassed) throw new Error("Idea validation must pass for the current draft before submission");
    const [preflight] = tx.select().from(aiRuns).where(and(eq(aiRuns.ideaId, ideaId), eq(aiRuns.jobKey, "idea.preflight"), eq(aiRuns.status, "succeeded"))).orderBy(desc(aiRuns.createdAt)).limit(1).all();
    let safe = false;
    try { const result = JSON.parse(preflight?.resultJson ?? "{}"); safe = result.decision === "allow" && result.safeToProcess === true; } catch { safe = false; }
    if (!safe) throw new Error("Idea must pass validation before it can be submitted");
    const [minimumSetting] = tx.select().from(ideaSettings).where(eq(ideaSettings.key, "minimum_priority_score")).limit(1).all();
    const minimum = Number(minimumSetting?.value ?? 2);
    if (submission.score < minimum) throw new Error(`Priority score ${submission.score.toFixed(2)} is below the minimum ${minimum.toFixed(2)}`);
    if (idea.status !== "screening" && idea.status !== "returned") throw new Error("Idea cannot be submitted from its current status");
    const year = new Date().getUTCFullYear();
    const [{ count: existingReferences }] = tx.select({ count: sql<number>`count(*)` }).from(ideas).where(like(ideas.reference, `ABI-${year}-%`)).all();
    const [sequence] = tx.insert(ideaReferenceSequences).values({ year, lastValue: Number(existingReferences ?? 0) + 1 }).onConflictDoUpdate({
      target: ideaReferenceSequences.year,
      set: { lastValue: sql`${ideaReferenceSequences.lastValue} + 1` },
    }).returning().all();
    if (!sequence || sequence.lastValue > 99_999) throw new Error("The annual idea reference sequence is exhausted");
    const reference = `ABI-${year}-${String(sequence.lastValue).padStart(5, "0")}`;
    const [updated] = tx.update(ideas).set({ reference, priorityScore: submission.score, priorityBand: submission.score >= 2.5 ? "Priority" : submission.score >= 1.5 ? "Qualify" : "Watch", status: "screening", updatedAt: new Date() }).where(eq(ideas.id, ideaId)).returning().all();
    tx.update(ideaSubmissions).set({ validationPassed: true, submittedAt: new Date(), minimumScore: minimum, updatedAt: new Date() }).where(eq(ideaSubmissions.ideaId, ideaId)).run();
    tx.insert(ideaEvents).values({ ideaId, actorType: actor.kind, actorId: userId, eventType: "submitted", toStatus: "screening", metadataJson: JSON.stringify({ score: submission.score, minimum, breakdown: { turnaround: 0.3, volume: 0.3, value: 0.4 } }) }).run();
    tx.insert(notifications).values({ userId, type: "idea_submitted", title: "Idea submitted", body: `${reference} has been submitted for review.`, link: `/ideas/${ideaId}` }).run();
    tx.insert(auditEvents).values({ actorUserId: userId, action: "ideas.submitted", targetType: "idea", targetId: String(ideaId), metadataJson: JSON.stringify({ status: "submitted", result: submission.score }), createdAt: new Date() }).run();
    return { idea: updated, reference, score: submission.score, minimumScore: minimum, priorityBand: updated.priorityBand, category: updated.category, breakdown };
  });
  await awardPoints({ userId, amount: 50, eventType: "idea_submission", sourceType: "idea", sourceId: String(ideaId), idempotencyKey: `idea:${ideaId}:submission:points` });
  return result;
}
