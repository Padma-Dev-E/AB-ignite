import { and, desc, eq } from "drizzle-orm";
import { auth } from "../../../../../auth";
import { db } from "../../../../../src/db/connection";
import { ideaAiResults } from "../../../../../src/db/schema";
import { getAuthorizedIdeaSnapshot } from "../../../../../src/lib/ideas/repository";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = Number((await params).id);
    const snapshot = await getAuthorizedIdeaSnapshot({ kind: session.user.role, id: session.user.id }, ideaId);
    if (!snapshot) return apiError("not_found", "Idea not found.", 404, id);
    const [result] = await db.select().from(ideaAiResults).where(and(eq(ideaAiResults.ideaId, ideaId), eq(ideaAiResults.jobKey, "idea.decision_pack"))).orderBy(desc(ideaAiResults.createdAt)).limit(1).all();
    if (!result) return apiError("not_found", "Decision pack not found.", 404, id);
    return ok({ ...result, resultJson: JSON.parse(result.resultJson) }, 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
