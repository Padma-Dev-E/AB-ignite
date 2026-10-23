import { auth } from "../../../../../auth";
import { saveIdeaSubmission } from "../../../../../src/lib/ideas/repository";
import { IdeaSubmissionDetailsSchema } from "../../../../../src/lib/ideas/schemas";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const ideaId = Number((await params).id);
    if (!Number.isInteger(ideaId) || ideaId < 1) return apiError("validation_error", "Invalid idea ID.", 400, id);
    const input = IdeaSubmissionDetailsSchema.parse(await request.json());
    const submission = await saveIdeaSubmission({ kind: session.user.role, id: session.user.id }, ideaId, input);
    return ok({ score: submission.score, minimumScore: submission.minimumScore, answers: input.answers, metrics: input.metrics }, 200, id);
  } catch (error) {
    if (error instanceof Error && /not found or not authorized/i.test(error.message)) return apiError("not_found", "Idea not found.", 404, id);
    if (error instanceof Error && /cannot be changed|locked|invalid/i.test(error.message)) return apiError("conflict", error.message, 409, id);
    return handleApiError(error, id);
  }
}
