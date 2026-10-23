import { auth } from "../../../../auth";
import { apiError, ok, requestId } from "../../../../src/lib/http/errors";
import { quizApiError, quizContext } from "../../../../src/lib/quizzes/http";
import { getQuizDetails } from "../../../../src/lib/quizzes/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    await quizContext(await auth());
    const quiz = await getQuizDetails(Number((await params).id));
    if (!quiz) return apiError("not_found", "Quiz not found.", 404, id);
    return ok(quiz, 200, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
