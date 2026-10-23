import { auth } from "../../../../../auth";
import { apiError, ok, requestId } from "../../../../../src/lib/http/errors";
import { quizApiError, quizContext } from "../../../../../src/lib/quizzes/http";
import { getQuizAttempt } from "../../../../../src/lib/quizzes/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const context = await quizContext(await auth());
    return ok(await getQuizAttempt(context.userId, Number((await params).id)), 200, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
