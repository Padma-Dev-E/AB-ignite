import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { db } from "../../../../../src/db/connection";
import { aiRuns, ideaVersions, ideas } from "../../../../../src/db/schema";
import { getAiConfig } from "../../../../../src/lib/ai/config-core";
import { getAiJob } from "../../../../../src/lib/ai/registry";
import "../../../../../src/lib/ai/jobs";
import { appendAuditEvent } from "../../../../../src/lib/audit/service";
import { canDevelopIdea } from "../../../../../src/lib/ideas/development";
import { IdeaEnrichmentOutputSchema, IdeaUpdateSchema, IdeaValidationOutputSchema } from "../../../../../src/lib/ideas/schemas";
import { appendIdeaEvent, createAiRun, getAuthorizedIdeaSnapshot } from "../../../../../src/lib/ideas/repository";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

const requestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("update"), input: IdeaUpdateSchema }),
  z.strictObject({ action: z.literal("enrich") }),
  z.strictObject({ action: z.literal("validate") }),
]);

function parseId(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

async function context(request: Request, params: Promise<{ id: string }>) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session?.user?.id || session.isValid === false || !Number.isInteger(userId) || userId < 1) return { error: apiError("unauthorized", "Authentication required.", 401, requestId(request)) };
  const ideaId = parseId((await params).id);
  if (!ideaId) return { error: apiError("validation_error", "Invalid idea ID.", 400, requestId(request)) };
  const snapshot = await getAuthorizedIdeaSnapshot({ kind: "user", id: String(userId) }, ideaId);
  if (!snapshot) return { error: apiError("not_found", "Idea not found.", 404, requestId(request)) };
  const hasPreflight = snapshot.runs.some((run) => run.jobKey === "idea.preflight");
  return { userId, ideaId, snapshot, canDevelop: canDevelopIdea(snapshot.idea, userId, hasPreflight) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const state = await context(request, params);
    if (state.error) return state.error;
    const runs = state.snapshot!.runs.filter((run) => run.jobKey === "idea.enrich" || run.jobKey === "idea.validate").sort((a, b) => b.id - a.id);
    return ok({ runs: runs.map((run) => {
      const schema = run.jobKey === "idea.enrich" ? IdeaEnrichmentOutputSchema : IdeaValidationOutputSchema;
      let result = null;
      if (run.status === "succeeded" && run.resultJson) {
        try { const parsed = schema.safeParse(JSON.parse(run.resultJson)); if (parsed.success) result = parsed.data; } catch { /* Treat corrupt stored output as unavailable. */ }
      }
      return { id: run.id, jobKey: run.jobKey, status: run.status, ideaVersionId: run.ideaVersionId, result, createdAt: run.createdAt, completedAt: run.completedAt };
    }) }, 200, id);
  } catch (error) { return handleApiError(error, id); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const state = await context(request, params);
    if (state.error) return state.error;
    if (!state.canDevelop) return apiError("conflict", "This idea is no longer available for development.", 409, id);
    const input = requestSchema.parse(await request.json());
    const version = state.snapshot!.versions.at(-1);
    if (!version) return apiError("conflict", "Idea version not found.", 409, id);
    if (input.action === "update") {
      const next = { kind: version.kind, title: version.title, summary: version.summary, problem: version.problem, solution: version.solution, benefits: version.benefits, risks: version.risks, category: version.category, dataClassification: version.dataClassification, ...input.input };
      const changed = Object.entries(input.input).some(([key, value]) => value !== version[key as keyof typeof version]);
      if (!changed) return ok({ idea: state.snapshot!.idea, versionId: version.id }, 200, id);
      const contentHash = createHash("sha256").update(JSON.stringify(next)).digest("hex");
      const updated = await db.transaction((tx) => {
        const [latest] = tx.select().from(ideaVersions).where(eq(ideaVersions.ideaId, state.ideaId!)).orderBy(desc(ideaVersions.version)).limit(1).all();
        const [preflight] = tx.select({ id: aiRuns.id }).from(aiRuns).where(and(eq(aiRuns.ideaId, state.ideaId!), eq(aiRuns.jobKey, "idea.preflight"))).limit(1).all();
        if (!latest || latest.id !== version.id || preflight) return null;
        const [idea] = tx.update(ideas).set({ ...input.input, updatedAt: new Date() }).where(and(eq(ideas.id, state.ideaId!), eq(ideas.authorId, state.userId!), eq(ideas.status, "screening"))).returning().all();
        if (!idea) return null;
        const [newVersion] = tx.insert(ideaVersions).values({ ...next, ideaId: state.ideaId!, authorId: state.userId!, version: version.version + 1, contentHash }).returning().all();
        return { idea, versionId: newVersion.id };
      });
      if (!updated) return apiError("conflict", "The idea changed while you were editing. Reload and try again.", 409, id);
      await appendIdeaEvent({ ideaId: state.ideaId!, ideaVersionId: updated.versionId, actorType: "user", actorId: state.userId!, eventType: "development_updated", correlationId: id });
      appendAuditEvent({ actorUserId: state.userId!, action: "idea.development_updated", targetType: "idea", targetId: state.ideaId!, metadata: { versionId: updated.versionId } });
      return ok(updated, 200, id);
    }
    const job = getAiJob(input.action === "enrich" ? "idea.enrich" : "idea.validate", "1");
    const previous = state.snapshot!.runs.filter((candidate) => candidate.ideaVersionId === version.id && candidate.jobKey === job.key).sort((a, b) => b.id - a.id);
    const latest = previous[0];
    if (latest && !["failed", "timed_out", "cancelled"].includes(latest.status)) return ok({ runId: latest.id, status: latest.status, versionId: version.id }, 200, id);
    if (previous.length >= 3) return apiError("rate_limited", "This draft has reached the AI retry limit. You can continue without AI suggestions.", 429, id);
    const run = await createAiRun({ ideaId: state.ideaId!, ideaVersionId: version.id, jobKey: job.key, jobVersion: job.version, promptVersion: job.version, model: job.model ?? getAiConfig().model, idempotencyKey: `idea:${state.ideaId}:version:${version.id}:${job.key}:v${job.version}:try:${previous.length + 1}`, correlationId: id, requestedBy: state.userId!, inputHash: version.contentHash });
    if (run.correlationId === id) {
      await appendIdeaEvent({ ideaId: state.ideaId!, ideaVersionId: version.id, actorType: "user", actorId: state.userId!, eventType: `${input.action}_queued`, correlationId: id, metadataJson: JSON.stringify({ runId: run.id }) });
      appendAuditEvent({ actorUserId: state.userId!, action: `idea.${input.action}_queued`, targetType: "idea", targetId: state.ideaId!, metadata: { runId: run.id, versionId: version.id } });
    }
    return ok({ runId: run.id, status: run.status, versionId: version.id }, 202, id);
  } catch (error) { return handleApiError(error, id); }
}
