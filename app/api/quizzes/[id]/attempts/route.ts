import { auth } from "../../../../../auth";
import { apiError, ok, requestId } from "../../../../../src/lib/http/errors";
import { quizApiError, quizContext, requestIdempotencyKey } from "../../../../../src/lib/quizzes/http";
import { startQuizAttempt } from "../../../../../src/lib/quizzes/service";
import { idempotencySchema } from "../../../../../src/lib/quizzes/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const context = await quizContext(await auth());
    let body: { idempotencyKey?: unknown } = {};
    try { body = await request.json(); } catch { /* header-only idempotency is supported */ }
    const key = idempotencySchema.parse(requestIdempotencyKey(request, body.idempotencyKey));
    return ok(await startQuizAttempt(context.userId, Number((await params).id), key), 201, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
