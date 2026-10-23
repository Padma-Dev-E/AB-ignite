import { auth } from "../../../../../../auth";
import { apiError, ok, requestId } from "../../../../../../src/lib/http/errors";
import { quizApiError, quizContext } from "../../../../../../src/lib/quizzes/http";
import { submitAnswersSchema } from "../../../../../../src/lib/quizzes/schemas";
import { submitQuizAttempt } from "../../../../../../src/lib/quizzes/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const context = await quizContext(await auth());
    const input = submitAnswersSchema.parse(await request.json());
    return ok(await submitQuizAttempt(context.userId, Number((await params).id), input.answers), 200, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
