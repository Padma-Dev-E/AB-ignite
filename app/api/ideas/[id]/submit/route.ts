import { z } from "zod";
import { auth } from "../../../../../auth";
import { getAuthorizedIdeaSnapshot, getIdeaVersionPreflight, submitIdea, getIdeaMinimumScore, IdeaPriorityMinimumError } from "../../../../../src/lib/ideas/repository";
import { runIdeaScreeningWorkflow } from "../../../../../src/lib/ideas/workflow";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

const submitSchema = z.strictObject({
  versionId: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  submitForHumanReview: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = Number((await params).id);
    if (!Number.isInteger(ideaId) || ideaId < 1) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const actor = { kind: session.user.role, id: session.user.id } as const;
    const input = submitSchema.parse(await request.json());
    const snapshot = await getAuthorizedIdeaSnapshot(actor, ideaId);
    if (!snapshot) return apiError("not_found", "Idea not found.", 404, id);
    const version = snapshot.versions.at(-1);
    if (!version) return apiError("validation_error", "Idea version not found.", 400, id);
    const latestPreflight = await getIdeaVersionPreflight(ideaId, version.id);
    if (!latestPreflight || latestPreflight.status !== "succeeded") {
      const idempotencyKey = `idea:${ideaId}:version:${version.id}:idea.preflight:v1`;
      await runIdeaScreeningWorkflow(ideaId, version.id, actor, idempotencyKey);
      const run = await getIdeaVersionPreflight(ideaId, version.id);
      return ok({ ideaId, versionId: version.id, runId: run?.id ?? null, status: run?.status ?? "queued", submitted: false }, 202, id);
    }
    let preflight: { decision?: string; safeToProcess?: boolean } = {};
    try { preflight = JSON.parse(latestPreflight.resultJson ?? "{}"); } catch { /* invalid stored output is treated as a failed validation */ }
    if (preflight.decision !== "allow" || preflight.safeToProcess !== true) return apiError("validation_failed", "Idea validation failed; improve the idea and run validation again.", 422, id);
    const submission = await submitIdea(actor, ideaId, { submitForHumanReview: input.submitForHumanReview });
    return ok({ ...submission, submitted: true, minimumScore: await getIdeaMinimumScore(), confirmation: `Congratulations, ${submission.reference} has been submitted.` }, 201, id);
  } catch (error) {
    if (error instanceof IdeaPriorityMinimumError) {
      return Response.json({
        data: null,
        error: { code: error.code, message: error.message, details: { score: error.score, minimumScore: error.minimumScore, priorityBand: error.priorityBand, breakdown: error.breakdown } },
        requestId: id,
      }, { status: 422, headers: { "x-request-id": id, "cache-control": "no-store" } });
    }
    if (error instanceof Error && /below the minimum|must pass validation|validation must pass|answers and all three|current status|human review submission/i.test(error.message)) return apiError("submission_rejected", error.message, 422, id);
    return handleApiError(error, id);
  }
}
