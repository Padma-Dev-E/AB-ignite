import { auth } from "../../../../../auth";
import { createIdeaComment, getIdeaById, listIdeaComments } from "../../../../../src/lib/ideas/repository";
import { CommentListQuerySchema, IdeaCommentSchema } from "../../../../../src/lib/ideas/schemas";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

function parseId(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = parseId((await params).id);
    if (!ideaId) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const idea = await getIdeaById(ideaId);
    if (!idea || idea.status === "draft") return apiError("not_found", "Idea not found.", 404, id);
    const query = CommentListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    return ok(await listIdeaComments(ideaId, query), 200, id);
  } catch (error) { return handleApiError(error, id); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    const userId = Number(session?.user?.id);
    if (!session?.user?.id || session.isValid === false || !Number.isInteger(userId) || userId < 1) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = parseId((await params).id);
    if (!ideaId) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const idea = await getIdeaById(ideaId);
    if (!idea || idea.status === "draft") return apiError("not_found", "Idea not found.", 404, id);
    const input = IdeaCommentSchema.parse(await request.json());
    return ok(await createIdeaComment({ kind: session.user.role, id: String(userId) }, ideaId, input.body), 201, id);
  } catch (error) { return handleApiError(error, id); }
}
