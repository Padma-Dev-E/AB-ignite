import { desc } from "drizzle-orm";
import { auth } from "../../../../../auth";
import { db } from "../../../../../src/db/connection";
import { aiRuns } from "../../../../../src/db/schema";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    if (session.user.role !== "back_office") return apiError("forbidden", "Administrator access required.", 403, id);
    const runs = await db.select({
      id: aiRuns.id, ideaId: aiRuns.ideaId, jobKey: aiRuns.jobKey, jobVersion: aiRuns.jobVersion, model: aiRuns.model,
      status: aiRuns.status, attemptCount: aiRuns.attemptCount, errorCode: aiRuns.errorCode, createdAt: aiRuns.createdAt,
      startedAt: aiRuns.startedAt, completedAt: aiRuns.completedAt,
    }).from(aiRuns).orderBy(desc(aiRuns.createdAt)).limit(100).all();
    return ok(runs, 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
