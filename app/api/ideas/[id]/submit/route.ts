import { auth } from "../../../../../auth";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../../src/db/connection";
import { aiRuns } from "../../../../../src/db/schema";
import { getAuthorizedIdeaSnapshot } from "../../../../../src/lib/ideas/repository";
import { submitIdea, getIdeaMinimumScore } from "../../../../../src/lib/ideas/repository";
import { runIdeaScreeningWorkflow } from "../../../../../src/lib/ideas/workflow";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = Number((await params).id);
    if (!Number.isInteger(ideaId) || ideaId < 1) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const actor = { kind: session.user.role, id: session.user.id } as const;
    const snapshot = await getAuthorizedIdeaSnapshot(actor, ideaId);
    if (!snapshot) return apiError("not_found", "Idea not found.", 404, id);
    const version = snapshot.versions.at(-1);
    if (!version) return apiError("validation_error", "Idea version not found.", 400, id);
    const [latestPreflight] = await db.select().from(aiRuns).where(and(eq(aiRuns.ideaId, ideaId), eq(aiRuns.jobKey, "idea.preflight"))).orderBy(desc(aiRuns.createdAt)).limit(1).all();
    if (!latestPreflight || latestPreflight.status !== "succeeded") {
      const idempotencyKey = `idea:${ideaId}:version:${version.id}:idea.preflight:v1`;
      await runIdeaScreeningWorkflow(ideaId, version.id, actor, idempotencyKey);
      const [run] = await db.select().from(aiRuns).where(eq(aiRuns.idempotencyKey, idempotencyKey)).limit(1).all();
      return ok({ ideaId, versionId: version.id, runId: run?.id ?? null, status: run?.status ?? "queued", submitted: false }, 202, id);
    }
    let preflight: { decision?: string; safeToProcess?: boolean } = {};
    try { preflight = JSON.parse(latestPreflight.resultJson ?? "{}"); } catch { /* invalid stored output is treated as a failed validation */ }
    if (preflight.decision !== "allow" || preflight.safeToProcess !== true) return apiError("validation_failed", "Idea validation failed; improve the idea and run validation again.", 422, id);
    const submission = await submitIdea(actor, ideaId);
    return ok({ ...submission, minimumScore: await getIdeaMinimumScore(), confirmation: `Congratulations, ${submission.reference} has been submitted.` }, 201, id);
  } catch (error) {
    if (error instanceof Error && /below the minimum|must pass validation|answers and all three|current status/i.test(error.message)) return apiError("submission_rejected", error.message, 422, id);
    return handleApiError(error, id);
  }
}
