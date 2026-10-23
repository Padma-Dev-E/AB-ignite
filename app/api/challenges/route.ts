import { auth } from "../../../auth";
import { ok, requestId } from "../../../src/lib/http/errors";
import { quizApiError, quizContext } from "../../../src/lib/quizzes/http";
import { listChallenges } from "../../../src/lib/quizzes/service";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const context = await quizContext(await auth());
    return ok({ items: await listChallenges(context.userId) }, 200, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
