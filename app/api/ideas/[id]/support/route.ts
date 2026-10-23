import { auth } from "../../../../../auth";
import { getIdeaById, supportIdea } from "../../../../../src/lib/ideas/repository";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    const userId = Number(session?.user?.id);
    if (!session?.user?.id || session.isValid === false || !Number.isInteger(userId) || userId < 1) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = Number((await params).id);
    if (!Number.isInteger(ideaId) || ideaId < 1) return apiError("validation_error", "Invalid idea ID.", 400, id);
    if (!await getIdeaById(ideaId)) return apiError("not_found", "Idea not found.", 404, id);
    return ok(await supportIdea({ kind: session.user.role, id: String(userId) }, ideaId), 200, id);
  } catch (error) { return handleApiError(error, id); }
}
