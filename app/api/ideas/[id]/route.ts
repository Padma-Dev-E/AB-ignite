import { auth } from "../../../../auth";
import { getIdeaById, getIdeaSubmissionDetails, listIdeaComments, updateReturnedIdea } from "../../../../src/lib/ideas/repository";
import { CommentListQuerySchema, IdeaUpdateSchema } from "../../../../src/lib/ideas/schemas";
import { apiError, handleApiError, ok, requestId } from "../../../../src/lib/http/errors";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = parseId((await params).id);
    if (!ideaId) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const idea = await getIdeaById(ideaId);
    if (!idea) return apiError("not_found", "Idea not found.", 404, id);
    if (idea.status === "draft" && idea.authorId !== Number(session.user.id)) return apiError("not_found", "Idea not found.", 404, id);
    const commentsQuery = CommentListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const comments = await listIdeaComments(ideaId, commentsQuery);
    const submission = await getIdeaSubmissionDetails(ideaId);
    return ok({ idea, comments, submission }, 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    const userId = Number(session?.user?.id);
    if (!session?.user?.id || session.isValid === false || !Number.isInteger(userId) || userId < 1) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = parseId((await params).id);
    if (!ideaId) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const current = await getIdeaById(ideaId);
    if (!current || (session.user.role !== "back_office" && current.authorId !== userId)) return apiError("not_found", "Idea not found.", 404, id);
    if (current.status !== "returned") return apiError("conflict", "Only returned ideas can be edited.", 409, id);
    const input = IdeaUpdateSchema.parse(await request.json());
    return ok(await updateReturnedIdea({ kind: session.user.role, id: String(userId) }, ideaId, input), 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
