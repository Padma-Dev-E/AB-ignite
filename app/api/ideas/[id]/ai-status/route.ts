import { auth } from "../../../../../auth";
import { getAuthorizedIdeaSnapshot } from "../../../../../src/lib/ideas/repository";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = Number((await params).id);
    if (!Number.isInteger(ideaId) || ideaId < 1) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const snapshot = await getAuthorizedIdeaSnapshot({ kind: session.user.role, id: session.user.id }, ideaId);
    if (!snapshot) return apiError("not_found", "Idea not found.", 404, id);
    return ok({
      idea: snapshot.idea,
      runs: snapshot.runs.map(({ resultJson: _result, errorMessage: _error, ...run }) => run),
      events: snapshot.events,
      aiRunEvents: snapshot.aiRunEvents,
      reviews: snapshot.reviews,
    }, 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
