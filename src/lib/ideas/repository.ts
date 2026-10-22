import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "../../db/connection";
import {
  aiRuns,
  ideaAiResults,
  ideaEvents,
  ideaReviews,
  ideaVersions,
  ideas,
  type AiRun,
  type Idea,
  type IdeaEvent,
  type IdeaReview,
  type IdeaVersion,
  type NewAiRun,
  type NewIdeaVersion,
} from "../../db/schema";
import type { AiActor } from "../ai/types";

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
