import { auth } from "../../../../auth";
import { ok, requestId } from "../../../../src/lib/http/errors";
import { quizApiError, quizContext } from "../../../../src/lib/quizzes/http";
import { rankingScopeSchema } from "../../../../src/lib/quizzes/schemas";
import { getRankings } from "../../../../src/lib/quizzes/service";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const context = await quizContext(await auth());
    const scope = rankingScopeSchema.parse(new URL(request.url).searchParams.get("scope") ?? "bank");
    return ok({ scope, items: await getRankings(context.userId, scope) }, 200, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
