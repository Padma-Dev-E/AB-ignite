import { desc, eq } from "drizzle-orm";
import { auth } from "../../../../../auth";
import { db } from "../../../../../src/db/connection";
import { aiRuns } from "../../../../../src/db/schema";
import { appendIdeaEvent, createAiRun, getAuthorizedIdeaSnapshot } from "../../../../../src/lib/ideas/repository";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    if (session.user.role !== "back_office") return apiError("forbidden", "Reviewer access required.", 403, id);
    const ideaId = Number((await params).id);
    const snapshot = await getAuthorizedIdeaSnapshot({ kind: "admin", id: session.user.id }, ideaId);
    if (!snapshot) return apiError("not_found", "Idea not found.", 404, id);
    const [failed] = await db.select().from(aiRuns).where(eq(aiRuns.ideaId, ideaId)).orderBy(desc(aiRuns.createdAt)).limit(1).all();
    if (!failed || !["failed", "timed_out"].includes(failed.status)) return apiError("conflict", "There is no failed AI run to retry.", 409, id);
    const retry = await createAiRun({
      ideaId: failed.ideaId,
      ideaVersionId: failed.ideaVersionId,
      jobKey: failed.jobKey,
      jobVersion: failed.jobVersion,
      promptVersion: failed.promptVersion,
      model: failed.model,
      idempotencyKey: `${failed.idempotencyKey}:retry:${Date.now()}`,
      correlationId: id,
      requestedBy: Number(session.user.id),
      inputHash: failed.inputHash,
    });
    await appendIdeaEvent({ ideaId, ideaVersionId: failed.ideaVersionId, actorType: "admin", actorId: Number(session.user.id), eventType: "ai_retry_requested", correlationId: id, metadataJson: JSON.stringify({ previousRunId: failed.id, runId: retry.id }) });
    return ok({ runId: retry.id, status: retry.status }, 202, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
