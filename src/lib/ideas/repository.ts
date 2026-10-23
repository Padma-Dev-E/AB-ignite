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
  return db.transaction((tx) => {
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
    db.select().from(ideas).where(where).orderBy(desc(ideas.createdAt)).limit(limit).offset(offset).all(),
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
  return db.transaction((tx) => {
    const [idea] = tx.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
    if (!idea) throw new Error("Idea not found");
    tx.insert(ideaSupports).values({ ideaId, userId }).onConflictDoNothing({ target: [ideaSupports.ideaId, ideaSupports.userId] }).run();
    const [{ count }] = tx.select({ count: sql<number>`count(*)` }).from(ideaSupports).where(eq(ideaSupports.ideaId, ideaId)).all();
    const supports = Number(count ?? 0);
    tx.update(ideas).set({ supports, updatedAt: new Date() }).where(eq(ideas.id, ideaId)).run();
    return { supported: true, supports };
  });
}

export async function listIdeaComments(ideaId: number, query: { page: number; pageSize: number }): Promise<CommentPage> {
  const { limit, offset } = pageBounds(query.page, query.pageSize);
  const [rows, totalRow] = await Promise.all([
    db.select({ comment: ideaComments, author: { id: users.id, name: users.name, department: users.department } })
      .from(ideaComments).leftJoin(users, eq(users.id, ideaComments.authorId)).where(eq(ideaComments.ideaId, ideaId))
      .orderBy(asc(ideaComments.createdAt)).limit(limit).offset(offset).all(),
    db.select({ count: sql<number>`count(*)` }).from(ideaComments).where(eq(ideaComments.ideaId, ideaId)).all(),
  ]);
  const total = Number(totalRow[0]?.count ?? 0);
  return { items: rows.map(({ comment, author }) => ({ ...comment, author })), page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
}

export async function createIdeaComment(actor: IdeaActor, ideaId: number, body: string) {
  const userId = actorUserId(actor);
  const text = body.trim();
  if (!text || text.length > 2_000) throw new Error("Comment is invalid");
  return db.transaction((tx) => {
    const [idea] = tx.select({ id: ideas.id }).from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
    if (!idea) throw new Error("Idea not found");
    const [comment] = tx.insert(ideaComments).values({ ideaId, authorId: userId, body: text }).returning().all();
    if (!comment) throw new Error("Comment was not created");
    tx.update(ideas).set({ comments: sql`${ideas.comments} + 1`, updatedAt: new Date() }).where(eq(ideas.id, ideaId)).run();
    return comment;
  });
}
