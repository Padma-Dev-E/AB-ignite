import { and, eq } from "drizzle-orm";
import { db } from "../../db/connection";
import { aiRuns, ideaVersions, ideas } from "../../db/schema";
import { getAiJob } from "../ai/registry";
import "../ai/jobs";
import type { AiActor } from "../ai/types";
import { appendIdeaEvent, createAiRun, getAuthorizedIdeaSnapshot } from "./repository";

export type IdeaStatus = "screening" | "returned" | "business_review" | "control_review" | "decision" | "poc" | "implementation" | "implemented" | "rejected" | "deferred";

const transitions: Record<IdeaStatus, IdeaStatus[]> = {
  screening: ["returned", "business_review", "control_review"],
  returned: ["screening", "business_review"],
  business_review: ["returned", "control_review", "decision"],
  control_review: ["returned", "decision"],
  decision: ["poc", "rejected", "deferred"],
  poc: ["implementation", "decision", "deferred"],
  implementation: ["implemented", "decision"],
  implemented: [],
  rejected: [],
  deferred: ["screening", "decision"],
};

export function canTransitionIdeaStatus(actor: AiActor, from: IdeaStatus, to: IdeaStatus) {
  if (actor.kind === "ai" || actor.kind === "user") return false;
  if (!transitions[from]?.includes(to)) return false;
  if (actor.kind === "system") return from === "screening" && ["returned", "business_review", "control_review"].includes(to);
  return actor.kind === "admin";
}

export async function transitionIdeaStatus(actor: AiActor, ideaId: number, to: IdeaStatus, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required for every workflow transition");
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1).all();
  if (!idea) throw new Error("Idea not found");
  const from = idea.status as IdeaStatus;
  if (!canTransitionIdeaStatus(actor, from, to)) throw new Error("Actor is not authorized for this workflow transition");
  const now = new Date();
  const [updated] = await db.update(ideas).set({ status: to, updatedAt: now }).where(and(eq(ideas.id, ideaId), eq(ideas.status, from))).returning().all();
  if (!updated) throw new Error("Idea status changed before this transition could be applied");
  await appendIdeaEvent({
    ideaId,
    actorType: actor.kind,
    actorId: actor.id ? Number(actor.id) : null,
    eventType: "status_changed",
    fromStatus: from,
    toStatus: to,
    metadataJson: JSON.stringify({ reason }),
  });
  return updated;
}

export async function runIdeaScreeningWorkflow(ideaId: number, versionId: number, actor: AiActor, idempotencyKey?: string): Promise<void> {
  const snapshot = await getAuthorizedIdeaSnapshot(actor, ideaId);
  const version = snapshot?.versions.find((candidate) => candidate.id === versionId);
  if (!snapshot || !version) throw new Error("Idea version not found or not authorized");
  const job = getAiJob("idea.preflight", "1");
  await db.update(ideas).set({ status: "screening", updatedAt: new Date() }).where(eq(ideas.id, ideaId)).run();
  const run = await createAiRun({
    ideaId,
    ideaVersionId: version.id,
    jobKey: job.key,
    jobVersion: job.version,
    promptVersion: job.version,
    model: job.model ?? "gemini-3.8-flash",
    idempotencyKey: idempotencyKey ?? `idea:${ideaId}:version:${version.id}:idea.preflight:v1`,
    correlationId: `idea:${ideaId}:version:${version.id}`,
    requestedBy: actor.id ? Number(actor.id) : null,
    inputHash: version.contentHash,
  });
  await appendIdeaEvent({ ideaId, ideaVersionId: version.id, actorType: actor.kind, actorId: actor.id ? Number(actor.id) : null, eventType: "screening_queued", correlationId: run.correlationId, metadataJson: JSON.stringify({ runId: run.id }) });
}
