import { auth } from "../../../auth";
import { apiError, ok, requestId } from "../../../src/lib/http/errors";
import { quizApiError, quizContext } from "../../../src/lib/quizzes/http";
import { listQuizCatalogue } from "../../../src/lib/quizzes/service";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await quizContext(await auth());
    return ok({ items: await listQuizCatalogue() }, 200, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
