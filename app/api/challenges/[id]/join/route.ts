import { auth } from "../../../../../auth";
import { ok, requestId } from "../../../../../src/lib/http/errors";
import { quizApiError, quizContext, requestAuditMetadata, requestIdempotencyKey } from "../../../../../src/lib/quizzes/http";
import { idempotencySchema } from "../../../../../src/lib/quizzes/schemas";
import { joinChallenge } from "../../../../../src/lib/quizzes/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const context = await quizContext(await auth());
    let body: { idempotencyKey?: unknown } = {};
    try { body = await request.json(); } catch { /* header-only idempotency is supported */ }
    const key = idempotencySchema.parse(requestIdempotencyKey(request, body.idempotencyKey));
    return ok(await joinChallenge(context.userId, Number((await params).id), key, new Date(), { sessionId: context.sessionId, ...requestAuditMetadata(request), requestId: id }), 201, id);
  } catch (error) {
    return quizApiError(error, id);
  }
}
