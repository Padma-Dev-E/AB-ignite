import { eq } from "drizzle-orm";
import { auth } from "../../../../../auth";
import { db } from "../../../../../src/db/connection";
import { aiRuns } from "../../../../../src/db/schema";
import { getAuthorizedIdeaSnapshot } from "../../../../../src/lib/ideas/repository";
import { runIdeaScreeningWorkflow } from "../../../../../src/lib/ideas/workflow";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = Number((await params).id);
    if (!Number.isInteger(ideaId) || ideaId < 1) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const actor = { kind: session.user.role, id: session.user.id } as const;
    const snapshot = await getAuthorizedIdeaSnapshot(actor, ideaId);
    if (!snapshot) return apiError("not_found", "Idea not found.", 404, id);
    let body: { versionId?: number; idempotencyKey?: string } = {};
    try { body = await request.json(); } catch { /* empty body is valid */ }
    const version = body.versionId ? snapshot.versions.find((item) => item.id === body.versionId) : snapshot.versions.at(-1);
    if (!version) return apiError("validation_error", "Idea version not found.", 400, id);
    const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.length <= 160
      ? body.idempotencyKey
      : `idea:${ideaId}:version:${version.id}:idea.preflight:v1`;
    await runIdeaScreeningWorkflow(ideaId, version.id, actor, idempotencyKey);
    const [run] = await db.select().from(aiRuns).where(eq(aiRuns.idempotencyKey, idempotencyKey)).limit(1).all();
    return ok({ ideaId, versionId: version.id, runId: run?.id ?? null, status: run?.status ?? "queued" }, 202, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
